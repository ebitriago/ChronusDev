import { prisma } from './db.js';

export async function checkLeadAutomations(leadId: string, newStatus: string) {
    console.log(`[Automations] Checking rules for Lead ${leadId} -> ${newStatus}`);

    try {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        });

        if (!lead) return;

        // 1. Find the pipeline stage for this status name
        // Note: Status in Lead is currently a string (stage name).
        const stage = await prisma.pipelineStage.findUnique({
            where: {
                organizationId_name: {
                    organizationId: lead.organizationId,
                    name: newStatus
                }
            },
            include: {
                automations: {
                    where: { isEnabled: true }
                }
            }
        });

        if (!stage) {
            console.log(`[Automations] Stage '${newStatus}' not found for org ${lead.organizationId}`);
            return;
        }

        const rules = stage.automations;

        if (rules.length === 0) {
            console.log(`[Automations] No rules found for stage ${newStatus}`);
            return;
        }

        console.log(`[Automations] Found ${rules.length} rules to execute.`);

        for (const rule of rules) {
            // Calculate execution time
            const now = new Date();
            const scheduledAt = new Date(now.getTime() + (rule.delayMinutes * 60000));

            // Create Job
            await prisma.automationJob.create({
                data: {
                    automationId: rule.id,
                    leadId: lead.id,
                    status: 'PENDING',
                    scheduledAt,
                    attempts: 0
                }
            });

            console.log(`[Automations] Job created for rule ${rule.id} scheduled at ${scheduledAt.toISOString()}`);
        }

    } catch (err) {
        console.error('[Automations] Error executing rules:', err);
    }
}
