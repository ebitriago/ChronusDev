import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';
import { sendEmail, emailTemplates } from '../email.js';

const router = Router();

// GET all tickets for organization
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user!.organizationId;
        const tickets = await prisma.ticket.findMany({
            where: { organizationId },
            include: {
                customer: true,
                assignedTo: { select: { id: true, name: true, avatar: true, email: true } },
                comments: {
                    include: { author: { select: { name: true, avatar: true } } },
                    orderBy: { createdAt: 'desc' }
                },
                attachments: true,
                tags: { include: { tag: true } }
            },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(tickets);
    } catch (e) {
        console.error("GET /tickets error:", e);
        res.status(500).json({ error: "Error fetching tickets" });
    }
});

// GET ticket details
router.get('/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;

        const ticket = await prisma.ticket.findFirst({
            where: { id, organizationId },
            include: {
                customer: true,
                assignedTo: { select: { id: true, name: true, avatar: true, email: true } },
                comments: {
                    include: { author: { select: { name: true, avatar: true } } },
                    orderBy: { createdAt: 'desc' }
                },
                attachments: true
            }
        });

        if (!ticket) return res.status(404).json({ error: "Ticket no encontrado" });

        res.json(ticket);
    } catch (e) {
        console.error("GET /tickets/:id error:", e);
        res.status(500).json({ error: "Error fetching ticket details" });
    }
});

// POST new ticket
router.post('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user!.organizationId;
        const { title, description, status, priority, customerId, assignedToId, tags } = req.body;

        // Normalization for Enums
        const safePriority = priority ? priority.toUpperCase() : undefined;
        const safeStatus = status ? status.toUpperCase() : undefined;

        let tagConnections: any = undefined;
        if (Array.isArray(tags) && tags.length > 0) {
            tagConnections = {
                create: tags.map((tagName: string) => ({
                    tag: {
                        connectOrCreate: {
                            where: {
                                name_organizationId: { name: tagName, organizationId }
                            },
                            create: {
                                name: tagName,
                                organizationId,
                                color: '#6B7280'
                            }
                        }
                    }
                }))
            };
        }

        const ticket = await prisma.ticket.create({
            data: {
                title,
                description,
                status: safeStatus,
                priority: safePriority,
                customerId,
                assignedToId,
                createdById: req.user!.id,
                organizationId,
                tags: tagConnections
            },
            include: { customer: true, assignedTo: true, tags: { include: { tag: true } } }
        });

        // Notify assignee if not assigning to self
        if (assignedToId && assignedToId !== req.user!.id) {
            await prisma.notification.create({
                data: {
                    userId: assignedToId,
                    organizationId,
                    type: 'TICKET',
                    title: 'New Ticket Assigned',
                    body: `You have been assigned to ticket #${ticket.id}: ${title}`,
                    data: { ticketId: ticket.id, action: 'view' }
                }
            });

            // Emit Socket Event
            const io = req.app.get('io');
            if (io) {
                io.to(`user_${assignedToId}`).emit('notification', {
                    id: 'temp-' + Date.now(),
                    userId: assignedToId,
                    type: 'TICKET',
                    title: 'New Ticket Assigned',
                    body: `You have been assigned to ticket #${ticket.id}: ${title}`,
                    read: false,
                    createdAt: new Date().toISOString()
                });
            }

            // Send Email
            const assignee = ticket.assignedTo;
            if (assignee && assignee.email) {
                await sendEmail({
                    to: assignee.email,
                    ...emailTemplates.ticketUpdate(title, safeStatus || 'OPEN', `New ticket assigned to you.`)
                });
            }
        }

        res.status(201).json(ticket);
    } catch (e) {
        console.error("POST /tickets error:", e);
        res.status(500).json({ error: "Error creating ticket" });
    }
});

