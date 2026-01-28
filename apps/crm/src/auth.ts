// Authentication module for ChronusCRM
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { prisma } from './db.js';

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                name: string;
                role: string;
                organizationId?: string; // Active context
            };
        }
    }
}

const JWT_SECRET = process.env.JWT_SECRET || 'chronus-crm-super-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// ==================== TOKEN MANAGEMENT ====================

export function generateToken(user: { id: string; email: string; name: string; role: string; organizationId?: string }): string {
    return jwt.sign(
        { userId: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

export function verifyToken(token: string): { userId: string; email: string; name: string; role: string } | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; name: string; role: string };
        return decoded;
    } catch {
        return null;
    }
}

// ==================== PASSWORD MANAGEMENT ====================

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// ==================== MIDDLEWARE ====================

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado - Token requerido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'No autorizado - Token inválido o expirado' });
    }

    // Attach user to request
    req.user = {
        id: decoded.userId,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        organizationId: (decoded as any).organizationId
    };

    next();
}

// Optional auth - sets user if token present, but doesn't block
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        if (decoded) {
            req.user = {
                id: decoded.userId,
                email: decoded.email,
                name: decoded.name,
                role: decoded.role,
            };
        }
    }

    next();
}

// Role-based access control
export function requireRole(...allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Acceso denegado - Rol insuficiente' });
        }

        next();
    };
}

// ==================== AUTH HANDLERS ====================

export async function handleLogin(email: string, password: string) {
    // Find user with Memberships
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

    // Check password
    const valid = await comparePassword(password, user.password);
    if (!valid) {
        return { error: 'Credenciales inválidas' };
    }

    // Determine active organization (default to first found or specific logic)
    // In future, could store 'lastOrganizationId' on User model
    const defaultMembership = user.memberships[0];
    const activeOrganizationId = defaultMembership?.organizationId;

    // Update last login
    await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });

    // Generate token scoped to active org
    // IMPORTANT: If user is SUPER_ADMIN, they should always have that role regardless of org context
    // EMERGENCY FIX: Hardcode for eduardo@assistai.lat
    let effectiveRole = user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : (user.role || 'AGENT');
    if (user.email === 'eduardo@assistai.lat') {
        effectiveRole = 'SUPER_ADMIN';
    }

    const token = generateToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: effectiveRole,
        organizationId: activeOrganizationId,
    });

    // Create session
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
            role: effectiveRole,
            avatar: user.avatar,
            // Return full list of organizations for the switcher
            organizations: user.memberships.map(m => ({
                id: m.organization.id,
                name: m.organization.name,
                slug: m.organization.slug,
                role: m.role, // Role in that specific org
                enabledServices: m.organization.enabledServices
            })),
            // Active context details
            organization: defaultMembership ? {
                id: defaultMembership.organization.id,
                name: defaultMembership.organization.name,
                enabledServices: defaultMembership.organization.enabledServices
            } : null
        },
    };
}

export async function switchOrganization(userId: string, targetOrganizationId: string) {
    // Verify membership
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

    // Generate new token
    // Fix: Preserve global SUPER_ADMIN role
    const effectiveRole = user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : (user.role || 'AGENT');

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

export async function handleRegister(name: string, email: string, password: string) {
    // Check if exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        return { error: 'El email ya está registrado' };
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Transaction to create User + Default Org + Membership
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create User
            const user = await tx.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    role: 'AGENT',
                },
            });

            // 2. Create Default Organization
            // Generate a slug from name or unique ID
            const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);

            const org = await tx.organization.create({
                data: {
                    name: `Org de ${name}`,
                    slug: slug,
                    enabledServices: "CRM", // Default service
                }
            });

            // 3. Create Membership (Owner/Admin of their own org)
            const membership = await tx.organizationMember.create({
                data: {
                    userId: user.id,
                    organizationId: org.id,
                    role: 'ADMIN'
                }
            });

            return { user, org, membership };
        });

        // Generate token
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

// ==================== ASSISTAI SSO ====================

// Configuration for AssistAI OAuth (to be filled with actual values)
const ASSISTAI_OAUTH = {
    clientId: process.env.ASSISTAI_CLIENT_ID || '',
    clientSecret: process.env.ASSISTAI_CLIENT_SECRET || '',
    authorizeUrl: process.env.ASSISTAI_AUTHORIZE_URL || 'https://public.assistai.lat/oauth/authorize',
    tokenUrl: process.env.ASSISTAI_TOKEN_URL || 'https://public.assistai.lat/oauth/token',
    userInfoUrl: process.env.ASSISTAI_USERINFO_URL || 'https://public.assistai.lat/api/v1/me',
    redirectUri: process.env.ASSISTAI_REDIRECT_URI || 'http://localhost:3002/auth/assistai/callback',
};

export function getAssistAIAuthUrl(): string {
    const params = new URLSearchParams({
        client_id: ASSISTAI_OAUTH.clientId,
        redirect_uri: ASSISTAI_OAUTH.redirectUri,
        response_type: 'code',
        scope: 'profile email',
    });
    return `${ASSISTAI_OAUTH.authorizeUrl}?${params.toString()}`;
}

export async function handleAssistAICallback(code: string) {
    try {
        // Exchange code for token
        const tokenResponse = await fetch(ASSISTAI_OAUTH.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: ASSISTAI_OAUTH.clientId,
                client_secret: ASSISTAI_OAUTH.clientSecret,
                redirect_uri: ASSISTAI_OAUTH.redirectUri,
            }),
        });

        if (!tokenResponse.ok) {
            return { error: 'Error al obtener token de AssistAI' };
        }

        const tokenData = await tokenResponse.json() as { access_token: string };

        // Get user info
        const userResponse = await fetch(ASSISTAI_OAUTH.userInfoUrl, {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (!userResponse.ok) {
            return { error: 'Error al obtener información de usuario de AssistAI' };
        }

        const assistaiUser = await userResponse.json() as {
            id: number;
            email: string;
            firstname: string;
            lastname: string;
        };

        // Find or create user
        let user = await prisma.user.findUnique({
            where: { assistaiId: String(assistaiUser.id) },
        });

        if (!user) {
            // Check if email exists
            user = await prisma.user.findUnique({ where: { email: assistaiUser.email } });

            if (user) {
                // Link existing account
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        assistaiId: String(assistaiUser.id),
                        assistaiToken: tokenData.access_token,
                    },
                });
            } else {
                // Create new user
                user = await prisma.user.create({
                    data: {
                        email: assistaiUser.email,
                        name: `${assistaiUser.firstname} ${assistaiUser.lastname}`.trim(),
                        role: 'AGENT',
                        assistaiId: String(assistaiUser.id),
                        assistaiToken: tokenData.access_token,
                    },
                });
            }
        } else {
            // Update token
            await prisma.user.update({
                where: { id: user.id },
                data: { assistaiToken: tokenData.access_token },
            });
        }

        // Generate our JWT
        // Note: AssistAI login currently doesn't fetch memberships, so we default to undefined or need to fetch them
        // For now, let's keep it simple as this flow might need enhancement later
        const token = generateToken({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            // organizationId: user.organizationId // Error: property doesn't exist on User without include
        });

        return {
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        };
    } catch (err: any) {
        console.error('[AssistAI OAuth Error]', err);
        return { error: err.message || 'Error en autenticación con AssistAI' };
    }
}
