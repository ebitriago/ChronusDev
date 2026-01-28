import cron from 'node-cron';
import { prisma } from './db.js';
import { initiateOutboundCall } from './voice.js';
import { sendWhatsAppMessage } from './whatsapp.js';
import { sendEmail } from './email.js';

// Poll every minute for pending interactions
export function initScheduler() {
    console.log('[Scheduler] Initialized. Polling for scheduled interactions every minute...');

    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();

            // Find pending interactions scheduled for now or in the past
            const dueInteractions = await prisma.scheduledInteraction.findMany({
                where: {
                    status: 'PENDING',
                    scheduledAt: {
                        lte: now
                    }
                },
                include: {
                    customer: true
                }
            });

            if (dueInteractions.length > 0) {
                console.log(`[Scheduler] Found ${dueInteractions.length} due interactions.`);
            }

            for (const interaction of dueInteractions) {
                await processScheduledInteraction(interaction);
            }
        } catch (err) {
            console.error('[Scheduler] Error checking interactions:', err);
        }
    });
}

async function processScheduledInteraction(interaction: any) {
    console.log(`[Scheduler] Processing ${interaction.type} for ${interaction.customer.name}`);

    try {
        let result: { success: boolean; error?: string; externalId?: string } = { success: false, error: 'Unknown type' };

        if (interaction.type === 'VOICE') {
            const phone = interaction.customer.phone; // Assuming verified phone
            if (!phone) throw new Error('Customer has no phone');

            const context = interaction.metadata as any || {};
            // Cast to generic result
            const callRes: any = await initiateOutboundCall(phone, (context as any).agentId || process.env.VAPI_ASSISTANT_ID || '');
            result = {
                success: callRes.success,
                error: (callRes as any).error,
                externalId: (callRes as any).callSid
            };

        } else if (interaction.type === 'WHATSAPP') {
            const phone = interaction.customer.phone;
            if (!phone) throw new Error('Customer has no phone');

            const waRes = await sendWhatsAppMessage(phone, interaction.content || '', 'text');

            // If success, log to conversation history?
            // "Scheduled Interaction" logic implies we should log it so the AI sees it contextually.
            // But `sendWhatsAppMessage` might not be doing full conversation logging if it's just the sender.
            // Ideally, we create a Conversation record here or in `sendWhatsAppMessage`.
            // For now, we rely on the `scheduler` to just execute. 
            // IMPROVEMENT: Manually insert a "user" (agent) message into the conversation for context?

            result = {
                success: waRes.success,
                error: waRes.error,
                externalId: waRes.message?.id
            };

        } else if (interaction.type === 'EMAIL') {
            const email = interaction.customer.email;
            if (!email) throw new Error('Customer has no email');

            const emailRes = await sendEmail({
                to: email,
                subject: interaction.subject || 'Mensaje de ChronusCRM',
                text: interaction.content || ''
            });

            result = {
                success: emailRes.success,
                error: emailRes.error,
                externalId: emailRes.messageId
            };
        }

        // Update Status
        if (result.success) {
            await prisma.scheduledInteraction.update({
                where: { id: interaction.id },
                data: {
                    status: 'COMPLETED',
                    externalId: result.externalId,
                    updatedAt: new Date()
                }
            });
            console.log(`[Scheduler] ${interaction.type} ${interaction.id} completed.`);
        } else {
            await prisma.scheduledInteraction.update({
                where: { id: interaction.id },
                data: {
                    status: 'FAILED',
                    error: result.error,
                    updatedAt: new Date()
                }
            });
            console.error(`[Scheduler] ${interaction.type} ${interaction.id} failed: ${result.error}`);
        }

    } catch (err: any) {
        console.error(`[Scheduler] Exception processing ${interaction.id}:`, err);
        await prisma.scheduledInteraction.update({
            where: { id: interaction.id },
            data: {
                status: 'FAILED',
                error: err.message,
                updatedAt: new Date()
            }
        });
    }
}
