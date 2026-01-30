import cron from 'node-cron';
import { prisma } from './db.js';
import { ReminderTriggerType, ReminderChannel } from '@prisma/client';

/**
 * Initialize the reminder scheduler.
 * Runs daily at 8:00 AM to check for upcoming birthdays and payment due dates.
 */
export function initReminderScheduler() {
    console.log('[ReminderScheduler] Initialized. Checking for reminders daily at 8:00 AM...');

    // Run every day at 8:00 AM local time
    cron.schedule('0 8 * * *', async () => {
        console.log('[ReminderScheduler] Running daily reminder check...');
        await processReminders();
    });

    // Also run immediately on startup for testing (comment out in production)
    // processReminders();
}

/**
 * Process all reminder templates and create scheduled interactions for matching customers.
 */
async function processReminders() {
    try {
        // Get all enabled reminder templates
        const templates = await prisma.reminderTemplate.findMany({
            where: { isEnabled: true },
            include: { organization: true }
        });

        console.log(`[ReminderScheduler] Found ${templates.length} enabled templates.`);

        for (const template of templates) {
            await processTemplate(template);
        }
    } catch (err) {
        console.error('[ReminderScheduler] Error processing reminders:', err);
    }
}

async function processTemplate(template: any) {
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + template.daysBefore);

    let customers: any[] = [];

    if (template.triggerType === 'BIRTHDAY') {
        // Find customers whose birthday matches the target date (month and day)
        const targetMonth = targetDate.getMonth() + 1; // JS months are 0-indexed
        const targetDay = targetDate.getDate();

        // SQLite-specific date extraction
        customers = await prisma.$queryRaw`
            SELECT * FROM Customer 
            WHERE organizationId = ${template.organizationId}
            AND birthDate IS NOT NULL
            AND CAST(strftime('%m', birthDate) AS INTEGER) = ${targetMonth}
            AND CAST(strftime('%d', birthDate) AS INTEGER) = ${targetDay}
        `;
    } else if (template.triggerType === 'PAYMENT_DUE') {
        // Find customers whose payment due day matches the target date's day
        const targetDay = targetDate.getDate();

        customers = await prisma.customer.findMany({
            where: {
                organizationId: template.organizationId,
                paymentDueDay: targetDay
            }
        });
    }

    console.log(`[ReminderScheduler] Template "${template.name}": ${customers.length} customers match.`);

    for (const customer of customers) {
        await createScheduledInteraction(template, customer);
    }
}

async function createScheduledInteraction(template: any, customer: any) {
    // Check if we already created an interaction for this today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Find today's interactions for this customer
    const todayInteractions = await prisma.scheduledInteraction.findMany({
        where: {
            customerId: customer.id,
            createdAt: {
                gte: todayStart,
                lte: todayEnd
            }
        }
    });

    // Check if any has this template
    const existing = todayInteractions.find((i: any) => {
        const meta = i.metadata as any;
        return meta?.templateId === template.id;
    });

    if (existing) {
        console.log(`[ReminderScheduler] Skipping duplicate for ${customer.name} - already scheduled today.`);
        return;
    }

    // Interpolate template content
    let content = template.content || '';
    content = content.replace(/{{name}}/g, customer.name || '');
    content = content.replace(/{{company}}/g, customer.company || '');
    content = content.replace(/{{email}}/g, customer.email || '');

    // Format dates nicely
    if (customer.birthDate) {
        const bd = new Date(customer.birthDate);
        content = content.replace(/{{birthDate}}/g, bd.toLocaleDateString('es-ES'));
    }
    if (customer.paymentDueDay) {
        content = content.replace(/{{paymentDueDay}}/g, String(customer.paymentDueDay));
    }

    let subject = template.subject || '';
    subject = subject.replace(/{{name}}/g, customer.name || '');

    // Schedule for 9:00 AM today
    const scheduledAt = new Date();
    scheduledAt.setHours(9, 0, 0, 0);

    // Map ReminderChannel to ScheduledInteraction type
    const typeMap: Record<ReminderChannel, string> = {
        WHATSAPP: 'WHATSAPP',
        EMAIL: 'EMAIL',
        VOICE: 'VOICE'
    };

    await prisma.scheduledInteraction.create({
        data: {
            customerId: customer.id,
            scheduledAt,
            type: typeMap[template.channel as ReminderChannel],
            content,
            subject: template.channel === 'EMAIL' ? subject : undefined,
            status: 'PENDING',
            metadata: {
                templateId: template.id,
                templateName: template.name,
                triggerType: template.triggerType,
                autoGenerated: true
            }
        }
    });

    console.log(`[ReminderScheduler] Created ${template.channel} reminder for ${customer.name}`);
}

/**
 * Export for manual triggering (e.g., via API for testing)
 */
export { processReminders };
