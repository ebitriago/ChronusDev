import express from "express";
import { AssistAIService } from "../services/assistai.js";
import { authMiddleware } from "../auth.js";
import { loadAssistAICache, saveAssistAICache, type AgentLocalConfig, conversations, getOrganizationConfig } from "../data.js";
import { ChatMessage } from "../types.js";

const router = express.Router();

// Local Config Persistence
// We keep this here or move to a service.
const agentLocalConfigs: Map<string, AgentLocalConfig> = new Map();

import { prisma } from "../db.js";

// Helper to get config
async function getConfig(req: express.Request) {
    const user = (req as any).user;
    if (!user || !user.organizationId) {
        // Fallback or error
        // For development/demo, maybe we fallback to env vars if no org
        // But for strict multi-tenancy:
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

    // Fallback to Organization model config (legacy support based on index.ts)
    const org = await prisma.organization.findUnique({ where: { id: user.organizationId } });
    const legacyConfig = (org?.assistaiConfig as any);

    if (legacyConfig && legacyConfig.apiToken) {
        return {
            baseUrl: process.env.ASSISTAI_API_URL || 'https://public.assistai.lat',
            apiToken: legacyConfig.apiToken,
            tenantDomain: legacyConfig.tenantDomain,
            organizationCode: legacyConfig.organizationCode
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
router.get("/agents/:code", async (req, res) => {
    try {
        const config = await getConfig(req);
        const agent = await AssistAIService.getAgentDetails(config, req.params.code);
        const localConfig = agentLocalConfigs.get(req.params.code);

        // Mock stats for now as per original code
        const stats = { totalConversations: 0, recentConversations: [] };

        res.json({
            ...agent,
            localConfig: localConfig || null,
            stats
        });
    } catch (error: any) {
        res.status(404).json({ error: error.message });
    }
});

// PUT Agent Local Config
router.put("/agents/:code/config", authMiddleware, (req, res) => {
    const { code } = req.params;
    const { customName, notes, assignedToUserId } = req.body;

    const existing = agentLocalConfigs.get(code) || { code, updatedAt: new Date() };
    const updated: AgentLocalConfig = {
        ...existing,
        customName: customName !== undefined ? customName : existing.customName,
        notes: notes !== undefined ? notes : existing.notes,
        assignedToUserId: assignedToUserId !== undefined ? assignedToUserId : existing.assignedToUserId,
        updatedAt: new Date()
    };

    agentLocalConfigs.set(code, updated);
    res.json({ success: true, config: updated });
});

// GET Agent Local Configs
router.get("/configs", authMiddleware, (req, res) => {
    res.json(Array.from(agentLocalConfigs.values()));
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
        const result = await AssistAIService.syncAll(config);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- POLL & REALTIME ---

let lastSyncTime: Date = new Date(0);

// Polling endpoint
router.get("/poll", async (req, res) => {
    try {
        const since = req.query.since ? new Date(req.query.since as string) : lastSyncTime;

        // This logic mimics the original heavy poll endpoint, but simplified to use Service
        // In a real app, this should be lighter or use websockets exclusively.
        // For now, let's trigger a sync if needed or just return current state diff.

        // Return diff of conversations in memory
        const allConvs = Array.from(conversations.values());
        const newConvs = allConvs.filter(c => c.createdAt > since);
        const updatedConvs = allConvs.filter(c => c.updatedAt > since && c.createdAt <= since);

        res.json({
            success: true,
            since: since.toISOString(),
            now: new Date().toISOString(),
            new: newConvs,
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
    // In production, verify signature
    const payload = req.body;
    const event = req.headers['x-assistai-event'] as string;

    console.log(`[AssistAI Webhook] ${event}`, payload);

    if (event === 'new_message' || event === 'message.created') {
        // Update memory state
        const { sessionId, message } = payload;
        const conv = conversations.get(sessionId);
        if (conv) {
            const newMsg: ChatMessage = {
                id: message.id,
                sessionId,
                from: message.from || 'User',
                content: message.content,
                platform: conv.platform,
                sender: message.sender || 'user',
                timestamp: new Date()
            };
            conv.messages.push(newMsg);
            conv.updatedAt = new Date();

            // Emit socket event if we had access to IO here.
            // TODO: Move IO logic to service or event bus.
        }
    }

    res.json({ received: true });
});

export const assistaiRouter = router;
