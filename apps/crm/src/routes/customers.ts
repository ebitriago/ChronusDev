
/**
 * @openapi
 * /customers:
 *   get:
 *     tags: [Customers]
 *     summary: List all customers
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, email, or company
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, TRIAL, SUSPENDED, CANCELLED]
 *     responses:
 *       200:
 *         description: List of customers
 */
/**
 * @openapi
 * /customers:
 *   post:
 *     tags: [Customers]
 *     summary: Create a new customer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               company:
 *                 type: string
 *     responses:
 *       201:
 *         description: Customer created
 */
/**
 * @openapi
 * /customers/{id}:
 *   get:
 *     tags: [Customers]
 *     summary: Get customer details
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer details
 */
/**
 * @openapi
 * /customers/{id}/360:
 *   get:
 *     tags: [Customers]
 *     summary: Get Customer 360 View
 *     description: Returns consolidated data including contacts, conversations, tickets, invoices, and activities.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer 360 Object
 */
/**
 * @openapi
 * /customers/{id}/export:
 *   get:
 *     tags: [Customers]
 *     summary: Export Customer 360 Data
 *     description: Download full customer 360 data as JSON file.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: JSON file download
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */

import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';
import { syncCustomerToChronusDev, updateChronusDevClient } from "../services/chronusdev-sync.js";

const router = Router();

const SYNC_KEY = process.env.CRM_SYNC_KEY || 'chronus-sync-key';

