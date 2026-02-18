// Webhooks para recibir sincronizaciones del CRM
import { Router } from 'express';
import { prisma } from '../../db.js';
import { syncClientFromCRM, syncUserFromCRM } from '../../services/crm-sync.js';
import { logActivity } from '../../activity.js';
import { createNotification } from '../../notifications.js';

const router = Router();

function validateSyncKey(req: any, res: any, next: any) {
    const key = req.headers['x-api-key'] || req.headers['x-sync-key'];
    const expectedKey = process.env.CRM_SYNC_KEY || 'chronus-sync-key';

    if (key !== expectedKey) {
        console.error(`[Webhook Auth Fail] Received: ${key ? key.toString().substring(0, 4) + '...' : 'none'}, Expected: ${expectedKey.substring(0, 4)}...`);
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// POST /webhooks/crm/customer-created
router.post('/customer-created', validateSyncKey, async (req, res) => {
    try {
        const { customer, organizationId } = req.body;
        const client = await syncClientFromCRM(customer, organizationId);
        res.json({ success: true, clientId: client.id });
    } catch (error: any) {
        console.error('[Webhook] Error syncing customer:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /webhooks/crm/customer-updated
router.post('/customer-updated', validateSyncKey, async (req, res) => {
    try {
        const { customer, organizationId } = req.body;
        const client = await syncClientFromCRM(customer, organizationId);
        res.json({ success: true, clientId: client.id });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /webhooks/crm/ticket-created
router.post('/ticket-created', validateSyncKey, async (req, res) => {
    try {
        const { ticket, customer, organizationId: crmOrganizationId } = req.body;

        // CRITICAL: First look for a ChronusDev organization LINKED to this CRM organization
        let org = await prisma.organization.findFirst({
            where: { crmOrganizationId: crmOrganizationId }
        });

        // Use the ChronusDev org ID for all operations, not the CRM ID
        let organizationId: string;

        if (org) {
            organizationId = org.id;
            console.log(`[Webhook] Found linked ChronusDev org: ${org.name} (${org.id}) for CRM org ${crmOrganizationId}`);
        } else {
            // Fallback: check if org exists with exact CRM ID (legacy behavior)
            org = await prisma.organization.findUnique({
                where: { id: crmOrganizationId }
            });

            if (!org) {
                console.log(`[Webhook] No linked organization found for CRM org ${crmOrganizationId}, creating new one...`);
                org = await prisma.organization.create({
                    data: {
                        id: crmOrganizationId,
                        name: customer.company || 'Organización CRM',
                        slug: `crm-${crmOrganizationId.slice(-8)}`,
                        crmOrganizationId: crmOrganizationId, // Self-link for future reference
                    }
                });
                console.log(`[Webhook] Created organization: ${org.name}`);
            }
            organizationId = org.id;
        }

        let client = await prisma.client.findFirst({
            where: { crmCustomerId: customer.id }
        });

        if (!client) {
            client = await syncClientFromCRM(customer, organizationId);
        }

        // Buscar proyecto por defecto del cliente o crear uno
        let project = await prisma.project.findFirst({
            where: {
                organizationId,
                clientId: client.id,
                name: { contains: 'Soporte' }
            }
        });

        if (!project) {
            project = await prisma.project.create({
                data: {
                    name: `Soporte ${client.name}`,
                    description: `Proyecto automático para gestión de tickets de ${client.name}`,
                    clientId: client.id,
                    organizationId,
                    budget: 0,
                    status: 'ACTIVE'
                }
            });
            console.log(`[Webhook] Created project ${project.name}`);
        }

        // Ensure org admins/managers are project members so they can take tasks
        const orgMembers = await prisma.organizationMember.findMany({
            where: {
                organizationId,
                role: { in: ['ADMIN', 'MANAGER'] }
            },
            select: { userId: true }
        });

        for (const member of orgMembers) {
            await prisma.projectMember.upsert({
                where: {
                    projectId_userId: {
                        projectId: project.id,
                        userId: member.userId
                    }
                },
                create: {
                    projectId: project.id,
                    userId: member.userId,
                    role: 'ADMIN'
                },
                update: {} // No update needed, just ensure exists
            }).catch(() => { }); // Ignore errors
        }

        // Verificar si la tarea ya existe
        const existingTask = await prisma.task.findFirst({
            where: { crmTicketId: ticket.id }
        });

        if (existingTask) {
            return res.json({ success: true, taskId: existingTask.id, message: 'Task already exists' });
        }

        // Buscar usuario asignado por email
        let assignedToId = null;
        if (req.body.assignee && req.body.assignee.email) {
            const user = await prisma.user.findUnique({
                where: { email: req.body.assignee.email }
            });
            if (user) assignedToId = user.id;
        }

        // Find or create a system user for this organization
        let systemUser = await prisma.user.findFirst({
            where: {
                memberships: { some: { organizationId } },
                role: 'ADMIN'
            }
        });

        if (!systemUser) {
            // Try to find any user in the org
            systemUser = await prisma.user.findFirst({
                where: { memberships: { some: { organizationId } } }
            });
        }

        if (!systemUser) {
            // Create a system user for this org
            console.log(`[Webhook] Creating system user for org ${organizationId}`);
            systemUser = await prisma.user.create({
                data: {
                    email: `system-${organizationId.slice(-8)}@chronusdev.local`,
                    name: 'Sistema CRM',
                    role: 'ADMIN',
                    memberships: {
                        create: {
                            organizationId,
                            role: 'ADMIN',
                            defaultPayRate: 0
                        }
                    }
                }
            });
        }

        // Crear tarea
        const task = await prisma.task.create({
            data: {
                title: `[TICKET] ${ticket.title}`,
                description: ticket.description || '',
                projectId: project.id,
                crmTicketId: ticket.id,
                status: 'BACKLOG',
                priority: ticket.priority || 'MEDIUM',
                createdById: systemUser.id,
                assignedToId,
                dueDate: ticket.dueDate ? new Date(ticket.dueDate) : null,

                // Crear comentarios iniciales
                comments: req.body.comments && req.body.comments.length > 0 ? {
                    create: req.body.comments.map((c: any) => ({
                        content: `[${c.authorName}] ${c.content}`,
                        userId: systemUser.id, // Usar el usuario del sistema creado arriba
                        createdAt: new Date(c.createdAt)
                    }))
                } : undefined,

                // Crear adjuntos
                attachments: req.body.attachments && req.body.attachments.length > 0 ? {
                    create: req.body.attachments.map((a: any) => ({
                        name: a.name,
                        url: a.url,
                        type: a.type,
                        size: a.size || 0
                    }))
                } : undefined
            }
        });

        await logActivity({
            type: 'CREATED',
            description: `Tarea creada desde ticket del CRM: ${ticket.title} (con ${req.body.attachments?.length || 0} adjuntos)`,
            organizationId,
            projectId: project.id,
            taskId: task.id,
            metadata: { source: 'crm', crmTicketId: ticket.id }
        });

        // NOTIFY ADMINS: New Ticket Received
        try {
            const adminsToNotify = await prisma.organizationMember.findMany({
                where: {
                    organizationId,
                    role: { in: ['ADMIN', 'MANAGER'] }
                },
                select: { userId: true }
            });

            for (const admin of adminsToNotify) {
                await createNotification({
                    userId: admin.userId,
                    organizationId,
                    type: 'TICKET',
                    title: '🎫 Nuevo Ticket del CRM',
                    body: `Ticket #${ticket.id}: ${ticket.title}`,
                    data: {
                        taskId: task.id,
                        ticketId: ticket.id,
                        link: `/tasks/${task.id}` // Frontend will use this to redirect
                    }
                });
            }
            console.log(`[Webhook] Notified ${adminsToNotify.length} admins about new ticket`);
        } catch (notifError: any) {
            console.error('[Webhook] Error sending notifications:', notifError);
        }

        // Notify CRM that ticket was received (async, don't block response)
        const crmApiUrl = process.env.CRM_API_URL ||
            (process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : 'https://chronuscrm.assistai.work');
        const syncKey = process.env.CRM_SYNC_KEY || 'dev-sync-key';

        fetch(`${crmApiUrl}/webhooks/chronusdev/ticket-received`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Key': syncKey
            },
            body: JSON.stringify({
                ticketId: ticket.id,
                taskId: task.id,
                projectName: project.name,
                receivedAt: new Date().toISOString()
            })
        }).then(r => {
            if (r.ok) console.log(`[Webhook] CRM notified: ticket ${ticket.id} received`);
            else console.warn(`[Webhook] CRM notification failed: ${r.status}`);
        }).catch(err => {
            console.warn(`[Webhook] Could not notify CRM:`, err.message);
        });

        res.json({ success: true, taskId: task.id });
    } catch (error: any) {
        console.error('[Webhook] Error syncing ticket:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// BIDIRECTIONAL SYNC ENDPOINTS (CRM → Dev)
// ============================================

/**
 * POST /webhooks/crm/comment-added
 * Receive a comment from CRM and add it to the linked task
 */
router.post('/comment-added', validateSyncKey, async (req, res) => {
    try {
        const { ticketId, comment } = req.body;

        if (!ticketId || !comment) {
            return res.status(400).json({ error: 'ticketId and comment required' });
        }

        console.log(`[Webhook] Received comment for ticket ${ticketId}`);

        // Find the task linked to this ticket
        const task = await prisma.task.findFirst({
            where: { crmTicketId: ticketId },
            include: { project: true } // Include project to get organizationId
        });

        if (!task) {
            console.warn(`[Webhook] No task found for ticket ${ticketId}`);
            return res.status(404).json({ error: 'Task not found for this ticket' });
        }

        // Find or create system user for CRM comments
        let systemUser = await prisma.user.findFirst({
            where: { email: 'crm-sync@system.local' }
        });

        if (!systemUser) {
            // Use first admin user as fallback
            const membership = await prisma.organizationMember.findFirst({
                where: { role: 'ADMIN' },
                include: { user: true }
            });
            systemUser = membership?.user || null;
        }

        if (!systemUser) {
            return res.status(500).json({ error: 'No system user available' });
        }

        // Create the comment on the task
        const taskComment = await prisma.taskComment.create({
            data: {
                taskId: task.id,
                userId: systemUser.id,
                content: `[CRM - ${comment.authorName || 'Soporte'}]: ${comment.content}`
            }
        });

        console.log(`[Webhook] Created task comment ${taskComment.id} from CRM`);

        // Notify task assignee if exists
        if (task.assignedToId) {
            await createNotification({
                userId: task.assignedToId,
                organizationId: task.project.organizationId,
                type: 'CRM_SYNC' as any, // Cast as any if type doesn't exist yet
                title: '💬 Nuevo comentario del CRM',
                body: `${comment.authorName || 'Cliente'} comentó en ${task.title}: "${comment.content.substring(0, 50)}..."`,
                data: { taskId: task.id, projectId: task.projectId }
            });
        }

        res.json({ success: true, taskCommentId: taskComment.id });
    } catch (error: any) {
        console.error('[Webhook] Error syncing comment:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /webhooks/crm/attachment-added
 * Receive an attachment from CRM and add it to the linked task
 */
router.post('/attachment-added', validateSyncKey, async (req, res) => {
    try {
        const { ticketId, attachment } = req.body;

        if (!ticketId || !attachment) {
            return res.status(400).json({ error: 'ticketId and attachment required' });
        }

        console.log(`[Webhook] Received attachment for ticket ${ticketId}: ${attachment.name}`);

        // Find the task linked to this ticket
        const task = await prisma.task.findFirst({
            where: { crmTicketId: ticketId }
        });

        if (!task) {
            console.warn(`[Webhook] No task found for ticket ${ticketId}`);
            return res.status(404).json({ error: 'Task not found for this ticket' });
        }

        // For now, add attachment info as a comment with the URL
        let systemUser = await prisma.user.findFirst({
            where: { email: 'crm-sync@system.local' }
        });

        if (!systemUser) {
            const membership = await prisma.organizationMember.findFirst({
                where: { role: 'ADMIN' },
                include: { user: true }
            });
            systemUser = membership?.user || null;
        }

        if (!systemUser) {
            return res.status(500).json({ error: 'No system user available' });
        }

        // Create actual attachment record
        const taskAttachment = await prisma.taskAttachment.create({
            data: {
                taskId: task.id,
                name: attachment.name,
                url: attachment.url,
                type: attachment.type || 'application/octet-stream',
                size: attachment.size || 0
            }
        });
        console.log(`[Webhook] Created task attachment ${taskAttachment.id} from CRM`);

        // Also create a comment for timeline visibility
        const isImage = attachment.type?.startsWith('image/');
        const content = isImage
            ? `[CRM Adjunto] 📷 Imagen: ${attachment.name}\n![${attachment.name}](${attachment.url})`
            : `[CRM Adjunto] 📎 Archivo: [${attachment.name}](${attachment.url})`;

        const taskComment = await prisma.taskComment.create({
            data: {
                taskId: task.id,
                userId: systemUser.id,
                content
            }
        });

        console.log(`[Webhook] Created attachment comment ${taskComment.id} from CRM`);

        res.json({ success: true, taskCommentId: taskComment.id, taskAttachmentId: taskAttachment.id });
    } catch (error: any) {
        console.error('[Webhook] Error syncing attachment:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /webhooks/crm/ticket-status-changed
 * Receive status change from CRM and update the linked task
 */
router.post('/ticket-status-changed', validateSyncKey, async (req, res) => {
    try {
        const { ticketId, oldStatus, newStatus } = req.body;

        if (!ticketId || !newStatus) {
            return res.status(400).json({ error: 'ticketId and newStatus required' });
        }

        console.log(`[Webhook] Ticket ${ticketId} status changed: ${oldStatus} → ${newStatus}`);

        // Find the task linked to this ticket
        const task = await prisma.task.findFirst({
            where: { crmTicketId: ticketId }
        });

        if (!task) {
            console.warn(`[Webhook] No task found for ticket ${ticketId}`);
            return res.json({ success: true, message: 'No linked task' });
        }

        // Map CRM status to task status
        const statusMap: Record<string, string> = {
            'OPEN': 'BACKLOG',
            'IN_PROGRESS': 'IN_PROGRESS',
            'RESOLVED': 'DONE',
            'CLOSED': 'DONE',
            'REOPENED': 'IN_PROGRESS'  // When ticket is reopened, move task back to in progress
        };

        const newTaskStatus = statusMap[newStatus];

        if (!newTaskStatus) {
            return res.json({ success: true, message: 'Status not mapped' });
        }

        // Only update if different
        if (task.status !== newTaskStatus) {
            await prisma.task.update({
                where: { id: task.id },
                data: { status: newTaskStatus }
            });

            console.log(`[Webhook] Updated task ${task.id} status to ${newTaskStatus}`);
        }

        res.json({ success: true, taskId: task.id, newStatus: newTaskStatus });
    } catch (error: any) {
        console.error('[Webhook] Error syncing status:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /webhooks/crm/chat-reply
 * Receive a reply from CRM agent and forward to connected Dev user
 */
router.post('/chat-reply', validateSyncKey, async (req, res) => {
    try {
        const { sessionId, content, agentName, timestamp } = req.body;

        if (!sessionId || !content) {
            return res.status(400).json({ error: 'sessionId and content required' });
        }

        console.log(`[Webhook] Received chat reply for session ${sessionId}`);

        // Extract userId from sessionId (format: dev-{userId})
        const userId = sessionId.replace('dev-', '');

        // Emit to user via Socket.IO
        const io = req.app.get('io');
        if (io) {
            // Emit to specific user room: user_{userId}
            io.to(`user_${userId}`).emit('chat_reply', {
                sessionId,
                content,
                agentName,
                timestamp: timestamp || new Date().toISOString()
            });
            console.log(`[Webhook] Emitted chat_reply to user_${userId}`);
        } else {
            console.warn('[Webhook] Socket.IO instance not found on app');
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('[Webhook] Error handling chat reply:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
