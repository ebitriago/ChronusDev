import express from "express";
import { AssistAIService } from "../services/assistai.js";
import { authMiddleware } from "../auth.js";
import { prisma } from "../db.js";
import { ChatMessage } from "../types.js";

const router = express.Router();

// Helper to get config
async function getConfig(req: express.Request) {
    const user = (req as any).user;
    if (!user || !user.organizationId) {
        throw new Error("User does not belong to an organization");
    }

    // Try to find Integration record for this org
    const integration = await prisma.integration.findFirst({
        where: {
            organizationId: user.organizationId,
            provider: 'ASSISTAI',
            isEnabled: true
        }
    });

    if (integration && integration.credentials) {
        const creds = integration.credentials as any;
        return {
            baseUrl: creds.baseUrl || process.env.ASSISTAI_API_URL || 'https://public.assistai.lat',
            apiToken: creds.apiToken,
            tenantDomain: creds.tenantDomain,
            organizationCode: creds.organizationCode
        };
    }

    // Fallback to Environment Variables
    if (process.env.ASSISTAI_API_TOKEN && process.env.ASSISTAI_TENANT_DOMAIN && process.env.ASSISTAI_ORG_CODE) {
        return {
            baseUrl: process.env.ASSISTAI_API_URL || 'https://public.assistai.lat',
            apiToken: process.env.ASSISTAI_API_TOKEN,
            tenantDomain: process.env.ASSISTAI_TENANT_DOMAIN,
            organizationCode: process.env.ASSISTAI_ORG_CODE
        };
    }

    throw new Error("AssistAI integration not configured for this organization");
}

// --- Public / Hybrid Routes ---

// GET All Agents (Cached)
router.get("/agents", async (req, res) => {
    try {
        const config = await getConfig(req);
        const result = await AssistAIService.getAgents(config);
        res.json(result);
    } catch (error: any) {
        res.status(503).json({ error: error.message });
    }
});

// GET Single Agent + Details
router.get("/agents/:code", authMiddleware, async (req: any, res) => {
    try {
        const config = await getConfig(req);
        const agent = await AssistAIService.getAgentDetails(config, req.params.code);

        // Fetch local config from AiAgent model
        const localConfig = await prisma.aiAgent.findFirst({
            where: {
                organizationId: req.user.organizationId,
                // We map 'code' to something? Maybe 'name' or stored in config/metadata?
                // AssistAI agents have a UUID 'code'.
                // Ideally we store mapping in DB. 
                // Let's assume we store the external 'code' in 'model' or 'config' or just rely on lookup by name match?
                // Or better, we store it in `apiKey` or specialized field.
                // For now, let's assume 'name' matches or we created an AiAgent with that ID logic.
                // Wait, AiAgent model logic might be different. 
                // Let's search by name for now as fallback or just skip if not linked.
                // Assuming we stored 'code' in 'model' or 'config'.
                // Actually maybe we should use `config.externalId`?
            }
        });

        // For now, returning basic details without local config until we map IDs properly
        res.json({
            ...agent,
            localConfig: null, // TODO: Implement mapping
            stats: { totalConversations: 0, recentConversations: [] }
        });
    } catch (error: any) {
        res.status(404).json({ error: error.message });
    }
});

