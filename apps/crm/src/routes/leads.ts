import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';
import { checkLeadAutomations } from '../automations.js';
import { sendEmail, emailTemplates } from '../email.js';

const router = Router();

// GET all leads
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user!.organizationId;
        const { tags } = req.query;

        const where: any = { organizationId };

        // Filter by tags if provided
        if (tags) {
            const tagList = (tags as string).split(',').map(t => t.trim());
            where.tags = {
                some: {
                    tag: {
                        name: { in: tagList }
                    }
                }
            };
        }

        const leads = await prisma.lead.findMany({
            where,
            include: {
                tags: { include: { tag: true } },
                assignedTo: { select: { id: true, name: true, avatar: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Map tags to simple string array for frontend compatibility if needed, 
        // or just return the object structure. The frontend currently expects `tags: string[]` in some places?
        // Let's check typical usage. LeadsKanban expects `tags?: string[]`.
        // We will transform the response to match expected format
        const enhancedLeads = leads.map(lead => ({
            ...lead,
            tags: lead.tags.map(lt => lt.tag.name)
        }));

        res.json(enhancedLeads);
    } catch (e) {
        console.error("GET /leads error:", e);
        res.status(500).json({ error: "Error fetching leads" });
    }
});

// POST bulk leads
router.post('/bulk', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user!.organizationId;
        const { leads } = req.body;

        if (!Array.isArray(leads)) {
            return res.status(400).json({ error: "Leads must be an array" });
        }

        if (leads.length > 500) {
            return res.status(400).json({ error: "Batch size limit exceeded (max 500)" });
        }

        const results = await prisma.$transaction(
            leads.map((lead: any) =>
                prisma.lead.create({
                    data: {
                        name: lead.name,
                        email: lead.email,
                        company: lead.company,
                        value: lead.value || 0,
                        status: lead.status === 'NEW' ? 'Nuevo' : (lead.status || 'Nuevo'),
                        source: 'MANUAL', // 'IMPORT' is not in enum
                        notes: (lead.notes || '') + ' [Bulk Import]',
                        organizationId,
                        createdById: req.user!.id,
                        assignedToId: lead.assignedToId
                    }
                })
            )
        );

        // Emit socket events for real-time updates
        const io = req.app.get('io');
        if (io) {
            io.to(`org_${organizationId}`).emit('lead.created', { count: results.length, leads: results });
        }

        // Trigger automations asynchronously for all created leads
        results.forEach(lead => {
            checkLeadAutomations(lead.id, lead.status).catch(console.error);
        });

        res.json({ success: true, count: results.length, ids: results.map(r => r.id) });

    } catch (e: any) {
        console.error("POST /leads/bulk error:", e);
        res.status(500).json({ error: "Error processing bulk import: " + e.message });
    }
});

// POST new lead
router.post('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user!.organizationId;
        const { name, email, company, value, status, source, notes, assignedToId, tags } = req.body;

        // Prepare tag connections
        let tagConnections: any = { create: [] };
        if (Array.isArray(tags) && tags.length > 0) {
            // Logic: For each tag name, connect or create the tag, then create the LeadTag relation
            // Prisma doesn't support "connectOrCreate" directly nested in a many-to-many through table easily for bulk.
            // But here we are creating a Lead, so we can use nested writes for LeadTag.

            // However, we need to know the Tag IDs first or use connectOrCreate on the Tag model.
            // Since LeadTag joins Lead and Tag, we need to create the LeadTag entries.
            // The structure is: 
            // tags: { 
            //   create: [
            //     { tag: { connectOrCreate: { where: { name_organizationId: ... }, create: { ... } } } } 
            //   ] 
            // }

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
                                color: '#6B7280' // Default color
                            }
                        }
                    }
                }))
            };
        } else {
            tagConnections = undefined;
        }

        const lead = await prisma.lead.create({
            data: {
                name,
                email,
                company,
                value: value || 0,
                status: status || 'Nuevo',
                source: source || 'MANUAL',
                notes,
                organizationId,
                createdById: req.user!.id,
                assignedToId,
                tags: tagConnections
            },
            include: {
                assignedTo: true,
                tags: { include: { tag: true } }
            }
        });

        // Simplify tags for response
        const enhancedLead = {
            ...lead,
            tags: lead.tags.map(lt => lt.tag.name)
        };

        // Check automations
        checkLeadAutomations(lead.id, lead.status).catch(console.error);

        // Notify Assignee
        if (assignedToId && assignedToId !== req.user!.id && lead.assignedTo) {
            await prisma.notification.create({
                data: {
                    userId: assignedToId,
                    organizationId,
                    type: 'LEAD',
                    title: 'New Lead Assigned',
                    body: `Lead assigned to you: ${lead.name}`,
                    data: { leadId: lead.id }
                }
            });
            if (lead.assignedTo.email) {
                await sendEmail({
                    to: lead.assignedTo.email,
                    ...emailTemplates.newLead(lead.name, lead.email, lead.source, `Assigned to you. Notes: ${notes || ''}`)
                });
            }
        }

        res.status(201).json(enhancedLead);
    } catch (e) {
        console.error("POST /leads error:", e);
        res.status(500).json({ error: "Error creating lead" });
    }
});