// GET /customers/for-chronusdev - Special route for ChronusDev sync (no user auth, uses sync key)
router.get('/for-chronusdev', async (req: any, res) => {
    try {
        const syncKey = req.headers['x-sync-key'];
        const organizationId = req.query.organizationId as string;

        if (syncKey !== SYNC_KEY) {
            return res.status(401).json({ error: 'Invalid sync key' });
        }

        if (!organizationId) {
            return res.status(400).json({ error: 'organizationId query param required' });
        }

        const customers = await prisma.customer.findMany({
            where: { organizationId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                company: true,
                notes: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(customers);
    } catch (e: any) {
        console.error('GET /customers/for-chronusdev error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Helper
async function findClientByContact(contactValue: string, organizationId: string) {
    const contact = await prisma.contact.findFirst({
        where: {
            organizationId,
            OR: [
                { value: { contains: contactValue } },
                { value: contactValue }
            ]
        } as any
    });

    return {
        customerId: contact?.customerId || null,
        contactId: contact?.id || null
    };
}

// GET /customers (List) - Enhanced with search and counts
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: "No organization context" });

        const { status, plan, search } = req.query;
        const where: any = { organizationId };

        if (status) where.status = (status as string).toUpperCase();
        if (plan) where.plan = (plan as string).toUpperCase();

        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { email: { contains: String(search), mode: 'insensitive' } },
                { company: { contains: String(search), mode: 'insensitive' } }
            ];
        }

        const { tags } = req.query;
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

        const customers = await prisma.customer.findMany({
            where,
            include: {
                _count: {
                    select: {
                        tickets: { where: { status: 'OPEN' } },
                        invoices: { where: { status: { in: ['SENT', 'OVERDUE'] } } }
                    }
                },
                contacts: true,
                tags: { include: { tag: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const enriched = customers.map(c => ({
            ...c,
            tags: c.tags.map(ct => ct.tag.name),
            openTickets: c._count.tickets,
            pendingInvoices: c._count.invoices,
            communications: [] // Legacy compat
        }));

        res.json(enriched);
    } catch (e: any) {
        console.error("GET /customers error:", e);
        res.status(500).json({ error: e.message });
    }
});

// GET /customers/match (Match contact)
// Searches in: Contact table, Customer.phone, Customer.contacts JSON array
router.get('/match', authMiddleware, async (req: any, res) => {
    const value = req.query.value as string;
    const organizationId = req.user.organizationId;

    if (!value) return res.status(400).json({ error: 'value query parameter required' });

    try {
        // Normalize the search value
        const cleanValue = value.replace(/[^0-9a-zA-Z@.]/g, '');

        // 1. Search in Contact table first
        const contact = await prisma.contact.findFirst({
            where: {
                organizationId,
                OR: [
                    { value: { contains: cleanValue } },
                    { value: { contains: value } }
                ]
            } as any
        });

        if (contact?.customerId) {
            const customer = await prisma.customer.findFirst({
                where: { id: contact.customerId, organizationId }
            });
            if (customer) {
                return res.json({
                    matched: true,
                    customerId: customer.id,
                    contactId: contact.id,
                    client: customer
                });
            }
        }

        // 2. Search by phone in Customer table directly
        let customer = await prisma.customer.findFirst({
            where: {
                organizationId,
                OR: [
                    { phone: { contains: cleanValue } },
                    { phone: { contains: value } },
                    { email: value.toLowerCase() }
                ]
            } as any
        });

        if (customer) {
            return res.json({
                matched: true,
                customerId: customer.id,
                client: customer
            });
        }

        // 3. Search in Customer.contacts JSON array (contacts added from chat)
        const allCustomers = await prisma.customer.findMany({
            where: { organizationId }
        });

        for (const cust of allCustomers) {
            const contacts = (cust as any).contacts;
            if (Array.isArray(contacts)) {
                const found = contacts.some((c: any) =>
                    c.value?.includes(cleanValue) ||
                    c.value?.includes(value)
                );
                if (found) {
                    return res.json({
                        matched: true,
                        customerId: cust.id,
                        client: cust
                    });
                }
            }
        }

        // No match found
        res.json({ matched: false });
    } catch (e: any) {
        console.error('GET /customers/match error:', e);
        res.status(500).json({ error: e.message });
    }
});

// GET /customers/:id (Detail)
router.get('/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;

        const customer = await prisma.customer.findFirst({
            where: { id, organizationId },
            include: {
                contacts: true,
                tags: { include: { tag: true } },
                invoices: {
                    take: 5,
                    orderBy: { createdAt: 'desc' }
                },
                tickets: {
                    take: 5,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });

        res.json(customer);
    } catch (e: any) {
        console.error("GET /customers/:id error:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST /customers (Create) - With ChronusDev Sync
router.post('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { name, email, phone, company, plan = "FREE", status = "TRIAL", notes, contacts, tags } = req.body;

        if (!name || !email) return res.status(400).json({ error: "name y email requeridos" });

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

        const customer = await prisma.customer.create({
            data: {
                organizationId,
                name,
                email,
                phone,
                company,
                notes,
                plan: (plan as string).toUpperCase() as any,
                status: (status as string).toUpperCase() as any,
                contacts: {
                    create: contacts || []
                },
                tags: tagConnections
            },
            include: {
                tags: { include: { tag: true } }
            }
        });

        // Sync to ChronusDev
        syncCustomerToChronusDev(customer as any, organizationId).catch(err =>
            console.error('[Sync] Error syncing customer to ChronusDev:', err)
        );

        res.status(201).json(customer);
    } catch (e: any) {
        console.error("POST /customers error:", e);
        if (e.code === 'P2002') return res.status(400).json({ error: "Email exists" });
        res.status(500).json({ error: e.message });
    }
});

// POST /customers/from-chat (Create from chat)
router.post('/from-chat', authMiddleware, async (req: any, res) => {
    const { name, email, phone, company, notes, contactValue, contactType, platform, sessionId } = req.body;
    const organizationId = req.user.organizationId;
    const io = req.app.get('io');

    if (!name || !contactValue) {
        return res.status(400).json({ error: 'name and contactValue are required' });
    }

    try {
        // Create customer
        const customer = await prisma.customer.create({
            data: {
                name,
                email: email || (contactType === 'email' ? contactValue : `${Date.now()}@placeholder.com`),
                phone: phone || (contactType === 'phone' || contactType === 'whatsapp' ? contactValue : undefined),
                company: company || undefined,
                plan: 'FREE',
                status: 'ACTIVE',
                organizationId,
                notes: notes || undefined
            }
        });

        // Create contact
        const contact = await prisma.contact.create({
            data: {
                customerId: customer.id,
                organizationId,
                type: (contactType || platform || 'whatsapp').toUpperCase(),
                value: contactValue,
                displayName: name,
                verified: true
            }
        });

        // Link conversation if sessionId provided
        if (sessionId) {
            await prisma.conversation.updateMany({
                where: { sessionId, organizationId },
                data: { customerId: customer.id }
            });
        }

        // Emit socket events
        if (io) {
            io.to(`org_${organizationId}`).emit('client_created', { client: customer, source: 'chat' });
        }

        res.status(201).json({
            client: customer,
            contact: contact,
            message: 'Client created and linked to conversation'
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /customers/:id (Update) - With Sync
router.put('/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;
        const { name, email, phone, company, plan, status, notes, monthlyRevenue, currency, birthDate, paymentDueDay, customFields, tags } = req.body;

        const updateData: any = {};
        if (customFields) updateData.customFields = customFields;
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (company !== undefined) updateData.company = company;
        if (plan !== undefined) updateData.plan = plan.toUpperCase();
        if (status !== undefined) updateData.status = status.toUpperCase();
        if (notes !== undefined) updateData.notes = notes;
        if (monthlyRevenue !== undefined) updateData.monthlyRevenue = Number(monthlyRevenue);
        if (currency !== undefined) updateData.currency = currency;
        if (birthDate !== undefined) updateData.birthDate = birthDate ? new Date(birthDate) : null;
        if (paymentDueDay !== undefined) updateData.paymentDueDay = paymentDueDay;

        if (Array.isArray(tags)) {
            // Delete existing tags
            await prisma.customerTag.deleteMany({
                where: { customerId: id }
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

        const customer = await prisma.customer.update({
            where: { id, organizationId } as any,
            data: updateData,
            include: {
                tags: { include: { tag: true } }
            }
        });

        // Enhance response
        const enhanced = {
            ...customer,
            tags: customer.tags.map(t => t.tag.name)
        };

        // Sync updates
        if (customer.chronusDevClientId) {
            updateChronusDevClient(customer as any).catch(err =>
                console.error('[Sync] Error updating ChronusDev client:', err)
            );
        }

        res.json(enhanced);
    } catch (e: any) {
        console.error("PUT /customers/:id error:", e);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /customers/:id
router.delete('/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;

        await prisma.customer.delete({
            where: { id, organizationId } as any
        });

        res.json({ success: true });
    } catch (e: any) {
        console.error("DELETE /customers/:id error:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST /customers/from-lead/:leadId (Convert Lead)
router.post('/from-lead/:leadId', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { leadId } = req.params;
        const { plan, additionalContacts } = req.body;
        const io = req.app.get('io');

        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId }
        });

        if (!lead) return res.status(404).json({ error: "Lead not found" });

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
                    plan: plan || 'FREE',
                    status: 'ACTIVE',
                }
            });
        }

        // Link external contacts if any
        if (additionalContacts && Array.isArray(additionalContacts)) {
            await prisma.contact.createMany({
                data: additionalContacts.map((c: any) => ({
                    customerId: customer!.id,
                    organizationId,
                    type: (c.type || 'email').toUpperCase(),
                    value: c.value,
                    displayName: c.name
                }))
            });
        }

        // Update Lead
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                status: 'WON',
                convertedAt: new Date(),
                convertedToId: customer.id
            }
        });

        // Move/Link Invoices
        await prisma.invoice.updateMany({
            where: { leadId: leadId, organizationId },
            data: { customerId: customer.id }
        });

        // Emit socket events
        if (io) {
            io.to(`org_${organizationId}`).emit('lead_converted', { leadId, clientId: customer.id, client: customer });
            io.to(`org_${organizationId}`).emit('client_created', { client: customer, source: 'lead_conversion' });
        }

        // Notify
        await prisma.notification.create({
            data: {
                userId: req.user.id,
                organizationId,
                title: '🌟 Lead Convertido',
                body: `${customer.name} es ahora cliente`,
                type: 'SYSTEM',
                data: { clientId: customer.id, leadId }
            }
        });

        res.json({ success: true, customerId: customer.id });
    } catch (e: any) {
        console.error("POST /customers/from-lead error:", e);
        res.status(500).json({ error: e.message });
    }
});

// GET /customers/:id/360 (Enhanced View with LTV and Sockets/Frontend compat)
router.get('/:id/360', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;

        const customer = await prisma.customer.findFirst({
            where: { id, organizationId },
            include: {
                conversations: {
                    include: { messages: { orderBy: { createdAt: 'desc' }, take: 5 } },
                    orderBy: { updatedAt: 'desc' },
                    take: 5
                },
                contacts: true,
                activities: { orderBy: { createdAt: 'desc' }, take: 20 },

                tickets: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    include: { tags: { include: { tag: true } } }
                },
                invoices: { orderBy: { createdAt: 'desc' }, take: 20 },
                projects: true,
                tags: { include: { tag: true } }
            }
        });

        if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });

        // Compatibility mapping for Frontend expectations (some expect .client, some expect flat)
        // CustomerDetail.tsx expects .client, .contacts, .conversations
        const response: any = {
            client: {
                ...customer,
                tags: customer.tags.map(t => t.tag.name)
            },
            contacts: customer.contacts,
            conversations: customer.conversations.map(c => ({
                id: c.sessionId,
                platform: c.platform,
                contact: c.customerContact,
                lastMessage: c.messages[0]?.content || "...",
                updatedAt: c.updatedAt,
                messageCount: c.messages.length
            })),
            invoices: customer.invoices.map(i => ({
                id: i.id,
                number: i.number,
                createdAt: i.createdAt,
                amount: i.amount,
                status: i.status,
                type: i.type,
                description: i.notes || `Doc #${i.number}`
            })),
            tickets: customer.tickets.map(t => ({
                id: t.id,
                title: t.title,
                status: t.status,
                createdAt: t.createdAt,
                priority: t.priority,
                tags: t.tags // Include tags in 360 response
            }))
        };

        // Calculate LTV
        const ltv = customer.invoices
            .filter(inv => inv.status === 'PAID')
            .reduce((sum, inv) => sum + inv.amount, 0);

        response.stats = {
            ltv,
            totalConversations: customer.conversations.length,
            openTickets: customer.tickets.filter(t => t.status !== 'RESOLVED' && t.status !== 'CLOSED').length
        };

        res.json(response);

    } catch (e: any) {
        console.error("GET /customers/:id/360 error:", e);
        res.status(500).json({ error: e.message });
    }
});

// GET /customers/:id/ai-context (Short context for LLM)
router.get('/:id/ai-context', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;

        const customer = await prisma.customer.findFirst({
            where: { id, organizationId },
            include: {
                invoices: { where: { status: 'PAID' } },
                tickets: { where: { status: { notIn: ['RESOLVED', 'CLOSED'] } } },
                tags: { include: { tag: true } }
            }
        });

        if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });

        const ltv = customer.invoices.reduce((sum, inv) => sum + inv.amount, 0);

        const context = {
            id: customer.id,
            name: customer.name,
            company: customer.company,
            email: customer.email,
            plan: customer.plan,
            ltv,
            tags: customer.tags.map(t => t.tag.name),
            openTickets: customer.tickets.map(t => ({ id: t.id, title: t.title, priority: t.priority })),
            notes: customer.notes
        };

        res.json(context);

    } catch (e: any) {
        console.error("GET /customers/:id/ai-context error:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST /customers/:id/chronus-task (Create task in external system)
router.post('/:id/chronus-task', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;
        const { title, description } = req.body;

        // Mock success
        res.json({ success: true, message: "Tarea creada (Mock)" });

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// GET /customers/:id/export (Download full 360 data as JSON)
router.get('/:id/export', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;

        const customer = await prisma.customer.findFirst({
            where: { id, organizationId },
            include: {
                conversations: {
                    include: { messages: { orderBy: { createdAt: 'asc' } } },
                    orderBy: { updatedAt: 'desc' }
                },
                contacts: true,
                activities: { orderBy: { createdAt: 'desc' } },
                tickets: { orderBy: { createdAt: 'desc' } },
                invoices: { orderBy: { createdAt: 'desc' } },
                projects: true,
                tags: { include: { tag: true } }
            }
        });

        if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });

        const ltv = customer.invoices
            .filter(inv => inv.status === 'PAID')
            .reduce((sum, inv) => sum + inv.amount, 0);

        const exportData = {
            exportDate: new Date().toISOString(),
            customer: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                company: customer.company,
                plan: customer.plan,
                status: customer.status,
                notes: customer.notes,
                createdAt: customer.createdAt,
                tags: customer.tags.map(t => t.tag.name)
            },
            stats: {
                ltv,
                totalConversations: customer.conversations.length,
                totalTickets: customer.tickets.length,
                totalInvoices: customer.invoices.length,
                openTickets: customer.tickets.filter(t => !['RESOLVED', 'CLOSED'].includes(t.status)).length
            },
            contacts: customer.contacts,
            conversations: customer.conversations.map(c => ({
                sessionId: c.sessionId,
                platform: c.platform,
                contact: c.customerContact,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
                messages: c.messages.map(m => ({
                    sender: m.sender,
                    content: m.content,
                    createdAt: m.createdAt,
                    type: m.mediaType
                }))
            })),
            tickets: customer.tickets.map(t => ({
                id: t.id,
                title: t.title,
                description: t.description,
                status: t.status,
                priority: t.priority,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt
            })),
            invoices: customer.invoices.map(i => ({
                id: i.id,
                number: i.number,
                type: i.type,
                amount: i.amount,
                status: i.status,
                createdAt: i.createdAt,
                notes: i.notes
            })),
            activities: customer.activities.map(a => ({
                type: (a as any).type,
                description: (a as any).description,
                createdAt: a.createdAt
            }))
        };

        const fileName = `cliente_${customer.name.replace(/[^a-zA-Z0-9]/g, '_')}_360.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.json(exportData);

    } catch (e: any) {
        console.error("GET /customers/:id/export error:", e);
        res.status(500).json({ error: e.message });
    }
});

export const customersRouter = router;
