
/**
 * @openapi
 * /assistai/agents:
 *   get:
 *     tags: [AssistAI]
 *     summary: List all AI Agents
 *     responses:
 *       200:
 *         description: List of agents
 */
/**
 * @openapi
 * /assistai/conversations:
 *   get:
 *     tags: [AssistAI]
 *     summary: List conversations
 *     parameters:
 *       - in: query
 *         name: agentCode
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of conversations
 */
/**
 * @openapi
 * /assistai/conversations/{uuid}/messages:
 *   get:
 *     tags: [AssistAI]
 *     summary: Get messages for a conversation
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of messages
 */
/**
 * @openapi
 * /assistai/conversations/{uuid}/export:
 *   get:
 *     tags: [AssistAI]
 *     summary: Export Conversation History
 *     description: Download conversation history as JSON or TXT.
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, txt]
 *         description: Format of the export (default json)
 *     responses:
 *       200:
 *         description: File download
 */
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

    // Try to find Integration record for this org (or global)
    let integration = await prisma.integration.findFirst({
        where: {
            organizationId: user.organizationId,
            provider: 'ASSISTAI',
            isEnabled: true
        }
    });

    // Fallback to global integration (organizationId is NULL)
    if (!integration) {
        integration = await prisma.integration.findFirst({
            where: {
                organizationId: null,
                provider: 'ASSISTAI',
                isEnabled: true
            }
        });
    }

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

// POST Preview Chat - Create or continue a test conversation with an agent
router.post("/preview/chat", authMiddleware, async (req: any, res) => {
    try {
        const config = await getConfig(req);
        const { agentCode, message, conversationId } = req.body;

        if (!agentCode || !message) {
            return res.status(400).json({ error: "agentCode and message are required" });
        }

        let uuid = conversationId;

        // If no conversationId, create a new conversation
        if (!uuid) {
            console.log(`[AssistAI Preview] Creating new conversation for agent: ${agentCode}`);
            const convResult = await AssistAIService.createConversation(config, {
                agentCode,
                guest: { name: 'CRM Preview User' },
                source: 'crm-preview'
            });
            uuid = convResult.id || convResult.uuid || convResult.data?.id;
            console.log(`[AssistAI Preview] Created conversation: ${uuid}`);
        }

        // Send the user message
        console.log(`[AssistAI Preview] Sending message to conversation: ${uuid}`);
        await AssistAIService.sendMessage(config, uuid, message, 'CRM User');

        // Wait a moment for AI to process and respond
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Fetch messages to get the response
        const messagesResult = await AssistAIService.getMessages(config, uuid, 50);
        const messages = messagesResult.data || [];

        // Find the latest assistant response
        const agentResponse = messages
            .filter((m: any) => m.role === 'assistant' || m.sender === 'agent')
            .pop();

        res.json({
            success: true,
            conversationId: uuid,
            userMessage: message,
            agentResponse: agentResponse?.content || 'Procesando respuesta...',
            messages: messages.map((m: any) => ({
                role: m.role || (m.sender === 'user' ? 'user' : 'assistant'),
                content: m.content,
                createdAt: m.createdAt
            }))
        });
    } catch (error: any) {
        console.error('[AssistAI Preview] Error:', error);
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

// GET /conversations/:uuid/export (Download conversation history as JSON)
router.get("/conversations/:uuid/export", authMiddleware, async (req, res) => {
    try {
        const config = await getConfig(req);
        const { uuid } = req.params;
        const format = (req.query.format as string) || 'json';

        // Fetch all messages
        const result = await AssistAIService.getMessages(config, uuid, 500);
        const messages = result.data || [];

        // Look up local conversation info
        const conversation = await prisma.conversation.findFirst({
            where: { sessionId: uuid },
            include: {
                customer: { select: { id: true, name: true, email: true, phone: true } }
            }
        });

        if (format === 'txt') {
            // Plain text format
            let text = `=== Conversación ${uuid} ===\n`;
            text += `Fecha de exportación: ${new Date().toISOString()}\n`;
            if (conversation?.customer) {
                text += `Cliente: ${conversation.customer.name} (${conversation.customer.email || conversation.customer.phone})\n`;
            }
            text += `Plataforma: ${conversation?.platform || 'N/A'}\n`;
            text += `Total mensajes: ${messages.length}\n`;
            text += `${'='.repeat(50)}\n\n`;

            messages.forEach((m: any) => {
                const time = m.createdAt ? new Date(m.createdAt).toLocaleString('es-ES') : '';
                const sender = m.sender || m.role || 'unknown';
                text += `[${time}] ${sender.toUpperCase()}: ${m.content}\n\n`;
            });

            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="conversacion_${uuid.slice(0, 8)}.txt"`);
            return res.send(text);
        }

        // JSON format
        const exportData = {
            exportDate: new Date().toISOString(),
            conversationId: uuid,
            platform: conversation?.platform || null,
            customer: conversation?.customer || null,
            totalMessages: messages.length,
            messages: messages.map((m: any) => ({
                sender: m.sender || m.role,
                content: m.content,
                createdAt: m.createdAt,
                type: m.mediaType || 'text'
            }))
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="conversacion_${uuid.slice(0, 8)}.json"`);
        res.json(exportData);

    } catch (error: any) {
        console.error("GET /conversations/:uuid/export error:", error);
        res.status(500).json({ error: error.message });
    }
});

// POST Send Message
router.post("/conversations/:uuid/messages", authMiddleware, async (req, res) => {
    try {
        const config = await getConfig(req);
        const { content, senderName, isIntervention } = req.body;
        const result = await AssistAIService.sendMessage(config, req.params.uuid, content, senderName, isIntervention);
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
/**
 * @openapi
 * /assistai/webhook:
 *   post:
 *     tags: [AssistAI]
 *     summary: Receive events from AssistAI (e.g., Order Created)
 *     description: Public webhook to receive real-time events from AssistAI agents.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               agentCode:
 *                 type: string
 *               customer:
 *                 type: object
 *                 properties:
 *                   name: 
 *                     type: string
 *                   phone: 
 *                     type: string
 *               cart:
 *                 type: object
 *                 properties:
 *                   total: 
 *                     type: number
 *                   items:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         sku: 
 *                           type: string
 *                         quantity: 
 *                           type: number
 *                         price: 
 *                           type: number
 *     responses:
 *       200:
 *         description: Event received successfully
 */
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
            const { cart, customer, agentCode, organizationCode } = payload;

            // 1. Resolve Organization
            // Ideally use agentCode or payload.organizationCode
            let defaultOrg = null;
            if (organizationCode) {
                defaultOrg = await prisma.organization.findFirst({ where: { slug: organizationCode } });
            }

            // Fallback to 'chronus' slug for demo/PoC
            if (!defaultOrg) {
                defaultOrg = await prisma.organization.findFirst({ where: { slug: 'chronus' } });
            }

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