// PUT update lead
router.put('/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user!.organizationId;
        const { id } = req.params;
        const { status, assignedToId, tags, ...data } = req.body;

        // Get current lead to check changes
        const currentLead = await prisma.lead.findUnique({
            where: { id },
            select: { assignedToId: true }
        });

        // Handle Tags Update if provided
        // Strategies: 
        // 1. Delete all existing LeadTags for this lead and recreate.
        // 2. Diff and update.
        // Option 1 is simpler for "set tags" behavior.

        let tagsUpdateOp: any = undefined;
        if (Array.isArray(tags)) {
            // First, delete existing tags
            await prisma.leadTag.deleteMany({
                where: { leadId: id }
            });

            // Prepare create structure
            tagsUpdateOp = {
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

        const lead = await prisma.lead.update({
            where: { id, organizationId } as any,
            data: {
                status,
                assignedToId,
                ...data,
                tags: tagsUpdateOp // Will trigger creation of new LeadTags
            },
            include: {
                assignedTo: true,
                tags: { include: { tag: true } }
            }
        });

        // Simplify tags for response
        const enhancedLead = {
            ...lead,
            tags: lead.tags.map(lt => lt.tag.name)
        };

        if (status) {
            checkLeadAutomations(id, status).catch(console.error);
        }

        // Check for assignment change
        if (assignedToId && currentLead && assignedToId !== currentLead.assignedToId && assignedToId !== req.user!.id && lead.assignedTo) {
            await prisma.notification.create({
                data: {
                    userId: assignedToId,
                    organizationId,
                    type: 'LEAD',
                    title: 'Lead Assigned to You',
                    body: `Lead assigned to you: ${lead.name}`,
                    data: { leadId: lead.id }
                }
            });

            // Emit Socket Event
            const io = req.app.get('io');
            if (io) {
                io.to(`user_${assignedToId}`).emit('notification', {
                    id: 'temp-' + Date.now(),
                    userId: assignedToId,
                    type: 'LEAD',
                    title: 'Lead Assigned to You',
                    body: `Lead assigned to you: ${lead.name}`,
                    read: false,
                    createdAt: new Date().toISOString()
                });
            }

            if (lead.assignedTo.email) {
                await sendEmail({
                    to: lead.assignedTo.email,
                    ...emailTemplates.newLead(lead.name, lead.email, (lead.source as string), `Re-assigned to you.`)
                });
            }
        }

        res.json(enhancedLead);
    } catch (e: any) {
        if (e.code === 'P2025') {
            return res.status(404).json({ error: "Lead no encontrado" });
        }
        res.status(500).json({ error: e.message });
    }
});


// DELETE lead
router.delete('/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user!.organizationId;
        await prisma.lead.delete({
            where: { id: req.params.id, organizationId } as any
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Error deleting lead" });
    }
});

// POST /leads/:id/convert (Manual Conversion)
router.post('/:id/convert', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;
        const { plan = 'FREE', generateInvoice = false } = req.body;
        const io = req.app.get('io');

        const lead = await prisma.lead.findFirst({
            where: { id, organizationId }
        });

        if (!lead) return res.status(404).json({ error: "Lead not found" });

        // Check if already converted
        if (lead.convertedToId) {
            return res.status(400).json({ error: "Lead already converted", customerId: lead.convertedToId });
        }

        // 1. Create or Find Customer
        let customer = await prisma.customer.findFirst({
            where: { email: lead.email, organizationId }
        });

        if (!customer) {
            customer = await prisma.customer.create({
                data: {
                    organizationId,
                    name: lead.name,
                    email: lead.email,
                    phone: lead.phone,
                    company: lead.company,
                    notes: lead.notes,
                    plan: plan.toUpperCase() as any,
                    status: 'ACTIVE',
                }
            });

            // Sync to ChronusDev in background
            const { syncCustomerToChronusDev } = await import("../services/chronusdev-sync.js");
            syncCustomerToChronusDev(customer as any, organizationId).catch(console.error);
        }

        // 2. Mark Lead as Converted
        await prisma.lead.update({
            where: { id },
            data: {
                status: 'WON',
                convertedAt: new Date(),
                convertedToId: customer.id
            }
        });

        // 3. Link existing Invoices/Quotes from Lead to Customer
        await prisma.invoice.updateMany({
            where: { leadId: id, organizationId },
            data: { customerId: customer.id }
        });

        // 4. Link Activities
        await prisma.activity.updateMany({
            where: { leadId: id, organizationId },
            data: { customerId: customer.id }
        });

        // 5. Create basic Contact
        if (lead.phone || lead.email) {
            await prisma.contact.create({
                data: {
                    customerId: customer.id,
                    organizationId,
                    type: lead.phone ? 'PHONE' : 'EMAIL',
                    value: lead.phone || lead.email,
                    displayName: lead.name,
                    isPrimary: true
                }
            }).catch(() => { }); // Ignore if already exists (unique constraint)
        }

        // Emit socket
        if (io) {
            io.to(`org_${organizationId}`).emit('lead_converted', { leadId: id, clientId: customer.id, client: customer });
        }

        res.json({ success: true, customerId: customer.id, customer });

    } catch (e: any) {
        console.error("POST /leads/:id/convert error:", e);
        res.status(500).json({ error: e.message });
    }
});

export const leadsRouter = router;