// PUT update ticket (Assignment Logic Here)
router.put('/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;
        const { status, priority, assignedToId, description, title, dueDate, tags } = req.body;

        // Get current ticket to check changes
        const currentTicket = await prisma.ticket.findUnique({
            where: { id },
            select: { assignedToId: true, title: true, status: true }
        });

        if (!currentTicket) return res.status(404).json({ error: 'Ticket not found' });

        const updateData: any = {};
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (status) {
            updateData.status = status;
            if (status === "RESOLVED") updateData.resolvedAt = new Date();
        }
        if (priority) updateData.priority = priority;
        if (dueDate) updateData.dueDate = new Date(dueDate);

        // CRITICAL: Handle assignedToId properly to avoid FK constraint errors
        // Only set if it's a valid non-empty string, otherwise set to null to unassign
        if (assignedToId !== undefined) {
            updateData.assignedToId = (assignedToId && assignedToId.trim()) ? assignedToId : null;
        }

        if (Array.isArray(tags)) {
            // Delete existing tags
            await prisma.ticketTag.deleteMany({
                where: { ticketId: id }
            });

            updateData.tags = {
                create: tags.map((tagName: string) => ({
                    tag: {
                        connectOrCreate: {
                            where: {
                                name_organizationId: { name: tagName, organizationId }
                            },
                            create: {
                                name: tagName,
                                organizationId,
                                color: '#6B7280'
                            }
                        }
                    }
                }))
            };
        }

        const ticket = await prisma.ticket.update({
            where: { id, organizationId } as any,
            data: updateData,
            include: { customer: true, assignedTo: true, tags: { include: { tag: true } } }
        });

        // Notify ChronusDev if status changed
        if (status && status !== currentTicket.status) {
            notifyChronusDev('ticket-status-changed', {
                ticketId: ticket.id,
                oldStatus: currentTicket.status,
                newStatus: status
            });
        }

        // Check for assignment change
        if (assignedToId && assignedToId !== currentTicket.assignedToId && assignedToId !== req.user!.id) {
            await prisma.notification.create({
                data: {
                    userId: assignedToId,
                    organizationId,
                    type: 'TICKET',
                    title: 'Ticket Assigned to You',
                    body: `You have been assigned to ticket: ${ticket.title}`,
                    data: { ticketId: ticket.id }
                }
            });

            // Emit Socket Event
            const io = req.app.get('io');
            if (io) {
                io.to(`user_${assignedToId}`).emit('notification', {
                    id: 'temp-' + Date.now(),
                    userId: assignedToId,
                    type: 'TICKET',
                    title: 'Ticket Assigned to You',
                    body: `You have been assigned to ticket: ${ticket.title}`,
                    read: false,
                    createdAt: new Date().toISOString()
                });
            }

            // Send Email
            const assignee = ticket.assignedTo;
            if (assignee && assignee.email) {
                await sendEmail({
                    to: assignee.email,
                    ...emailTemplates.ticketUpdate(ticket.title, ticket.status, `You have been assigned to this ticket.`)
                });
            }
            console.log(`[Notification] Created for user ${assignedToId} (Ticket Assignment)`);
        }

        res.json(ticket);
    } catch (e) {
        console.error("PUT /tickets/:id error:", e);
        res.status(500).json({ error: "Error updating ticket" });
    }
});

// DELETE ticket
router.delete('/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        await prisma.ticket.delete({
            where: { id: req.params.id, organizationId } as any
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Error deleting ticket" });
    }
});

