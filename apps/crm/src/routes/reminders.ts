import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';
import { sendEmail } from '../services/email.js';
import { sendWhatsAppMessage } from '../whatsapp.js';

const router = Router();

// GET /reminders - List rules
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;
        const reminders = await prisma.reminder.findMany({
            where: { organizationId },
            include: { _count: { select: { logs: true } } }
        });
        res.json(reminders);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// GET /reminders/logs - Get recent logs
router.get('/logs', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;
        const logs = await prisma.notificationLog.findMany({
            where: {
                reminder: { organizationId }
            },
            include: { reminder: true },
            orderBy: { sentAt: 'desc' },
            take: 50
        });
        res.json(logs);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /reminders - Create Rule
router.post('/', authMiddleware, async (req: any, res) => {
    try {
        const { name, triggerType, offsetDays, channel, template } = req.body;
        const organizationId = req.user.organizationId;

        const reminder = await prisma.reminder.create({
            data: {
                name,
                triggerType,
                offsetDays: Number(offsetDays),
                channel,
                template,
                organizationId
            }
        });
        res.json(reminder);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /reminders/check - Process Triggers
// This would typically be called by a cron job or manually for testing
router.post('/check', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;
        console.log(`[Reminders] Checking for org ${organizationId}`);

        // 1. Get Active Rules
        const activeRules = await prisma.reminder.findMany({
            where: { organizationId, isActive: true }
        });

        const logs = [];

        for (const rule of activeRules) {
            if (rule.triggerType === 'INVOICE_DUE') {
                // Find pending invoices due on (today + offsetDays)
                const targetDate = new Date();
                targetDate.setDate(targetDate.getDate() - rule.offsetDays);

                const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
                const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

                const invoices = await prisma.invoice.findMany({
                    where: {
                        organizationId,
                        status: { not: 'PAID' }, // Only pending
                        dueDate: {
                            gte: startOfDay,
                            lte: endOfDay
                        }
                    },
                    include: { customer: true }
                });

                console.log(`[Reminders] Rule ${rule.name}: Found ${invoices.length} invoices due around ${startOfDay.toISOString()}`);

                // Type definition for Invoice with Customer included
                type InvoiceWithCustomer = typeof invoices[0];

                for (const inv of invoices) {
                    // Check if already sent
                    const existingLog = await prisma.notificationLog.findFirst({
                        where: { reminderId: rule.id, entityId: inv.id }
                    });

                    if (!existingLog) {
                        let sendResult: { success: boolean; error?: string; messageId?: string } = { success: false, error: 'Unknown Channel' };

                        // Try Sending
                        try {
                            if (rule.channel === 'EMAIL') {
                                if (inv.customer && inv.customer.email) {
                                    sendResult = await sendEmail({
                                        to: inv.customer.email,
                                        subject: `Recordatorio: Factura #${inv.number} Vence Pronto`,
                                        text: rule.template || `Estimado ${inv.customer.name}, su factura #${inv.number} vence el ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'fecha desconocida'}.`,
                                        organizationId
                                    });
                                } else {
                                    sendResult = { success: false, error: 'Customer has no email' };
                                }
                            } else if (rule.channel === 'WHATSAPP') {
                                if (inv.customer && inv.customer.phone) {
                                    sendResult = await sendWhatsAppMessage(
                                        inv.customer.phone,
                                        rule.template || `Hola ${inv.customer.name}, le recordamos que su factura #${inv.number} vence pronto.`
                                    ) as any;
                                } else {
                                    sendResult = { success: false, error: 'Customer has no phone' };
                                }
                            }
                        } catch (err: any) {
                            sendResult = { success: false, error: err.message };
                        }

                        // Log Result
                        const logData: any = {
                            reminderId: rule.id,
                            entityId: inv.id,
                            channel: rule.channel,
                            status: sendResult.success ? 'SENT' : 'FAILED',
                            error: sendResult.error,
                            sentAt: new Date()
                        };

                        const log = await prisma.notificationLog.create({
                            data: logData
                        });
                        logs.push(log);
                    }
                }
            }
        }

        res.json({ message: "Check completed", newNotifications: logs.length, logs });

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
