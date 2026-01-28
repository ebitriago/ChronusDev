import { prisma } from './db.js';
import { LeadStatus } from '@prisma/client';

export async function checkLeadAutomations(leadId: string, newStatus: LeadStatus) {
    console.log(`[Automations] Checking rules for Lead ${leadId} -> ${newStatus}`);

    try {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            include: { customer: true } as any
        }) as any;

        if (!lead) return;

        // Find matching rules for this organization and status
        const rules = await (prisma as any).pipelineAutomation.findMany({
            where: {
                organizationId: lead.organizationId,
                triggerStatus: newStatus,
                isEnabled: true
            }
        });

        if (rules.length === 0) {
            console.log(`[Automations] No rules found for status ${newStatus}`);
            return;
        }

        console.log(`[Automations] Found ${rules.length} rules to execute.`);

        for (const rule of rules) {

            // Calculate schedule time
            const now = new Date();
            const scheduledAt = new Date(now.getTime() + (rule.actionDelayMinutes * 60000));

            // Interpolate content
            let content = rule.actionContent || '';
            content = content.replace('{{name}}', lead.name);
            content = content.replace('{{company}}', lead.company || '');

            // For customerId connection:
            // Leads might not have a 'customer' relation if they are just Leads.
            // But ScheduledInteraction requires 'customerId'.
            // If the Lead system is separate from Customer, we have a problem reusing ScheduledInteraction directly linked to Customer.
            // However, in this schema, typically Leads convert to Customers or are pre-customers.
            // If ScheduledInteraction strictly links to Customer, we need a Customer record.
            // TEMP FIX: If Lead is not a Customer, we can't schedule interaction yet OR we need to update ScheduledInteraction to support Lead ID.

            // Let's check schema for ScheduledInteraction... it has `customerId` (required).
            // Let's check if Lead has `customerId`. The schema usually implies Leads turn into Customers.
            // If the goal is to message Leads, we might need to link ScheduledInteraction to Lead OR ensure Lead has a shadow Customer.

            // OPTION: We'll assume for now this automation works for Leads that ARE associated with a customer (e.g. existing clients in new deals)
            // OR checks if we can link it.

            // Wait, usually CRM leads are potential customers.
            // If `ScheduledInteraction` depends on `Customer`, we can't use it for raw Leads unless we change schema.
            // Let's look at schema again. 
            // `model ScheduledInteraction { customerId String ... }`.

            // Implementation Decision: For now, I will create a temporary "Customer" or check if one exists by email.
            // If not, I'll log a warning or maybe create a "Contact" placeholder?
            // Actually, let's look if `Lead` has `customerId`.
            // Schema didn't show `customerId` on `Lead`.

            // Let's do a lookup:
            let targetCustomerId = '';

            // Try find customer by email
            const existingCustomer = await prisma.customer.findFirst({
                where: { email: lead.email, organizationId: lead.organizationId } as any
            });

            if (existingCustomer) {
                targetCustomerId = existingCustomer.id;
            } else {
                // If we really want to automessage Leads, we should probably create a Customer record in "LEAD" status?
                // Or just proceed if we find one.
                console.warn(`[Automations] Lead ${lead.email} is not a Customer yet. Skipping interactions requiring Customer ID.`);
                continue;
            }

            await prisma.scheduledInteraction.create({
                data: {
                    customerId: targetCustomerId,
                    scheduledAt,
                    type: rule.actionType,
                    content,
                    subject: rule.actionSubject,
                    metadata: {
                        automationRuleId: rule.id,
                        leadId: lead.id,
                        triggerStatus: newStatus
                    },
                    status: 'PENDING'
                }
            });

            console.log(`[Automations] Scheduled ${rule.actionType} in ${rule.actionDelayMinutes}m for ${lead.email}`);
        }

    } catch (err) {
        console.error('[Automations] Error executing rules:', err);
    }
}
