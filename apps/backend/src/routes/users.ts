// Users routes
import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { logActivity } from '../activity.js';
import { createNotification } from '../notifications.js';

const router = Router();

// GET /users - Listar usuarios de la organización
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(401).json({ error: 'No organization context' });
        }

        const members = await prisma.organizationMember.findMany({
            where: { organizationId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true,
                        role: true,
                        lastLoginAt: true
                    }
                }
            }
        });

        const users = members.map((m: any) => ({
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            avatar: m.user.avatar,
            role: m.role,
            defaultPayRate: m.defaultPayRate,
            lastLoginAt: m.user.lastLoginAt
        }));

        res.json(users);
    } catch (error: any) {
        console.error('GET /users error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /users/:id - Obtener usuario
router.get('/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const userId = req.params.id;

        const membership = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true,
                        role: true,
                        phone: true,
                        lastLoginAt: true
                    }
                }
            }
        });

        if (!membership) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({
            ...membership.user,
            role: membership.role,
            defaultPayRate: membership.defaultPayRate
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /users/:id/balance - Obtener balance de un usuario
router.get('/:id/balance', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const userId = req.params.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                timeLogs: {
                    where: {
                        project: { organizationId },
                        end: { not: null }
                    }
                },
                payouts: {
                    where: { organizationId }
                },
                memberships: {
                    where: { organizationId }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const totalDebt = user.timeLogs.reduce((acc: any, log: any) => {
            if (log.end) {
                const hours = (log.end.getTime() - log.start.getTime()) / 3600000;
                return acc + (hours * (log.payRate || 0));
            }
            return acc;
        }, 0);

        const totalHours = user.timeLogs.reduce((acc: any, log: any) => {
            if (log.end) {
                return acc + ((log.end.getTime() - log.start.getTime()) / 3600000);
            }
            return acc;
        }, 0);

        const totalPaid = user.payouts.reduce((acc: any, p: any) => acc + p.amount, 0);
        const defaultPayRate = user.memberships[0]?.defaultPayRate || 0;

        res.json({
            userId: user.id,
            userName: user.name,
            defaultPayRate,
            totalHours: Math.round(totalHours * 100) / 100,
            totalDebt: Math.round(totalDebt * 100) / 100,
            totalPaid: Math.round(totalPaid * 100) / 100,
            balance: Math.round((totalDebt - totalPaid) * 100) / 100,
            payments: user.payouts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /users - Crear usuario (solo ADMIN)
router.post('/', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { email, name, role = 'DEV', defaultPayRate = 0, password } = req.body;

        if (!email || !name) {
            return res.status(400).json({ error: 'email y name requeridos' });
        }

        let user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            if (!password) {
                return res.status(400).json({ error: 'password requerido para nuevo usuario' });
            }

            const { hashPassword } = await import('../auth.js');
            const hashedPassword = await hashPassword(password);

            user = await prisma.user.create({
                data: {
                    email,
                    name,
                    password: hashedPassword,
                    role: role as any
                }
            });
        }

        const existingMembership = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId: user.id,
                    organizationId
                }
            }
        });

        if (existingMembership) {
            return res.status(400).json({ error: 'El usuario ya es miembro de esta organización' });
        }

        const membership = await prisma.organizationMember.create({
            data: {
                userId: user.id,
                organizationId,
                role: role as any,
                defaultPayRate
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true
                    }
                }
            }
        });

        await logActivity({
            type: 'CREATED',
            description: `Usuario ${user.name} agregado a la organización`,
            organizationId,
            userId: req.user.id
        });

        await createNotification({
            userId: user.id,
            organizationId,
            type: 'SYSTEM',
            title: 'Bienvenido a la organización',
            body: `Has sido agregado a la organización`,
            data: { organizationId }
        });

        res.status(201).json({
            id: membership.user.id,
            name: membership.user.name,
            email: membership.user.email,
            role: membership.role,
            defaultPayRate: membership.defaultPayRate
        });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }
        console.error('POST /users error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /users/:id - Actualizar usuario
router.put('/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const targetUserId = req.params.id;
        const requestingUser = req.user;

        // Allow if admin/manager OR if updating self
        const canUpdate =
            ['ADMIN', 'MANAGER'].includes(requestingUser.role) ||
            requestingUser.id === targetUserId;

        if (!canUpdate) {
            return res.status(403).json({ error: 'No tienes permisos para editar este usuario' });
        }

        const { name, role, defaultPayRate, avatar, phone, password } = req.body;

        // Verify membership exists
        const membership = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId: targetUserId,
                    organizationId
                }
            },
            include: { user: true }
        });

        if (!membership) {
            return res.status(404).json({ error: 'Usuario no encontrado en la organización' });
        }

        const userUpdate: any = {};
        if (name) userUpdate.name = name;
        if (avatar !== undefined) userUpdate.avatar = avatar;
        if (phone !== undefined) userUpdate.phone = phone;

        // Handle password update
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
            }
            const { hashPassword } = await import('../auth.js');
            userUpdate.password = await hashPassword(password);
        }

        if (Object.keys(userUpdate).length > 0) {
            await prisma.user.update({
                where: { id: targetUserId },
                data: userUpdate
            });
        }

        const membershipUpdate: any = {};

        // Only Admin/Manager can update role/payRate
        if (['ADMIN', 'MANAGER'].includes(requestingUser.role) && requestingUser.id !== targetUserId) {
            if (role) membershipUpdate.role = role;
            if (typeof defaultPayRate === 'number') membershipUpdate.defaultPayRate = defaultPayRate;
        }

        if (Object.keys(membershipUpdate).length > 0) {
            await prisma.organizationMember.update({
                where: {
                    userId_organizationId: {
                        userId: targetUserId,
                        organizationId
                    }
                },
                data: membershipUpdate
            });
        }

        const updated = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId: req.params.id,
                    organizationId
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true,
                        role: true
                    }
                }
            }
        });

        await logActivity({
            type: 'UPDATED',
            description: `Usuario ${updated?.user.name} actualizado`,
            organizationId,
            userId: req.user.id
        });

        res.json({
            id: updated?.user.id,
            name: updated?.user.name,
            email: updated?.user.email,
            avatar: updated?.user.avatar,
            role: updated?.role,
            defaultPayRate: updated?.defaultPayRate
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /users/:id - Eliminar usuario de la organización
router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const userId = req.params.id;

        if (userId === req.user.id) {
            return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
        }

        const membership = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId
                }
            },
            include: { user: true }
        });

        if (!membership) {
            return res.status(404).json({ error: 'Usuario no encontrado en la organización' });
        }

        await prisma.organizationMember.delete({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId
                }
            }
        });

        await logActivity({
            type: 'DELETED',
            description: `Usuario ${membership.user.name} eliminado de la organización`,
            organizationId,
            userId: req.user.id
        });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
