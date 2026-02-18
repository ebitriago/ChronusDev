// Webhook endpoints to receive notifications from ChronusDev
import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';

const router = Router();

// Validate sync key
function validateSyncKey(req: any, res: any, next: any) {
    const key = req.headers['x-sync-key'] || req.headers['x-api-key'];
    const syncKey = process.env.CRM_SYNC_KEY || 'dev-sync-key';

    if (key !== syncKey) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

/**
 * POST /webhooks/chronusdev/ticket-received
 * Called by ChronusDev immediately after receiving a ticket from CRM
 * Sends real-time notification to CRM UI
 */
router.post('/ticket-received', validateSyncKey, async (req: Request, res: Response) => {
    try {
        const { ticketId, taskId, projectName, receivedAt } = req.body;

        if (!ticketId) {
            return res.status(400).json({ error: 'ticketId required' });
        }

        console.log(`[ChronusDev Webhook] Ticket ${ticketId} received by Dev as Task ${taskId}`);

        // Find the ticket
        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: { assignedTo: true }
        });

        if (!ticket) {
            console.warn(`[ChronusDev Webhook] Ticket ${ticketId} not found`);
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Create notification for ticket assignee
        if (ticket.assignedToId) {
            await prisma.notification.create({
                data: {
                    userId: ticket.assignedToId,
                    organizationId: ticket.organizationId,
                    type: 'TICKET',
                    title: '📥 Ticket recibido por Desarrollo',
                    body: `El ticket "${ticket.title}" fue recibido por el equipo de desarrollo.`,
                    data: { ticketId: ticket.id, taskId }
                }
            });
        }

        // Emit real-time Socket.io event
        const io = req.app.get('io');
        if (io) {
            // Notify specific user
            if (ticket.assignedToId) {
                io.to(`user_${ticket.assignedToId}`).emit('notification', {
                    id: 'temp-' + Date.now(),
                    type: 'TICKET',
                    title: '📥 Ticket recibido por Desarrollo',
                    body: `El ticket "${ticket.title}" fue recibido.`,
                    read: false,
                    createdAt: new Date().toISOString()
                });
            }

            // Broadcast ticket update to organization
            io.to(`org_${ticket.organizationId}`).emit('ticket.received-by-dev', {
                ticketId: ticket.id,
                taskId,
                projectName,
                receivedAt: receivedAt || new Date().toISOString()
            });
        }

        res.json({ success: true, message: 'Notification sent' });

    } catch (error: any) {
        console.error('[ChronusDev Webhook] ticket-received error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /webhooks/chronusdev/task-completed
 * Called by ChronusDev when a task linked to a CRM ticket is completed
 */
router.post('/task-completed', validateSyncKey, async (req: Request, res: Response) => {
    try {
        const { ticketId, taskId, taskTitle, completedBy, completedAt } = req.body;

        if (!ticketId) {
            return res.status(400).json({ error: 'ticketId required' });
        }

        console.log(`[ChronusDev Webhook] Task ${taskId} completed for ticket ${ticketId}`);

        // Find the ticket
        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
                assignedTo: true,
                createdBy: true
            }
        });

        if (!ticket) {
            console.warn(`[ChronusDev Webhook] Ticket ${ticketId} not found`);
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Update ticket status to RESOLVED
        const updated = await prisma.ticket.update({
            where: { id: ticketId },
            data: {
                status: 'RESOLVED',
                resolvedAt: new Date()
            }
        });

        // Log activity
        await prisma.activity.create({
            data: {
                type: 'SYSTEM',
                description: `Ticket resuelto automáticamente - Tarea completada en ChronusDev (${taskTitle || taskId})`,
                organizationId: ticket.organizationId,
                customerId: ticket.customerId || '',
                userId: ticket.createdById || 'system'
            }
        });

        // Create notification for ticket assignee
        if (ticket.assignedToId) {
            await prisma.notification.create({
                data: {
                    userId: ticket.assignedToId,
                    organizationId: ticket.organizationId,
                    type: 'TICKET',
                    title: '✅ Tarea completada en desarrollo',
                    body: `El ticket "${ticket.title}" ha sido resuelto. La tarea de desarrollo fue completada.`,
                    data: { ticketId: ticket.id, taskId }
                }
            });

            // Emit socket event for real-time notification
            const io = req.app.get('io');
            if (io) {
                io.to(`user_${ticket.assignedToId}`).emit('notification', {
                    id: 'temp-' + Date.now(),
                    type: 'TICKET',
                    title: '✅ Tarea completada en desarrollo',
                    body: `El ticket "${ticket.title}" ha sido resuelto.`,
                    read: false,
                    createdAt: new Date().toISOString()
                });

                // Also emit ticket update
                io.to(`org_${ticket.organizationId}`).emit('ticket.updated', {
                    ticket: updated
                });
            }
        }

        // Also notify the ticket creator if different from assignee
        if (ticket.createdById && ticket.createdById !== ticket.assignedToId) {
            await prisma.notification.create({
                data: {
                    userId: ticket.createdById,
                    organizationId: ticket.organizationId,
                    type: 'TICKET',
                    title: '✅ Ticket resuelto',
                    body: `Tu ticket "${ticket.title}" ha sido resuelto por el equipo de desarrollo.`,
                    data: { ticketId: ticket.id }
                }
            });
        }

        console.log(`[ChronusDev Webhook] Ticket ${ticketId} marked as RESOLVED`);

        res.json({
            success: true,
            message: 'Ticket updated successfully',
            ticketId: ticket.id,
            newStatus: 'RESOLVED'
        });

    } catch (error: any) {
        console.error('[ChronusDev Webhook] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /webhooks/chronusdev/task-status-changed
 * Called by ChronusDev when a task status changes (optional for future use)
 */
router.post('/task-status-changed', validateSyncKey, async (req: Request, res: Response) => {
    try {
        const { ticketId, taskId, oldStatus, newStatus } = req.body;

        if (!ticketId) {
            return res.json({ success: true, message: 'No ticketId, skipping' });
        }

        console.log(`[ChronusDev Webhook] Task ${taskId} status: ${oldStatus} → ${newStatus}`);

        // Map task status to ticket status
        const statusMap: Record<string, string> = {
            'IN_PROGRESS': 'IN_PROGRESS',
            'REVIEW': 'IN_PROGRESS',
            'DONE': 'RESOLVED'
        };

        const newTicketStatus = statusMap[newStatus];

        if (!newTicketStatus) {
            return res.json({ success: true, message: 'Status not mapped' });
        }

        await prisma.ticket.update({
            where: { id: ticketId },
            data: {
                status: newTicketStatus as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
                ...(newTicketStatus === 'RESOLVED' && { resolvedAt: new Date() })
            }
        });

        res.json({ success: true, ticketId, newStatus: newTicketStatus });

    } catch (error: any) {
        console.error('[ChronusDev Webhook] Status change error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /webhooks/chronusdev/comment-added
 * Called by ChronusDev when a comment is added to a linked task
 */
router.post('/comment-added', validateSyncKey, async (req: Request, res: Response) => {
    try {
        const { ticketId, comment } = req.body;

        if (!ticketId || !comment) {
            return res.status(400).json({ error: 'ticketId and comment required' });
        }

        console.log(`[ChronusDev Webhook] Received comment for ticket ${ticketId}`);

        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        // Add comment to ticket
        // Use assignee as fallback author, otherwise find an admin or leave null
        let authorId = ticket.assignedToId;

        if (!authorId) {
            // Try to find an admin in the org to attribute it to (better than null)
            const admin = await prisma.organizationMember.findFirst({
                where: { organizationId: ticket.organizationId, role: 'ADMIN' }
            });
            if (admin) authorId = admin.userId;
        }

        // Format content with attribution
        const content = `[Dev - ${comment.authorName || 'Desarrollo'}]: ${comment.content}`;

        const newComment = await prisma.ticketComment.create({
            data: {
                ticketId,
                content,
                isInternal: false,
                // If we still have no authorId, pass null (valid per schema: String?)
                // Do NOT pass 'system' as it will fail FK constraint
                authorId: authorId || undefined,
            }
        });

        // Emit ticket update to refresh UI
        const io = req.app.get('io');
        if (io) {
            io.to(`org_${ticket.organizationId}`).emit('ticket.updated', { ticket });
        }

        // Notify assignee about the new comment
        if (ticket.assignedToId) {
            const notification = await prisma.notification.create({
                data: {
                    userId: ticket.assignedToId,
                    organizationId: ticket.organizationId,
                    type: 'TICKET',
                    title: '💬 Nuevo comentario de Desarrollo',
                    body: `${comment.authorName || 'Dev'} comentó en "${ticket.title}": ${comment.content.substring(0, 50)}...`,
                    data: { ticketId: ticket.id, action: 'view' },
                    read: false
                }
            });

            if (io) {
                io.to(`user_${ticket.assignedToId}`).emit('notification', notification);
            }
        }

        res.json({ success: true, commentId: newComment.id });
    } catch (error: any) {
        console.error('[ChronusDev Webhook] Error adding comment:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /webhooks/chronusdev/attachment-added
 * Called by ChronusDev when an attachment is added to a linked task
 */
router.post('/attachment-added', validateSyncKey, async (req: Request, res: Response) => {
    try {
        const { ticketId, attachment } = req.body;

        if (!ticketId || !attachment) {
            return res.status(400).json({ error: 'ticketId and attachment required' });
        }

        console.log(`[ChronusDev Webhook] Received attachment for ticket ${ticketId}`);

        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const newAttachment = await prisma.ticketAttachment.create({
            data: {
                ticketId,
                name: attachment.name,
                url: attachment.url,
                type: attachment.type,
                size: attachment.size
            }
        });

        // Add a comment mentioning the attachment
        // Handle authorId safely
        let authorId = ticket.assignedToId;
        if (!authorId) {
            const admin = await prisma.organizationMember.findFirst({
                where: { organizationId: ticket.organizationId, role: 'ADMIN' }
            });
            if (admin) authorId = admin.userId;
        }

        const content = `[Dev Adjunto] 📎 Archivo: [${attachment.name}](${attachment.url})`;
        await prisma.ticketComment.create({
            data: {
                ticketId,
                content,
                isInternal: false,
                authorId: authorId || undefined
            }
        });

        // Emit ticket update to refresh UI
        const io = req.app.get('io');
        if (io) {
            io.to(`org_${ticket.organizationId}`).emit('ticket.updated', { ticket });
        }

        // Notify assignee about the new attachment
        if (ticket.assignedToId) {
            const notification = await prisma.notification.create({
                data: {
                    userId: ticket.assignedToId,
                    organizationId: ticket.organizationId,
                    type: 'TICKET',
                    title: '📎 Nuevo adjunto de Desarrollo',
                    body: `${attachment.name} fue adjuntado al ticket "${ticket.title}".`,
                    data: { ticketId: ticket.id, action: 'view' },
                    read: false
                }
            });

            if (io) {
                io.to(`user_${ticket.assignedToId}`).emit('notification', notification);
            }
        }

        res.json({ success: true, attachmentId: newAttachment.id });
    } catch (error: any) {
        console.error('[ChronusDev Webhook] Error adding attachment:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /webhooks/chronusdev/chat-message
 * Receive a direct chat message from a ChronusDev user (Dev -> CRM Inbox)
 */
router.post('/chat-message', validateSyncKey, async (req: Request, res: Response) => {
    try {
        const { userId, userName, content, organizationId } = req.body;

        if (!userId || !content || !organizationId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log(`[ChronusDev Webhook] Chat message from ${userName} (${userId})`);

        // Find linked CRM organization
        let crmOrg = await prisma.organization.findFirst({
            where: {
                OR: [
                    { id: organizationId },
                    // Add more lookup logic here if needed (e.g. custom field)
                ]
            }
        });

        // ⚠️ FALLBACK for Development / mismatched environments
        // If Org is not found or is the hardcoded Dev Org ID, try smarter fallback
        if (organizationId === 'cmleei6hy00022akm9uerlxo5' || !crmOrg) {
            console.warn(`[ChronusDev Webhook] Org ${organizationId} not found in CRM. Attempting fallback.`);

            const FALLBACK_ID = 'cmlfhy7yc0004sathmv36wae5'; // Org de Assistai (Legacy)

            // 1. Try known legacy ID
            crmOrg = await prisma.organization.findUnique({ where: { id: FALLBACK_ID } });

            // 2. Fallback to FIRST available organization (safest for single-tenant / reset DBs)
            if (!crmOrg) {
                crmOrg = await prisma.organization.findFirst({
                    orderBy: { createdAt: 'asc' }
                });
                if (crmOrg) {
                    console.log(`[ChronusDev Webhook] Fallback successful: Using Org "${crmOrg.name}" (${crmOrg.id})`);
                }
            }
        }

        if (!crmOrg) {
            console.error(`[ChronusDev Webhook] CRM Org not found and fallback failed.`);
            return res.status(404).json({ error: 'Organization not found' });
        }

        const targetOrgId = crmOrg.id;

        // Create or Update Query for Conversation
        // Session ID will be `dev-${userId}` to keep it persistent for the user
        const sessionId = `dev-${userId}`;

        let conversation = await prisma.conversation.findUnique({
            where: { sessionId }
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    sessionId,
                    platform: 'WEB', // Treat usage from Dev portal as "Web" chat
                    customerName: userName,
                    customerContact: `dev-${userId}`, // Virtual contact info
                    status: 'ACTIVE',
                    organizationId: targetOrgId,
                    metadata: {
                        source: 'chronusdev',
                        chronusDevUserId: userId,
                        chronusDevOrgId: organizationId
                    }
                }
            });
        } else {
            // Re-activate if resolved
            if (conversation.status !== 'ACTIVE') {
                await prisma.conversation.update({
                    where: { id: conversation.id },
                    data: { status: 'ACTIVE' }
                });
            }
            // Ensure org is updated if changed
            if (conversation.organizationId !== targetOrgId) {
                await prisma.conversation.update({
                    where: { id: conversation.id },
                    data: { organizationId: targetOrgId }
                });
            }
        }

        // Add Message
        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                content,
                sender: 'USER',
                senderName: userName,
                status: 'SENT'
            }
        });

        // Emit to CRM UI (Inbox)
        const io = req.app.get('io');
        if (io) {
            const messageObj = {
                id: message.id,
                sessionId,
                from: userName,
                content,
                platform: 'web',
                sender: 'user',
                timestamp: message.createdAt,
                status: 'sent'
            };

            console.log(`[ChronusDev Webhook] Emitting to room org_${targetOrgId}`);
            io.to(`org_${targetOrgId}`).emit('inbox_update', {
                sessionId,
                message: messageObj
            });

            // If there's a specific room for this session (e.g. open chat window)
            io.to(sessionId).emit('new_message', messageObj);
        }

        res.json({ success: true, messageId: message.id });

    } catch (error: any) {
        console.error('[ChronusDev Webhook] Chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
