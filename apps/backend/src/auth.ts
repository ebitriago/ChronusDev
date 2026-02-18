// Authentication module for ChronusDev (compatible with CRM)
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { prisma } from './db.js';
import crypto from 'crypto';
import { sendEmail, emailTemplates } from './email.js';

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                name: string;
                role: string;
                organizationId?: string;
            };
        }
    }
}

const JWT_SECRET = process.env.JWT_SECRET || 'chronus-crm-super-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

export function generateToken(user: { id: string; email: string; name: string; role: string; organizationId?: string }): string {
    return jwt.sign(
        { userId: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

export function verifyToken(token: string): { userId: string; email: string; name: string; role: string; organizationId?: string } | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        return {
            userId: decoded.userId || decoded.id,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role,
            organizationId: decoded.organizationId
        };
    } catch {
        return null;
    }
}

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

export function hashPasswordSync(password: string): string {
    return bcrypt.hashSync(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado - Token requerido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'No autorizado - Token inválido o expirado' });
    }

    const userId = decoded.userId;
    const organizationId = decoded.organizationId;

    // Verificar usuario en BD local
    let user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            memberships: {
                include: { organization: true }
            }
        }
    });

    // JIT: Si no existe pero viene del CRM, crear referencia
    if (!user && decoded.email) {
        console.log(`[Auth] JIT Provisioning user from CRM: ${decoded.email}`);

        // Verificar si hay crmUserId en el token (viene del CRM)
        const crmUserId = (decoded as any).crmUserId || userId;

        await prisma.user.create({
            data: {
                id: userId,
                email: decoded.email,
                name: decoded.name || decoded.email.split('@')[0],
                role: (decoded.role === 'AGENT' ? 'DEV' : (decoded.role as any)) || 'DEV',
                crmUserId: crmUserId !== userId ? crmUserId : undefined
            }
        });

        // Re-fetch user to get the correct type with memberships
        user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                memberships: {
                    include: { organization: true }
                }
            }
        });

        if (!user) {
            throw new Error('User creation failed');
        }

        // Si hay organizationId, crear membresía si la organización existe
        if (organizationId) {
            const org = await prisma.organization.findUnique({
                where: { id: organizationId }
            });

            if (org) {
                await prisma.organizationMember.create({
                    data: {
                        userId: user.id,
                        organizationId,
                        role: (decoded.role === 'AGENT' ? 'DEV' : (decoded.role as any)) || 'DEV'
                    }
                });
            }
        }
    }

    if (!user) {
        return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    // Verificar organización si se proporciona
    if (organizationId) {
        const orgExists = await prisma.organization.findUnique({ where: { id: organizationId } });
        if (!orgExists) {
            return res.status(401).json({ error: 'Organización inválida' });
        }

        // Verificar membresía
        const membership = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId
                }
            }
        });

        if (!membership) {
            return res.status(403).json({ error: 'No tienes acceso a esta organización' });
        }
    }

    req.user = {
        id: userId,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        organizationId: organizationId
    };

    next();
}

export function requireRole(...allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        if (!allowedRoles.includes(req.user.role) && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Acceso denegado - Rol insuficiente' });
        }

        next();
    };
}

export async function handleLogin(email: string, password: string) {
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            memberships: {
                include: {
                    organization: true
                }
            }
        }
    });

    if (!user || !user.password) {
        return { error: 'Credenciales inválidas' };
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
        return { error: 'Credenciales inválidas' };
    }

    const defaultMembership = user.memberships[0];
    const activeOrganizationId = defaultMembership?.organizationId;

    await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });

    const token = generateToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: activeOrganizationId,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
        data: {
            userId: user.id,
            token,
            expiresAt,
        },
    });

    return {
        success: true,
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            avatar: user.avatar,
            organizations: user.memberships.map(m => ({
                id: m.organization.id,
                name: m.organization.name,
                slug: m.organization.slug,
                role: m.role,
                enabledServices: m.organization.enabledServices
            })),
            organization: defaultMembership ? {
                id: defaultMembership.organization.id,
                name: defaultMembership.organization.name,
                enabledServices: defaultMembership.organization.enabledServices
            } : null
        },
    };
}

