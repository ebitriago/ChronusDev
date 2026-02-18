// TimeLogs routes
import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';
import { logActivity } from '../activity.js';
import { createNotification } from '../notifications.js';

const router = Router();

// GET /timelogs/current - Timer activo del usuario
router.get('/current', authMiddleware, async (req: any, res) => {
    try {
        const running = await prisma.timeLog.findFirst({
            where: {
                userId: req.user.id,
                end: null
            },
            include: {
                task: {
                    include: {
                        project: { select: { id: true, name: true } }
                    }
                },
                project: { select: { id: true, name: true } },
                user: { select: { id: true, name: true } }
            },
            orderBy: { start: 'desc' }
        });

        res.json(running);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /timelogs/active - Todos los timers activos
router.get('/active', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const active = await prisma.timeLog.findMany({
            where: {
                project: { organizationId },
                end: null
            },
            include: {
                user: { select: { id: true, name: true, avatar: true } },
                task: { select: { id: true, title: true } },
                project: { select: { id: true, name: true } }
            },
            orderBy: { start: 'desc' }
        });

        res.json(active);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /timelogs - Crear log manual
router.post('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { taskId, projectId, start, end, description } = req.body;

        if (!projectId || !start || !end) {
            return res.status(400).json({ error: 'projectId, start y end requeridos' });
        }

        const project = await prisma.project.findFirst({
            where: { id: projectId, organizationId }
        });

        if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

        const member = await prisma.projectMember.findFirst({
            where: { projectId, userId: req.user.id }
        });

        const timeLog = await prisma.timeLog.create({
            data: {
                projectId,
                userId: req.user.id,
                taskId: taskId || null,
                start: new Date(start),
                end: new Date(end),
                description,
                payRate: member?.payRate || 0,
                billRate: member?.billRate || 0
            },
            include: {
                task: true,
                project: true
            }
        });

        await logActivity({
            type: 'TIMELOG_STOPPED', // Using STOPPED as it effectively adds a completed log
            description: `Log manual: ${description || 'Sin descripción'}`,
            organizationId,
            projectId,
            userId: req.user.id
        });

        res.status(201).json(timeLog);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /timelogs/start - Iniciar timer
router.post('/start', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { taskId, projectId, description } = req.body;

        if (!projectId) {
            return res.status(400).json({ error: 'projectId requerido' });
        }

        const running = await prisma.timeLog.findFirst({
            where: {
                userId: req.user.id,
                end: null
            }
        });

        if (running) {
            return res.status(400).json({ error: 'Ya tienes un timer activo' });
        }

        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                organizationId
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }

        if (taskId) {
            const task = await prisma.task.findFirst({
                where: {
                    id: taskId,
                    projectId,
                    project: { organizationId }
                }
            });

            if (!task) {
                return res.status(404).json({ error: 'Tarea no encontrada' });
            }

            if (task.status === 'BACKLOG' || task.status === 'TODO') {
                await prisma.task.update({
                    where: { id: taskId },
                    data: { status: 'IN_PROGRESS' }
                });
            }

            if (!task.assignedToId) {
                await prisma.task.update({
                    where: { id: taskId },
                    data: { assignedToId: req.user.id }
                });
            }
        }

        const member = await prisma.projectMember.findFirst({
            where: {
                projectId,
                userId: req.user.id
            }
        });

        const timeLog = await prisma.timeLog.create({
            data: {
                taskId: taskId || null,
                projectId,
                userId: req.user.id,
                start: new Date(),
                description: description || null,
                payRate: member?.payRate || 0,
                billRate: member?.billRate || 0
            },
            include: {
                task: {
                    include: {
                        project: { select: { id: true, name: true } }
                    }
                },
                project: { select: { id: true, name: true } }
            }
        });

        await logActivity({
            type: 'TIMELOG_STARTED',
            description: `Timer iniciado en ${project.name}`,
            organizationId,
            projectId,
            taskId: taskId || undefined,
            userId: req.user.id
        });

        res.status(201).json(timeLog);
    } catch (error: any) {
        console.error('POST /timelogs/start error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /timelogs/stop - Detener timer
router.post('/stop', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { timelogId, note } = req.body;

        if (!timelogId) {
            return res.status(400).json({ error: 'timelogId requerido' });
        }

        const timeLog = await prisma.timeLog.findFirst({
            where: {
                id: timelogId,
                project: { organizationId }
            },
            include: {
                project: true,
                task: true
            }
        });

        if (!timeLog) {
            return res.status(404).json({ error: 'TimeLog no encontrado' });
        }

        if (timeLog.userId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
            return res.status(403).json({ error: 'No permitido' });
        }

        if (timeLog.end) {
            return res.status(400).json({ error: 'Timer ya estaba detenido' });
        }

        const end = new Date();
        const hours = (end.getTime() - timeLog.start.getTime()) / 3600000;
        const roundedHours = Math.round(hours * 100) / 100;

        const updated = await prisma.timeLog.update({
            where: { id: timelogId },
            data: {
                end,
                description: note || timeLog.description
            },
            include: {
                task: {
                    include: {
                        project: { select: { id: true, name: true } }
                    }
                },
                project: { select: { id: true, name: true } },
                user: { select: { id: true, name: true } }
            }
        });

        await logActivity({
            type: 'TIMELOG_STOPPED',
            description: `Timer detenido: ${roundedHours}h en ${timeLog.project.name}`,
            organizationId,
            projectId: timeLog.projectId,
            taskId: timeLog.taskId || undefined,
            userId: req.user.id,
            metadata: { hours: roundedHours }
        });

        if (note && note.trim() && timeLog.taskId) {
            await prisma.taskComment.create({
                data: {
                    taskId: timeLog.taskId,
                    userId: req.user.id,
                    content: `⏱️ Timer Note: ${note}`
                }
            });
        }

        res.json(updated);
    } catch (error: any) {
        console.error('POST /timelogs/stop error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /timelogs - Listar timelogs
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { projectId, taskId, userId, startDate, endDate } = req.query;

        let where: any = {
            project: { organizationId }
        };

        if (projectId) {
            where.projectId = projectId;
        }

        if (taskId) {
            where.taskId = taskId;
        }

        if (userId) {
            where.userId = userId;
        }

        if (startDate || endDate) {
            where.start = {};
            if (startDate) {
                where.start.gte = new Date(startDate as string);
            }
            if (endDate) {
                where.start.lte = new Date(endDate as string);
            }
        }

        if (req.user.role === 'DEV') {
            where.userId = req.user.id;
        }

        const timeLogs = await prisma.timeLog.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, avatar: true } },
                task: { select: { id: true, title: true } },
                project: { select: { id: true, name: true } }
            },
            orderBy: { start: 'desc' },
            take: 100
        });

        const enriched = timeLogs.map((log: any) => {
            let hours = 0;
            if (log.end) {
                hours = (log.end.getTime() - log.start.getTime()) / 3600000;
            }

            return {
                ...log,
                hours: Math.round(hours * 100) / 100,
                payCost: Math.round(hours * (log.payRate || 0) * 100) / 100,
                billCost: Math.round(hours * (log.billRate || 0) * 100) / 100
            };
        });

        res.json(enriched);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /timelogs/:id/note - Agregar/actualizar nota
router.put('/:id/note', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { note } = req.body;

        const timeLog = await prisma.timeLog.findFirst({
            where: {
                id: req.params.id,
                project: { organizationId }
            }
        });

        if (!timeLog) {
            return res.status(404).json({ error: 'TimeLog no encontrado' });
        }

        if (timeLog.userId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
            return res.status(403).json({ error: 'No permitido' });
        }

        const updated = await prisma.timeLog.update({
            where: { id: req.params.id },
            data: { description: note || '' }
        });

        if (note && note.trim() && timeLog.taskId) {
            await prisma.taskComment.create({
                data: {
                    taskId: timeLog.taskId,
                    userId: req.user.id,
                    content: `⏱️ Nota de Timer: ${note}`
                }
            });
        }

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