// PUT Agent Local Config
router.put("/agents/:code/config", authMiddleware, async (req: any, res) => {
    const { code } = req.params;
    const { customName, notes, assignedToUserId } = req.body;
    const organizationId = req.user.organizationId;

    try {
        // Upsert logic would go here.
        // For now, placeholder response
        res.json({ success: true, message: "Use AiAgents API to configure local agents" });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET Agent Local Configs
router.get("/configs", authMiddleware, async (req: any, res) => {
    const configs = await prisma.aiAgent.findMany({
        where: { organizationId: req.user.organizationId }
    });
    res.json(configs);
});

// --- Proxy Routes ---

// GET Agent Configuration (Proxy)
router.get("/agent-config/:agentId", async (req, res) => {
    try {
        const config = await getConfig(req);
        const result = await AssistAIService.getAgentConfig(config, req.params.agentId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- Conversation Routes ---

// GET Conversations
router.get("/conversations", authMiddleware, async (req, res) => {
    try {
        const config = await getConfig(req);
        const { page, take, orderBy, order, agentCode } = req.query;

        const params = {
            page: page ? Number(page) : 1,
            take: take ? Number(take) : 25,
            orderBy: orderBy as string || 'lastMessageDate',
            order: (order as 'ASC' | 'DESC') || 'DESC',
            agentCode: agentCode as string
        };

        const result = await AssistAIService.getConversations(config, params);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET Messages for Conversation
router.get("/conversations/:uuid/messages", authMiddleware, async (req, res) => {
    try {
        const config = await getConfig(req);
        const result = await AssistAIService.getMessages(config, req.params.uuid);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST Send Message
router.post("/conversations/:uuid/messages", authMiddleware, async (req, res) => {
    try {
        const config = await getConfig(req);
        const { content, senderName } = req.body;
        const result = await AssistAIService.sendMessage(config, req.params.uuid, content, senderName);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST Sync All
router.post("/sync-all", authMiddleware, async (req, res) => {
    try {
        const config = await getConfig(req);
        const organizationId = (req as any).user.organizationId;
        const result = await AssistAIService.syncAll(config, organizationId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST Sync Recent (Optimized)
router.post("/sync-recent", authMiddleware, async (req, res) => {
    try {
        const config = await getConfig(req);
        const organizationId = (req as any).user.organizationId;
        const limit = req.body.limit ? Number(req.body.limit) : 20;
        const result = await AssistAIService.syncRecentConversations(config, organizationId, limit);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- POLL & REALTIME ---

// Polling endpoint
router.get("/poll", authMiddleware, async (req: any, res) => {
    try {
        const since = req.query.since ? new Date(req.query.since as string) : new Date(0);
        const organizationId = req.user.organizationId;

        // Fetch modified conversations since 'since'
        const updatedConvs = await prisma.conversation.findMany({
            where: {
                organizationId,
                updatedAt: { gt: since }
            } as any,
            include: { messages: { where: { createdAt: { gt: since } } } } as any // Include new messages
        });

        // Split into new vs updated logic if needed, but simple list is fine
        res.json({
            success: true,
            since: since.toISOString(),
            now: new Date().toISOString(),
            updated: updatedConvs,
            subscribedAgents: 'all'
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST Webhook (AssistAI calls this)
router.post("/webhook", async (req, res) => {
    // Simplified webhook handler
    const payload = req.body;
    const event = req.headers['x-assistai-event'] as string;

    console.log(`[AssistAI Webhook] ${event}`, payload);

    // We assume payload contains sufficient info to identify tenant/conversation.
    // If AssistAI passes organizationCode, we can map back.
    // Otherwise we need to lookup by external ID.

    // AssistAI Webhook Logic
    if (event === 'ORDER_CREATED') {
        try {
            console.log('[AssistAI Webhook] Processing ORDER_CREATED', payload);
            const { cart, customer, agentCode } = payload;

            // 1. Resolve Organization
            // Ideally use agentCode or payload.organizationCode
            // Fallback to 'chronus' slug for demo/PoC
            const defaultOrg = await prisma.organization.findFirst({ where: { slug: 'chronus' } });
            if (!defaultOrg) {
                console.error('[AssistAI Webhook] Default org not found');
                return res.status(404).json({ error: 'Default org not found' });
            }

            // 2. Resolve Customer
            let dbCustomer = await prisma.customer.findFirst({
                where: {
                    OR: [
                        { email: `${customer.phone}@whatsapp.user` },
                        { phone: customer.phone }
                    ],
                    organizationId: defaultOrg.id
                }
            });

            if (!dbCustomer) {
                dbCustomer = await prisma.customer.create({
                    data: {
                        name: customer.name || 'WhatsApp User',
                        email: `${customer.phone}@whatsapp.user`,
                        phone: customer.phone,
                        organizationId: defaultOrg.id,
                        status: 'ACTIVE',
                        plan: 'BASIC'
                    }
                });
            }

            // 3. Resolve Items & Create Products if missing (Auto-Catalog)
            const orderItems = [];
            for (const i of cart.items) {
                // Try to find product by SKU
                let product = await prisma.globalProduct.findFirst({
                    where: {
                        sku: i.sku,
                        organizationId: defaultOrg.id
                    }
                });

                // If not found, Auto-Create it! (Logical fix: Don't crash, learn)
                if (!product) {
                    console.log(`[AssistAI Webhook] Auto-creating missing product: ${i.sku}`);
                    product = await prisma.globalProduct.create({
                        data: {
                            name: i.name || `Producto ${i.sku}`,
                            description: 'Auto-created from AssistAI Order',
                            sku: i.sku,
                            price: Number(i.price),
                            stock: 0, // Unknown stock
                            organizationId: defaultOrg.id,
                            category: 'Uncategorized'
                        }
                    });
                }

                orderItems.push({
                    productId: product.id,
                    quantity: i.quantity,
                    unitPrice: Number(i.price),
                    total: Number(i.price) * Number(i.quantity)
                });
            }

            // 4. Create Order
            const order = await prisma.assistantShoppingCart.create({
                data: {
                    organizationId: defaultOrg.id,
                    customerId: dbCustomer.id,
                    status: 'COMPLETED',
                    total: Number(cart.total),
                    items: {
                        create: orderItems
                    }
                }
            });
            console.log('✅ Created Order from AssistAI Webhook:', order.id);

        } catch (e) {
            console.error('Error processing ORDER_CREATED:', e);
            return res.status(500).json({ error: 'Internal Error processing webhook' });
        }
    }

    res.json({ received: true });
});

export const assistaiRouter = router;