// POST /tickets/:id/send-to-chronusdev
router.post('/:id/send-to-chronusdev', authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user!.organizationId;

        // Get ticket with ALL related data
        const ticket = await prisma.ticket.findUnique({
            where: { id },
            include: {
                customer: true,
                assignedTo: { select: { id: true, name: true, email: true } },
                comments: {
                    include: { author: { select: { name: true } } },
                    orderBy: { createdAt: 'asc' }
                },
                attachments: true
            }
        });

        if (!ticket) {
            return res.status(404).json({ error: 'Ticket no encontrado' });
        }

        // Call ChronusDev webhook
        const chronusDevUrl = process.env.CHRONUSDEV_API_URL ||
            (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : 'https://chronusdev.assistai.work/api');
        const syncKey = process.env.CRM_SYNC_KEY || 'chronus-sync-key';

        console.log(`[ChronusDev Sync] Using key: ${syncKey.substring(0, 4)}...`);

        console.log(`[ChronusDev] Sending Ticket ${id} with full data to ${chronusDevUrl}/webhooks/crm/ticket-created`);

        // ... logging skipped for brevity ...

        let response;
        try {
            response = await fetch(`${chronusDevUrl}/webhooks/crm/ticket-created`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Sync-Key': syncKey
                },
                body: JSON.stringify({
                    ticket: {
                        id: ticket.id,
                        title: ticket.title,
                        description: ticket.description,
                        priority: ticket.priority,
                        status: ticket.status,
                        dueDate: ticket.dueDate
                    },
                    customer: ticket.customer ? {
                        id: ticket.customer.id,
                        name: ticket.customer.name,
                        email: ticket.customer.email,
                        company: ticket.customer.company
                    } : null,
                    assignee: ticket.assignedTo ? {
                        id: ticket.assignedTo.id,
                        name: ticket.assignedTo.name,
                        email: ticket.assignedTo.email
                    } : null,
                    comments: ticket.comments?.map((c: any) => ({
                        id: c.id,
                        content: c.content,
                        authorId: c.authorId,
                        authorName: c.author?.name || 'Usuario CRM', // Use relation name
                        createdAt: c.createdAt,
                        isInternal: c.isInternal
                    })) || [],
                    attachments: ticket.attachments?.map((a: any) => ({
                        id: a.id,
                        name: a.name,
                        url: a.url,
                        type: a.type,
                        size: a.size
                    })) || [],
                    organizationId
                })
            });

            const result = await response.json();

            if (!response.ok) {
                console.error('[ChronusDev] Error:', result);
                return res.status(response.status).json({ error: result.error || 'Error enviando a ChronusDev' });
            }

            // Log activity
            await prisma.ticket.update({
                where: { id },
                data: {
                    status: 'IN_PROGRESS',
                    activities: {
                        create: {
                            type: 'SYSTEM',
                            description: `Ticket enviado a ChronusDev (Task ID: ${result.taskId})`,
                            userId: req.user.id,
                            organizationId,
                            customerId: ticket.customerId || '',
                            metadata: { chronusDevTaskId: result.taskId }
                        }
                    }
                }
            });

            console.log(`[ChronusDev] Ticket ${id} synced successfully. Task ID: ${result.taskId}`);
            res.json({ success: true, message: 'Enviado a desarrollo correctamente', taskId: result.taskId });
        } catch (fetchError: any) {
            console.error('[ChronusDev] Network/fetch error:', fetchError.message);
            console.error('[ChronusDev] Full error:', fetchError);
            res.status(500).json({ error: `Error de conexión con ChronusDev: ${fetchError.message}` });
        }
    } catch (e: any) {
        console.error("POST send-to-chronusdev error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Helper to notify ChronusDev
async function notifyChronusDev(endpoint: string, data: any) {
    try {
        const chronusDevUrl = process.env.CHRONUSDEV_API_URL ||
            (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : 'https://chronusdev.assistai.work/api');
        const syncKey = process.env.CRM_SYNC_KEY || 'chronus-sync-key';

        fetch(`${chronusDevUrl}/webhooks/crm/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Key': syncKey
            },
            body: JSON.stringify(data)
        }).catch(err => console.error(`[ChronusDev Sync] Error notifying ${endpoint}:`, err.message));

    } catch (error) {
        console.error(`[ChronusDev Sync] Error preparing notification:`, error);
    }
}

// POST /tickets/:id/comments
router.post('/:id/comments', authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { content, isInternal } = req.body;
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        const ticket = await prisma.ticket.findUnique({
            where: { id },
            include: { assignedTo: true }
        });

        if (!ticket) return res.status(404).json({ error: "Ticket not found" });

        const comment = await prisma.ticketComment.create({
            data: {
                ticketId: id,
                content,
                isInternal: isInternal || false,
                authorId: userId
            },
            include: { author: { select: { name: true, avatar: true } } }
        });

        // Notify Assignee (if not the commenter)
        if (ticket.assignedToId && ticket.assignedToId !== userId) {
            await prisma.notification.create({
                data: {
                    userId: ticket.assignedToId,
                    organizationId,
                    type: 'TICKET',
                    title: `New Comment on Ticket #${ticket.id}`,
                    body: `${req.user.name} commented: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
                    data: { ticketId: ticket.id, action: 'view' }
                }
            });

            const io = req.app.get('io');
            if (io) {
                io.to(`user_${ticket.assignedToId}`).emit('notification', {
                    id: 'temp-' + Date.now(),
                    userId: ticket.assignedToId,
                    type: 'TICKET',
                    title: `New Comment on Ticket #${ticket.id}`,
                    body: `${req.user.name} commented: "${content.substring(0, 50)}..."`,
                    read: false,
                    data: { ticketId: ticket.id },
                    createdAt: new Date().toISOString()
                });
            }
        }

        // Notify ChronusDev if it's not an internal note
        if (!isInternal) {
            notifyChronusDev('comment-added', {
                ticketId: id,
                comment: {
                    id: comment.id,
                    content: comment.content,
                    authorName: req.user.name,
                    createdAt: comment.createdAt
                }
            });
        }

        res.status(201).json(comment);
    } catch (e: any) {
        console.error("POST /tickets/:id/comments error:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST /tickets/:id/attachments
router.post('/:id/attachments', authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { url, name, type, size } = req.body;

        const attachment = await prisma.ticketAttachment.create({
            data: {
                ticketId: id,
                url,
                name,
                type: type || 'unknown',
                size: size || 0
            }
        });

        // Notify ChronusDev
        notifyChronusDev('attachment-added', {
            ticketId: id,
            attachment: {
                id: attachment.id,
                name: attachment.name,
                url: attachment.url,
                type: attachment.type
            }
        });

        res.status(201).json(attachment);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export const ticketsRouter = router;