export async function handleRegister(name: string, email: string, password: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        return { error: 'El email ya está registrado' };
    }

    const hashedPassword = await hashPassword(password);

    try {
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    role: 'ADMIN',
                },
            });

            const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);

            const org = await tx.organization.create({
                data: {
                    name: `Org de ${name}`,
                    slug: slug,
                    enabledServices: "CHRONUSDEV",
                    subscriptionStatus: "TRIALING",
                }
            });

            const membership = await tx.organizationMember.create({
                data: {
                    userId: user.id,
                    organizationId: org.id,
                    role: 'ADMIN'
                }
            });

            return { user, org, membership };
        });

        const token = generateToken({
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
            organizationId: result.org.id
        });

        return {
            success: true,
            token,
            user: {
                id: result.user.id,
                email: result.user.email,
                name: result.user.name,
                role: result.user.role,
                organizations: [{
                    id: result.org.id,
                    name: result.org.name,
                    slug: result.org.slug,
                    role: result.membership.role,
                    enabledServices: result.org.enabledServices
                }],
                organization: {
                    id: result.org.id,
                    name: result.org.name,
                    enabledServices: result.org.enabledServices
                }
            },
        };

    } catch (e) {
        console.error("Register Error", e);
        return { error: 'Error al registrar usuario' };
    }
}

export async function handleLogout(token: string) {
    try {
        await prisma.session.deleteMany({ where: { token } });
        return { success: true };
    } catch {
        return { error: 'Error al cerrar sesión' };
    }
}

export async function switchOrganization(userId: string, targetOrganizationId: string) {
    // Verificar membresía
    const membership = await prisma.organizationMember.findUnique({
        where: {
            userId_organizationId: {
                userId,
                organizationId: targetOrganizationId
            }
        },
        include: { organization: true }
    });

    if (!membership) {
        return { error: 'No tienes acceso a esta organización' };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { error: 'Usuario no encontrado' };

    // Generar nuevo token con la organización activa
    const effectiveRole = user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : (membership.role || user.role);

    const token = generateToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: effectiveRole,
        organizationId: targetOrganizationId,
    });

    return {
        success: true,
        token,
        organization: {
            id: membership.organization.id,
            name: membership.organization.name,
            enabledServices: membership.organization.enabledServices
        }
    };
}

export async function verifyTokenEndpoint(token: string) {
    const decoded = verifyToken(token);
    if (!decoded) {
        return { valid: false };
    }

    // Verificar usuario en BD
    const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
            memberships: {
                include: {
                    organization: true
                }
            }
        }
    });

    if (!user) {
        return { valid: false, error: 'Usuario no encontrado' };
    }

    return {
        valid: true,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: decoded.role,
            organizations: user.memberships.map(m => ({
                id: m.organization.id,
                name: m.organization.name,
                slug: m.organization.slug,
                role: m.role,
                enabledServices: m.organization.enabledServices
            }))
        }
    };
}

// ==================== PASSWORD RECOVERY ====================

export async function handleForgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        // Return success even if not found to prevent enumeration
        return { success: true, message: 'Si el correo existe, recibirás un enlace.' };
    }

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
        where: { id: user.id },
        data: {
            resetToken: resetToken,
            resetTokenExpires: resetTokenExpires
        }
    });

    const frontendUrl = process.env.NEXT_PUBLIC_CHRONUS_APP_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

    // Send Email
    const template = emailTemplates.passwordReset(resetLink);
    await sendEmail({
        to: email,
        ...template
    });

    return { success: true, message: 'Correo enviado' };
}

export async function handleResetPassword(token: string, newPassword: string) {
    const user = await prisma.user.findUnique({
        where: { resetToken: token }
    });

    if (!user) {
        return { error: 'Token inválido o expirado' };
    }

    if (!user.resetTokenExpires || user.resetTokenExpires < new Date()) {
        return { error: 'El token ha expirado' };
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            resetToken: null,
            resetTokenExpires: null
        }
    });

    return { success: true };
}
