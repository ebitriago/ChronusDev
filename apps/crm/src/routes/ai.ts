import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// GET /ai/context
router.get('/context', authMiddleware, async (req: any, res) => {
    try {
        const { identifier } = req.query;
        const organizationId = req.user?.organizationId;

        if (!identifier || typeof identifier !== 'string') {
            return res.status(400).json({ error: "Missing or invalid 'identifier' query parameter" });
        }

        if (!organizationId) {
            return res.status(401).json({ error: "No organization context" });
        }

        // Clean identifier (remove spaces, etc. if needed, but strict exact match is safer for now)
        const cleanId = identifier.trim();

        // 1. Specific Customer Search (Email or Phone directly on Customer)
        let customer = await prisma.customer.findFirst({
            where: {
                organizationId,
                OR: [
                    { email: cleanId },
                    { phone: cleanId },
                    // Also check contacts
                    {
                        contacts: {
                            some: { value: cleanId }
                        }
                    }
                ]
            },
            include: {
                tags: { include: { tag: true } },
                tickets: {
                    where: { status: { not: 'CLOSED' } }, // Only open/recent tickets are usually relevant
                    orderBy: { updatedAt: 'desc' },
                    take: 5
                },
                // Basic Invoice Stats
                invoices: {
                    where: { status: 'PAID' },
                    select: { amount: true }
                }
            }
        });

        if (!customer) {
            return res.status(404).json({ error: "Customer not found", identifier: cleanId });
        }

        // 2. Calculate Stats
        const ltv = customer.invoices.reduce((sum, inv) => sum + inv.amount, 0);

        // 3. Construct Optimized Payload
        const contextPayload = {
            profile: {
                id: customer.id,
                name: customer.name,
                company: customer.company || null,
                email: customer.email,
                phone: customer.phone,
                plan: customer.plan || 'UNKNOWN',
                status: customer.status,
                ltv: ltv,
                notes: customer.notes || null
            },
            tags: customer.tags.map(t => t.tag.name),
            active_tickets: customer.tickets.map(t => ({
                id: t.id,
                title: t.title,
                status: t.status,
                priority: t.priority,
                created_at: t.createdAt.toISOString(),
                updated_at: t.updatedAt.toISOString()
            })),
            computed_context: {
                is_vip: ltv > 1000 || customer.tags.some(t => t.tag.name.toLowerCase() === 'vip'),
                has_open_issues: customer.tickets.length > 0,
                days_since_creation: Math.floor((Date.now() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24))
            }
        };

        res.json(contextPayload);

    } catch (e: any) {
        console.error("GET /ai/context error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /ai/test-tool
 * Sandbox endpoint to simulate MCP tool calls directly from the UI
 */
router.post('/test-tool', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { tool, args } = req.body;

        if (!organizationId) return res.status(401).json({ error: "No organization context" });

        switch (tool) {
            case 'get_customer_context':
                // Reuse existing endpoint logic logic (simulated call or logic duplication)
                // For simplicity, we just return what the GET /context would return,
                // but we need to call the logic. 
                // Since this is a test tool, we can just fetch it again using prisma here.
                // Or easier: redirect to the GET function? Hard with Express.
                // Let's just create a helper or duplicate simple logic for the sandbox.

                // Call the logic directly via HTTP locally? No, that's messy.
                // I will just copy the logic for "findFirst" here for the sandbox 
                // as it's meant for quick verification.

                const identifier = args.identifier;
                if (!identifier) return res.status(400).json({ error: "Missing identifier" });

                const customer = await prisma.customer.findFirst({
                    where: {
                        organizationId,
                        OR: [{ email: identifier }, { phone: identifier }]
                    },
                    select: { name: true, email: true, phone: true, company: true }
                });

                if (!customer) return res.json({ result: "Customer not found" });
                return res.json({
                    result: "Success (Simplified Context)",
                    data: customer,
                    note: "Use the real MCP tool for full data."
                });

            case 'search_customers':
                const customers = await prisma.customer.findMany({
                    where: {
                        organizationId,
                        OR: [
                            { name: { contains: args.query, mode: 'insensitive' } },
                            { email: { contains: args.query, mode: 'insensitive' } },
                            { company: { contains: args.query, mode: 'insensitive' } }
                        ]
                    },
                    take: 5,
                    select: { name: true, email: true, company: true }
                });
                return res.json(customers);

            case 'list_products':
                const products = await prisma.globalProduct.findMany({
                    where: { organizationId },
                    take: 10
                });
                return res.json(products);

            case 'create_lead':
                // Sandbox simulation - don't actually create? Or do create?
                // Users expect "Test" to actually work usually in a sandbox.
                // Let's allow creation if they really want.
                if (!args.name) return res.status(400).json({ error: "Name required" });
                const newLead = await prisma.customer.create({
                    data: {
                        organizationId,
                        name: args.name,
                        email: args.email,
                        status: 'TRIAL' // Force valid status (TRIAL/ACTIVE/CHURNED etc)
                    }
                });
                return res.json({ success: true, lead: newLead });

            default:
                return res.status(400).json({ error: `Tool '${tool}' not supported in Sandbox yet.` });
        }

    } catch (e: any) {
        console.error("POST /ai/test-tool error:", e);
        res.status(500).json({ error: e.message });
    }
});

export const aiRouter = router;
