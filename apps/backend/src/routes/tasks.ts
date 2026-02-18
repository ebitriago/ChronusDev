// Tasks routes
import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { logActivity } from '../activity.js';
import { createNotification } from '../notifications.js';

const router = Router();

// GET /tasks - Listar tareas
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { projectId, status, assignedTo } = req.query;

        let where: any = { project: { organizationId } };

        if (projectId) {
            where.projectId = projectId;
        }

        if (status) {
            where.status = status;
        }

        if (assignedTo) {
            where.assignedToId = assignedTo;
        }

        if (req.user.role === 'DEV') {
            const userProjects = await prisma.projectMember.findMany({
                where: { userId: req.user.id },
                select: { projectId: true }
            });

            where.projectId = {
                in: userProjects.map((pm: any) => pm.projectId)
            };
        }

        const tasks = await prisma.task.findMany({
            where,
            include: {
                project: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, name: true, avatar: true } },
                createdBy: { select: { id: true, name: true } },
                _count: {
                    select: { timeLogs: true, comments: true, attachments: true }
                },
                attachments: true
            },
            orderBy: { createdAt: 'desc' }
        });

        const enriched = await Promise.all(tasks.map(async (task: any) => {
            const logs = await prisma.timeLog.findMany({
                where: {
                    taskId: task.id
                },
                include: {
                    user: { select: { id: true, name: true, avatar: true } }
                }
            });

            const totalHours = logs.reduce((acc: any, log: any) => {
                if (log.end) {
                    const hours = (log.end.getTime() - log.start.getTime()) / 3600000;
                    return acc + hours;
                }
                return acc;
            }, 0);

            const activeWorkers = logs
                .filter((log: any) => !log.end)
                .map((log: any) => log.user)
                .filter((user: any, index: number, self: any[]) =>
                    index === self.findIndex((u) => u.id === user.id)
                ); // Unique users

            return {
                ...task,
                totalHours: Math.round(totalHours * 100) / 100,
                activeWorkers
            };
        }));

        res.json(enriched);
    } catch (error: any) {
        console.error('GET /tasks error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /tasks/:id - Obtener tarea
router.get('/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const task = await prisma.task.findFirst({
            where: {
                id: req.params.id,
                project: { organizationId }
            },
            include: {
                project: {
                    include: { client: true }
                },
                assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
                createdBy: { select: { id: true, name: true, email: true } },
                comments: {
                    include: {
                        user: { select: { id: true, name: true, avatar: true } }
                    },
                    orderBy: { createdAt: 'asc' }
                },
                timeLogs: {
                    include: {
                        user: { select: { id: true, name: true } }
                    },
                    orderBy: { start: 'desc' }
                },
                attachments: true
            }
        });

        if (!task) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        const totalHours = task.timeLogs.reduce((acc: number, log: any) => {
            if (log.end) {
                const hours = (log.end.getTime() - log.start.getTime()) / 3600000;
                return acc + hours;
            }
            return acc;
        }, 0);

        const activeWorkers = task.timeLogs
            .filter((log: any) => !log.end)
            .map((log: any) => log.user)
            .filter((user: any, index: number, self: any[]) =>
                index === self.findIndex((u: any) => u.id === user.id)
            );

        res.json({
            ...task,
            totalHours: Math.round(totalHours * 100) / 100,
            activeWorkers
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /tasks - Crear tarea
router.post('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { projectId, title, description, priority = 'MEDIUM', estimatedHours, dueDate, assignedToId, prLink, checklist } = req.body;

        if (!projectId || !title) {
            return res.status(400).json({ error: 'projectId y title requeridos' });
        }

        const project = await prisma.project.findFirst({
            where: { id: projectId, organizationId }
        });

        if (!project) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }

        if (assignedToId) {
            const isMember = await prisma.projectMember.findFirst({
                where: {
                    projectId,
                    userId: assignedToId
                }
            });

            if (!isMember) {
                return res.status(400).json({ error: 'El usuario no es miembro del proyecto' });
            }
        }

        const task = await prisma.task.create({
            data: {
                project: { connect: { id: projectId } },
                title,
                description,
                priority,
                estimatedHours,
                dueDate: dueDate ? new Date(dueDate) : null,
                assignedTo: assignedToId ? { connect: { id: assignedToId } } : undefined,
                createdBy: { connect: { id: req.user.id } },
                prLink,
                checklist
            },
            include: {
                project: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, name: true } }
            }
        });

        await logActivity({
            type: 'CREATED',
            description: `Tarea creada: ${title}`,
            organizationId,
            projectId,
            taskId: task.id,
            userId: req.user.id
        });

        // Notify assigned user if different from creator
        if (assignedToId && assignedToId !== req.user.id) {
            await createNotification({
                userId: assignedToId,
                organizationId,
                type: 'TASK',
                title: 'Nueva tarea asignada',
                body: `Se te ha asignado la tarea: ${title}`,
                data: { taskId: task.id, projectId }
            });
        }

        // Notify ADMIN users about new task creation
        const admins = await prisma.user.findMany({
            where: {
                memberships: { some: { organizationId } },
                role: 'ADMIN',
                id: { not: req.user.id } // Don't notify the creator
            }
        });

        for (const admin of admins) {
            await createNotification({
                userId: admin.id,
                organizationId,
                type: 'TASK',
                title: '🎫 Nuevo ticket creado',
                body: `${req.user.name} creó: ${title} en ${project.name}`,
                data: { taskId: task.id, projectId }
            });
        }

        res.status(201).json(task);
    } catch (error: any) {
        console.error('POST /tasks error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /tasks/:id - Actualizar tarea
router.put('/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { title, description, status, assignedToId, priority, estimatedHours, dueDate } = req.body;

        const task = await prisma.task.findFirst({
            where: {
                id: req.params.id,
                project: { organizationId }
            }
        });

        if (!task) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        const isCreator = task.createdById === req.user.id;
        const isAdminOrManager = req.user.role === 'ADMIN' || req.user.role === 'MANAGER';
        const isAssigned = task.assignedToId === req.user.id;
        const isSelfAssigning = assignedToId === req.user.id;

        if (!isCreator && !isAdminOrManager && !isAssigned && !isSelfAssigning) {
            return res.status(403).json({ error: 'Sin permisos para editar esta tarea' });
        }

        if (assignedToId !== undefined) {
            if (assignedToId) {
                const isMember = await prisma.projectMember.findFirst({
                    where: {
                        projectId: task.projectId,
                        userId: assignedToId
                    }
                });

                if (!isMember) {
                    return res.status(400).json({ error: 'El usuario no es miembro del proyecto' });
                }
            }
        }

        const oldStatus = task.status;
        const oldAssigned = task.assignedToId;

        const updated = await prisma.task.update({
            where: { id: req.params.id },
            data: {
                ...(title && { title }),
                ...(description !== undefined && { description }),
                ...(status && { status }),
                ...(assignedToId !== undefined && { assignedToId: assignedToId || null }),
                ...(priority && { priority }),
                ...(estimatedHours !== undefined && { estimatedHours }),
                ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
                ...(req.body.prLink !== undefined && { prLink: req.body.prLink }),
                ...(req.body.checklist !== undefined && { checklist: req.body.checklist })
            },
            include: {
                assignedTo: { select: { id: true, name: true } },
                project: { select: { id: true, name: true } }
            }
        });

        if (oldStatus !== updated.status) {
            await logActivity({
                type: 'STATUS_CHANGE',
                description: `Tarea ${updated.title} cambió de ${oldStatus} a ${updated.status}`,
                organizationId,
                projectId: task.projectId,
                taskId: task.id,
                userId: req.user.id
            });

            // If task has a linked CRM ticket and status changed to DONE, notify CRM
            if (updated.status === 'DONE' && task.crmTicketId) {
                try {
                    const crmUrl = process.env.CRM_API_URL ||
                        (process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : 'https://chronuscrm.assistai.work');
                    const syncKey = process.env.CRM_SYNC_KEY || 'dev-sync-key';

                    console.log(`[CRM Sync] Notifying CRM about task completion for ticket ${task.crmTicketId}`);

                    const crmResponse = await fetch(`${crmUrl}/webhooks/chronusdev/task-completed`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Sync-Key': syncKey
                        },
                        body: JSON.stringify({
                            ticketId: task.crmTicketId,
                            taskId: task.id,
                            taskTitle: task.title,
                            completedBy: req.user.name,
                            completedAt: new Date().toISOString()
                        })
                    });

                    if (crmResponse.ok) {
                        console.log(`[CRM Sync] Successfully notified CRM - ticket ${task.crmTicketId} marked as RESOLVED`);
                    } else {
                        const errorData = await crmResponse.json().catch(() => ({}));
                        console.error(`[CRM Sync] Failed to notify CRM:`, errorData);
                    }
                } catch (crmError) {
                    console.error(`[CRM Sync] Error notifying CRM:`, crmError);
                    // Don't fail the request if CRM notification fails
                }
            }
        }

        if (oldAssigned !== updated.assignedToId && updated.assignedToId) {
            await logActivity({
                type: 'ASSIGNMENT',
                description: `Tarea ${updated.title} asignada a ${updated.assignedTo?.name}`,
                organizationId,
                projectId: task.projectId,
                taskId: task.id,
                userId: req.user.id
            });

            await createNotification({
                userId: updated.assignedToId,
                organizationId,
                type: 'TASK',
                title: 'Tarea asignada',
                body: `Se te ha asignado la tarea: ${updated.title}`,
                data: { taskId: task.id, projectId: task.projectId }
            });
        }

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /tasks/:id - Eliminar tarea
router.delete('/:id', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const task = await prisma.task.findFirst({
            where: {
                id: req.params.id,
                project: { organizationId }
            }
        });

        if (!task) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        await prisma.task.delete({
            where: { id: req.params.id }
        });

        await logActivity({
            type: 'DELETED',
            description: `Tarea eliminada: ${task.title}`,
            organizationId,
            projectId: task.projectId,
            userId: req.user.id
        });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /tasks/:id/assign - Auto-asignar tarea
router.post('/:id/assign', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const task = await prisma.task.findFirst({
            where: {
                id: req.params.id,
                project: { organizationId }
            },
            include: {
                project: true
            }
        });

        if (!task) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        const isMember = await prisma.projectMember.findFirst({
            where: {
                projectId: task.projectId,
                userId: req.user.id
            }
        });

        if (!isMember) {
            return res.status(403).json({ error: 'No eres miembro de este proyecto' });
        }

        const updated = await prisma.task.update({
            where: { id: req.params.id },
            data: {
                assignedToId: req.user.id,
                status: task.status === 'BACKLOG' ? 'IN_PROGRESS' : task.status
            },
            include: {
                assignedTo: { select: { id: true, name: true } }
            }
        });

        await logActivity({
            type: 'ASSIGNMENT',
            description: `${req.user.name} tomó la tarea ${task.title}`,
            organizationId,
            projectId: task.projectId,
            taskId: task.id,
            userId: req.user.id
        });

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /tasks/:id/comments - Obtener comentarios
router.get('/:id/comments', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const task = await prisma.task.findFirst({
            where: {
                id: req.params.id,
                project: { organizationId }
            }
        });

        if (!task) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        const comments = await prisma.taskComment.findMany({
            where: { taskId: req.params.id },
            include: {
                user: { select: { id: true, name: true, avatar: true } }
            },
            orderBy: { createdAt: 'asc' }
        });

        res.json(comments);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Helper to notify CRM
async function notifyCRM(endpoint: string, data: any) {
    try {
        const crmUrl = process.env.CRM_API_URL ||
            (process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : 'https://chronuscrm.assistai.work');
        const syncKey = process.env.CRM_SYNC_KEY || 'dev-sync-key';

        // Don't await to avoid blocking
        fetch(`${crmUrl}/webhooks/chronusdev/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Key': syncKey
            },
            body: JSON.stringify(data)
        }).catch(err => console.error(`[CRM Sync] Error notifying ${endpoint}:`, err.message));
    } catch (error) {
        console.error(`[CRM Sync] Error preparing notification:`, error);
    }
}

// POST /tasks/:id/comments - Crear comentario
router.post('/:id/comments', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'content requerido' });
        }

        const task = await prisma.task.findFirst({
            where: {
                id: req.params.id,
                project: { organizationId }
            }
        });

        if (!task) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        const comment = await prisma.taskComment.create({
            data: {
                taskId: req.params.id,
                userId: req.user.id,
                content: content.trim()
            },
            include: {
                user: { select: { id: true, name: true, avatar: true } }
            }
        });

        await logActivity({
            type: 'COMMENT',
            description: `Comentario agregado a tarea ${task.title}`,
            organizationId,
            projectId: task.projectId,
            taskId: task.id,
            userId: req.user.id
        });

        if (task.assignedToId && task.assignedToId !== req.user.id) {
            await createNotification({
                userId: task.assignedToId,
                organizationId,
                type: 'TASK',
                title: 'Nuevo comentario',
                body: `${req.user.name} comentó en la tarea: ${task.title}`,
                data: { taskId: task.id, commentId: comment.id }
            });
        }

        // Notify CRM if linked
        if (task.crmTicketId) {
            notifyCRM('comment-added', {
                ticketId: task.crmTicketId,
                comment: {
                    id: comment.id,
                    content: comment.content,
                    authorName: req.user.name,
                    createdAt: comment.createdAt
                }
            });
        }

        res.status(201).json(comment);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /tasks/:id/attachments - Agregar adjunto
router.post('/:id/attachments', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { url, name, type, size } = req.body;

        if (!url || !name) {
            return res.status(400).json({ error: 'url y name requeridos' });
        }

        const task = await prisma.task.findFirst({
            where: {
                id: req.params.id,
                project: { organizationId }
            }
        });

        if (!task) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        const attachment = await prisma.taskAttachment.create({
            data: {
                taskId: task.id,
                url,
                name,
                type: type || 'unknown',
                size: size || 0
            }
        });

        // Add a system comment recording the attachment
        await prisma.taskComment.create({
            data: {
                taskId: task.id,
                userId: req.user.id,
                content: `[Adjunto] 📎 Archivo: [${name}](${url})`
            }
        });

        // Notify CRM if linked
        if (task.crmTicketId) {
            notifyCRM('attachment-added', {
                ticketId: task.crmTicketId,
                attachment: {
                    id: attachment.id,
                    name: attachment.name,
                    url: attachment.url,
                    type: attachment.type,
                    size: attachment.size
                }
            });
        }

        res.status(201).json(attachment);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
