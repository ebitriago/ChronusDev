import express from "express";
import { prisma } from "../db.js";
import { authMiddleware } from "../auth.js";
import { AssistAIService, getAssistAIConfig } from "../services/assistai.js";

const router = express.Router();

// GET All Agents
router.get("/", authMiddleware, async (req: any, res) => {
    try {
        const agents = await prisma.aiAgent.findMany({
            where: { organizationId: req.user.organizationId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(agents);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST Create Agent
router.post("/", authMiddleware, async (req: any, res) => {
    try {
        const { name, provider, model, systemPrompt, apiKey, description } = req.body;

        const agent = await prisma.aiAgent.create({
            data: {
                organizationId: req.user.organizationId,
                name,
                provider,
                model,
                systemPrompt,
                apiKey,
                description,
                isEnabled: true
            }
        });

        res.json(agent);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// PUT Update Agent
router.put("/:id", authMiddleware, async (req: any, res) => {
    try {
        const { name, provider, model, systemPrompt, apiKey, description, isEnabled } = req.body;

        const agent = await prisma.aiAgent.update({
            where: {
                id: req.params.id,
                organizationId: req.user.organizationId
            },
            data: {
                name,
                provider,
                model,
                systemPrompt,
                apiKey,
                description,
                isEnabled
            }
        });

        res.json(agent);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE Agent
router.delete("/:id", authMiddleware, async (req: any, res) => {
    try {
        await prisma.aiAgent.delete({
            where: {
                id: req.params.id,
                organizationId: req.user.organizationId
            }
        });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST Sync Agents from AssistAI
router.post("/sync-assistai", authMiddleware, async (req: any, res) => {
    try {
        console.log('[AI-Agents] Sync request from organization:', req.user.organizationId);

        const config = await getAssistAIConfig(req.user.organizationId);
        if (!config) {
            console.error('[AI-Agents] No AssistAI integration found for org:', req.user.organizationId);
            return res.status(400).json({ error: "AssistAI integration not configured. Please configure it in Integrations first." });
        }

        console.log('[AI-Agents] Fetching agents from AssistAI...');
        const remoteAgents = await AssistAIService.getAgents(config);
        const syncedAgents = [];

        if (remoteAgents && remoteAgents.data) {
            console.log(`[AI-Agents] Found ${remoteAgents.data.length} remote agents`);

            for (const ra of remoteAgents.data) {
                // Upsert logic based on name or some unique identifier
                // Since we don't store external ID yet, let's use name + provider or just create new if not exists?
                // Better: Check if we already have an agent with provider 'ASSISTAI' and name/model matching

                // We'll store the remote 'code' in the 'apiKey' field for reference or 'config' JSON
                // Using 'config' is cleaner.

                const existing = await prisma.aiAgent.findFirst({
                    where: {
                        organizationId: req.user.organizationId,
                        provider: 'ASSISTAI',
                        // Store the assistai code in the config json
                        // Check if we can filter by json path in prisma? Not easily in all DBs.
                        // Let's use name for now, or assume we create new ones.
                        name: ra.name
                    }
                });

                if (existing) {
                    // Update
                    const updated = await prisma.aiAgent.update({
                        where: { id: existing.id },
                        data: {
                            model: ra.model,
                            description: ra.description,
                            config: { assistaiCode: ra.code, ...ra },
                            updatedAt: new Date()
                        }
                    });
                    syncedAgents.push(updated);
                } else {
                    // Create
                    const created = await prisma.aiAgent.create({
                        data: {
                            organizationId: req.user.organizationId,
                            name: ra.name,
                            description: ra.description,
                            provider: 'ASSISTAI',
                            model: ra.model || 'gpt-4',
                            isEnabled: true,
                            config: { assistaiCode: ra.code, ...ra }
                        }
                    });
                    syncedAgents.push(created);
                }
            }

            console.log(`[AI-Agents] Successfully synced ${syncedAgents.length} agents`);
        } else {
            console.warn('[AI-Agents] No agents data returned from AssistAI');
        }

        res.json({ success: true, count: syncedAgents.length, agents: syncedAgents });
    } catch (error: any) {
        console.error("[AI-Agents] Sync error:", error);
        res.status(500).json({ error: error.message || 'Failed to sync agents' });
    }
});

// POST Test Agent
router.post("/:id/test", authMiddleware, async (req: any, res) => {
    try {
        const { message } = req.body;
        const agent = await prisma.aiAgent.findUnique({
            where: { id: req.params.id }
        });

        if (!agent) return res.status(404).json({ error: "Agent not found" });

        // Logic to test based on provider
        let response = "I am a simulated agent response.";

        if (agent.provider === 'ASSISTAI') {
            // Proxy to AssistAI conversation?
            // Or just say "Live testing for AssistAI agents is via the Widget/WhatsApp"
            response = "Para probar agentes de AssistAI, por favor usa el Widget o WhatsApp conectado.";
        } else if (agent.provider === 'OPENAI') {
            // ... OpenAI logic (mock for now)
            response = `[Mock OpenAI ${agent.model}] Processed: ${message}`;
        }

        res.json({ response });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export const aiAgentRouter = router;
