// Projects routes
import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { logActivity } from '../activity.js';
import { createNotification } from '../notifications.js';

const router = Router();

// GET /projects - Listar proyectos
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(401).json({ error: 'No organization context' });
        }

        const user = req.user;
        let projects;

        if (user.role === 'DEV') {
            projects = await prisma.project.findMany({
                where: {
                    organizationId,
                    members: {
                        some: { userId: user.id }
                    }
                },
                include: {
                    client: true,
                    members: {
                        include: { user: { select: { id: true, name: true, email: true } } }
                    },
                    _count: {
                        select: { tasks: true, timeLogs: true }
                    }
                }
            });
        } else {
            projects = await prisma.project.findMany({
                where: { organizationId },
                include: {
                    client: true,
                    members: {
                        include: { user: { select: { id: true, name: true, email: true } } }
                    },
                    _count: {
                        select: { tasks: true, timeLogs: true }
                    }
                }
            });
        }

        res.json(projects);
    } catch (error: any) {
        console.error('GET /projects error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /projects/:id - Obtener proyecto
router.get('/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const project = await prisma.project.findFirst({
            where: {
                id: req.params.id,
                organizationId
            },
            include: {
                client: true,
                members: {
                    include: { user: { select: { id: true, name: true, email: true } } }
                },
                tasks: {
                    include: {
                        assignedTo: { select: { id: true, name: true } },
                        _count: { select: { timeLogs: true, comments: true } }
                    }
                },
                _count: {
                    select: { tasks: true, timeLogs: true }
                }
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }

        if (req.user.role === 'DEV') {
            const isMember = project.members.some((m: any) => m.userId === req.user.id);
            if (!isMember) {
                return res.status(403).json({ error: 'Sin acceso al proyecto' });
            }
        }

        res.json(project);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /projects - Crear proyecto
router.post('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(401).json({ error: 'No organization context' });
        }

        const { name, description, clientId, budget, currency = 'USD', status = 'ACTIVE' } = req.body;

        if (!name || typeof budget !== 'number') {
            return res.status(400).json({ error: 'name y budget requeridos' });
        }

        if (clientId) {
            const client = await prisma.client.findFirst({
                where: { id: clientId, organizationId }
            });
            if (!client) {
                return res.status(404).json({ error: 'Cliente no encontrado' });
            }
        }

        const project = await prisma.project.create({
            data: {
                name,
                description,
                clientId: clientId || null,
                budget,
                currency,
                status,
                organizationId,
                members: {
                    create: {
                        userId: req.user.id,
                        role: 'MANAGER',
                        payRate: 0,
                        billRate: 0
                    }
                }
            },
            include: {
                client: true,
                members: true
            }
        });

        await logActivity({
            type: 'CREATED',
            description: `Proyecto creado: ${name}`,
            organizationId,
            projectId: project.id,
            userId: req.user.id
        });

        res.status(201).json(project);
    } catch (error: any) {
        console.error('POST /projects error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /projects/:id - Actualizar proyecto
router.put('/:id', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { name, description, budget, currency, status, clientId } = req.body;

        const project = await prisma.project.findFirst({
            where: { id: req.params.id, organizationId }
        });

        if (!project) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }

        const updated = await prisma.project.update({
            where: { id: req.params.id },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(typeof budget === 'number' && { budget }),
                ...(currency && { currency }),
                ...(status && { status }),
                ...(clientId !== undefined && { clientId: clientId || null })
            },
            include: {
                client: true
            }
        });

        await logActivity({
            type: 'UPDATED',
            description: `Proyecto actualizado: ${updated.name}`,
            organizationId,
            projectId: updated.id,
            userId: req.user.id
        });

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /projects/:id - Eliminar proyecto
router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const project = await prisma.project.findFirst({
            where: { id: req.params.id, organizationId }
        });

        if (!project) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }

        await prisma.project.delete({
            where: { id: req.params.id }
        });

        await logActivity({
            type: 'DELETED',
            description: `Proyecto eliminado: ${project.name}`,
            organizationId,
            userId: req.user.id
        });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /projects/:id/members - Agregar miembro
router.post('/:id/members', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { userId, payRate, billRate, role = 'DEV' } = req.body;

        if (!userId || typeof payRate !== 'number' || typeof billRate !== 'number') {
            return res.status(400).json({ error: 'userId, payRate y billRate requeridos' });
        }

        const project = await prisma.project.findFirst({
            where: { id: req.params.id, organizationId }
        });

        if (!project) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const member = await prisma.projectMember.upsert({
            where: {
                projectId_userId: {
                    projectId: req.params.id,
                    userId
                }
            },
            update: {
                payRate,
                billRate,
                role
            },
            create: {
                projectId: req.params.id,
                userId,
                payRate,
                billRate,
                role
            }
        });

        await logActivity({
            type: 'ASSIGNMENT',
            description: `${user.name} agregado al proyecto ${project.name}`,
            organizationId,
            projectId: project.id,
            userId: req.user.id,
            metadata: { memberId: member.id, payRate, billRate }
        });

        await createNotification({
            userId,
            organizationId,
            type: 'PROJECT',
            title: 'Agregado a proyecto',
            body: `Has sido agregado al proyecto ${project.name}`,
            data: { projectId: project.id }
        });

        res.json(member);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /projects/:id/members/:userId - Eliminar miembro
router.delete('/:id/members/:userId', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const project = await prisma.project.findFirst({
            where: { id: req.params.id, organizationId }
        });

        if (!project) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }

        await prisma.projectMember.deleteMany({
            where: {
                projectId: req.params.id,
                userId: req.params.userId
            }
        });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /projects/:id/summary - Resumen del proyecto
router.get('/:id/summary', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const project = await prisma.project.findFirst({
            where: { id: req.params.id, organizationId },
            include: {
                tasks: true,
                timeLogs: {
                    where: { end: { not: null } }
                }
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }

        // Filter timeLogs for DEVs to only show their own
        let relevantTimeLogs = project.timeLogs;
        if (req.user.role === 'DEV') {
            relevantTimeLogs = project.timeLogs.filter((log: any) => log.userId === req.user.id);
        }

        const totalBillCost = relevantTimeLogs.reduce((acc: any, log: any) => {
            const hours = log.end ? (log.end.getTime() - log.start.getTime()) / 3600000 : 0;
            return acc + (hours * (log.billRate || 0));
        }, 0);

        const totalPayCost = relevantTimeLogs.reduce((acc: any, log: any) => {
            const hours = log.end ? (log.end.getTime() - log.start.getTime()) / 3600000 : 0;
            return acc + (hours * (log.payRate || 0));
        }, 0);

        const totalHours = relevantTimeLogs.reduce((acc: any, log: any) => {
            return acc + (log.end ? (log.end.getTime() - log.start.getTime()) / 3600000 : 0);
        }, 0);

        const tasksByStatus = {
            BACKLOG: project.tasks.filter((t: any) => t.status === 'BACKLOG').length,
            TODO: project.tasks.filter((t: any) => t.status === 'TODO').length,
            IN_PROGRESS: project.tasks.filter((t: any) => t.status === 'IN_PROGRESS').length,
            REVIEW: project.tasks.filter((t: any) => t.status === 'REVIEW').length,
            DONE: project.tasks.filter((t: any) => t.status === 'DONE').length,
        };

        const progress = project.tasks.length > 0
            ? (tasksByStatus.DONE / project.tasks.length) * 100
            : 0;

        // Redact sensitive info for DEVs
        if (req.user.role === 'DEV') {
            res.json({
                project: {
                    id: project.id,
                    name: project.name,
                    budget: 0, // Hidden
                    currency: project.currency,
                    status: project.status
                },
                budget: 0, // Hidden
                currency: project.currency,
                spent: totalPayCost, // For DEV, "Spent"/Earnings is their Pay
                remaining: 0, // Hidden
                totalHours: Math.round(totalHours * 100) / 100,
                totalPayCost: Math.round(totalPayCost * 100) / 100,
                tasksByStatus,
                progress: Math.round(progress)
            });
        } else {
            res.json({
                project: {
                    id: project.id,
                    name: project.name,
                    budget: project.budget,
                    currency: project.currency,
                    status: project.status
                },
                budget: project.budget,
                currency: project.currency,
                spent: totalBillCost,
                remaining: project.budget - totalBillCost,
                totalHours: Math.round(totalHours * 100) / 100,
                totalPayCost: Math.round(totalPayCost * 100) / 100,
                tasksByStatus,
                progress: Math.round(progress)
            });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== WIKI ====================

// GET /projects/:id/wiki
router.get('/:id/wiki', authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const pages = await prisma.wikiPage.findMany({
            where: { projectId: id },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(pages);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /projects/:id/wiki
router.post('/:id/wiki', authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { title, content } = req.body;

        const page = await prisma.wikiPage.create({
            data: {
                projectId: id,
                title,
                content,
                updatedBy: req.user.id
            }
        });

        // Log activity
        await logActivity({
            type: 'CREATED', // Using generic CREATED type as WIKI_CREATED is not in ActivityType enum yet
            description: `Wiki creada: ${title}`,
            organizationId: req.user.organizationId,
            projectId: id,
            userId: req.user.id
        });

        res.json(page);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /projects/:id/wiki/:pageId
router.put('/:id/wiki/:pageId', authMiddleware, async (req: any, res) => {
    try {
        const { id, pageId } = req.params;
        const { title, content } = req.body;

        const page = await prisma.wikiPage.update({
            where: { id: pageId },
            data: {
                title,
                content,
                updatedBy: req.user.id
            }
        });

        // Log activity
        await logActivity({
            type: 'UPDATED',
            description: `Wiki actualizada: ${title}`,
            organizationId: req.user.organizationId,
            projectId: id,
            userId: req.user.id
        });

        res.json(page);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /projects/:id/wiki/:pageId
router.delete('/:id/wiki/:pageId', authMiddleware, async (req: any, res) => {
    try {
        const { id, pageId } = req.params;

        const page = await prisma.wikiPage.delete({
            where: { id: pageId }
        });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
