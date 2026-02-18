import { prisma } from "../db.js";
import { ChatMessage } from "../types.js";

export interface AssistAIConfig {
    baseUrl: string;
    apiToken: string;
    tenantDomain: string;
    organizationCode: string;
}

// Helper to get AssistAI config for an organization
export async function getAssistAIConfig(organizationId: string): Promise<AssistAIConfig | null> {
    // First try org-specific integration
    let integration = await prisma.integration.findFirst({
        where: {
            organizationId: organizationId,
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

    return null;
}

// Helper for AssistAI GET requests
export async function assistaiFetch(endpoint: string, config: AssistAIConfig) {
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${config.apiToken}`,
        'x-tenant-domain': config.tenantDomain,
        'x-organization-code': config.organizationCode,
        'Content-Type': 'application/json',
    };

    try {
        const res = await fetch(`${config.baseUrl}/api/v1${endpoint}`, { headers });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`AssistAI error ${res.status}: ${errorText}`);
        }
        return res.json();
    } catch (error: any) {
        throw new Error(`AssistAI connection failed: ${error.message}`);
    }
}

// Helper for AssistAI POST requests
export async function assistaiPost(endpoint: string, body: any, config: AssistAIConfig) {
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${config.apiToken}`,
        'x-tenant-domain': config.tenantDomain,
        'x-organization-code': config.organizationCode,
        'Content-Type': 'application/json',
    };

    try {
        const res = await fetch(`${config.baseUrl}/api/v1${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || `AssistAI error ${res.status}`);
        }
        return res.json();
    } catch (error: any) {
        console.error(`[AssistAI] POST ${endpoint} failed:`, error);
        throw error;
    }
}

// Service Methods
export const AssistAIService = {
    // Create conversation with specific agent
    async createConversation(config: AssistAIConfig, data: { agentCode: string; contact?: any; guest?: any; source?: string }) {
        return assistaiPost('/conversations', data, config);
    },

    // Get all agents
    async getAgents(config: AssistAIConfig) {
        console.log('[AssistAI] Fetching agents...');
        try {
            // Timeout promise (5s)
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout connecting to AssistAI')), 5000));

            // Race between fetch and timeout
            const data: any = await Promise.race([
                assistaiFetch('/agents', config),
                timeout
            ]);

            return data;
        } catch (err: any) {
            console.error('[AssistAI] Agent fetch failed:', err.message);
            throw err;
        }
    },

    // Get single agent with details and remote config
    async getAgentDetails(config: AssistAIConfig, code: string) {
        const agentsData = await this.getAgents(config);
        const agent = (agentsData.data || []).find((a: any) => a.code === code);

        if (!agent) {
            throw new Error("Agent not found");
        }

        let remoteConfig = null;
        try {
            remoteConfig = await assistaiFetch(`/agents/${code}/configuration`, config);
        } catch (configErr: any) {
            console.warn(`Could not fetch remote config for agent ${code}:`, configErr.message);
        }

        return {
            ...agent,
            remoteConfig
        };
    },

    async getAgentConfig(config: AssistAIConfig, agentId: string) {
        return assistaiFetch(`/agents/${agentId}/configuration`, config);
    },

    async getConversations(config: AssistAIConfig, params: {
        page?: number;
        take?: number;
        agentCode?: string;
        orderBy?: string;
        order?: 'ASC' | 'DESC';
    } = {}) {
        const { page = 1, take = 25, agentCode, orderBy = 'lastMessageDate', order = 'DESC' } = params;

        // Singular endpoint per new docs (WAIT - 404'd, trying plural)
        let endpoint = `/conversations?page=${page}&take=${take}&orderBy=${orderBy}&order=${order}`;
        if (agentCode) endpoint += `&agentCode=${agentCode}`;

        const response = await assistaiFetch(endpoint, config);

        if (response && response.data && Array.isArray(response.data)) {
            response.data = response.data.map((c: any) => ({
                ...c,
                uuid: c.uuid || c.id || c.sessionId,
                title: c.title || c.subject || c.contact?.name || c.guest?.name || c.customerName || 'Sin título',
                createdAt: c.createdAt || c.created_at || c.date || new Date().toISOString(),
                channel: c.channel || c.platform || (c.source === 'whatsapp' ? 'whatsapp' : 'manual')
            }));
        }
        return response;
    },

    async getMessages(config: AssistAIConfig, uuid: string, limit = 100) {
        // Singular endpoint for messages
        return assistaiFetch(`/conversations/${uuid}/messages?take=${limit}&order=ASC`, config);
    },

    async sendMessage(config: AssistAIConfig, uuid: string, content: string, senderName = 'Agent', isIntervention = false) {
        // Singular endpoint for sending
        // If isIntervention is true, we might need to signal to AssistAI to pause the bot
        // Based on AssistAI docs (assumed), sending as a human usually pauses the bot automatically or requires a flag.
        // We will send 'role: agent' and specific metadata.

        return assistaiPost(`/conversations/${uuid}/messages`, {
            content,
            senderMetadata: {
                id: isIntervention ? 999 : 0, // 0 usually means bot
                email: isIntervention ? 'human@chronus.com' : 'system@chronus.com',
                firstname: senderName,
                lastname: isIntervention ? '(Human)' : 'Bot',
                role: isIntervention ? 'admin' : 'assistant'
            },
            // Some platforms use 'start_intervention' or similar flags. 
            // We'll assume the metadata role triggers the logic or we add a specific flag if known.
            intervention: isIntervention
        }, config);
    },

    // Sync specific recent conversations (e.g. last 20 per agent)
    async syncRecentConversations(config: AssistAIConfig, organizationId: string, limit = 10) {
        // console.log(`[AssistAI] Syncing conversations...`);

        // 1. Get agents
        let agents: any[] = [];
        try {
            const agentsData = await this.getAgents(config);
            agents = agentsData.data || [];
        } catch (e) {
            console.warn('[AssistAI] Failed to fetch agents for sync', e);
            return { success: false, syncedCount: 0 };
        }

        const syncedConvs = [];

        // 2. Sync for each agent to ensure we capture Agent Code/Name correctly
        // (Since the global list endpoint often omits agentCode)
        for (const agent of agents) {
            try {
                // Fetch recent conversations for this SPECIFIC agent
                const convData = await this.getConversations(config, { take: limit, agentCode: agent.code });

                for (const conv of convData.data || []) {
                    const uuid = conv.uuid || conv.id; // Correctly grab UUID
                    if (!uuid) continue;

                    const sessionId = `assistai-${uuid}`;

                    // Fetch messages
                    let messages: any[] = [];
                    try {
                        const msgData = await this.getMessages(config, uuid, 50);
                        messages = msgData.data || [];
                    } catch (e) {
                        // console.warn(`Failed to fetch messages for ${uuid}`);
                    }

                    // Determine Platform
                    const firstMessage = messages[0];
                    let platform = 'assistai';
                    if (firstMessage?.channel === 'whatsapp' || conv.source === 'whatsapp' || conv.channel === 'whatsapp') platform = 'whatsapp';
                    else if (firstMessage?.channel === 'instagram' || conv.source === 'instagram' || conv.channel === 'instagram') platform = 'instagram';
                    else if (firstMessage?.channel === 'web' || conv.source === 'web' || conv.channel === 'web') platform = 'web';

                    // Use Agent Info from the Loop Context
                    const agentCode = agent.code;
                    const agentName = agent.name;

                    // PERSIST TO DATABASE
                    try {
                        const dbConv = await prisma.conversation.upsert({
                            where: { sessionId },
                            update: {
                                updatedAt: new Date(conv.updatedAt || conv.createdAt || new Date()),
                                status: 'ACTIVE',
                                agentName: agentName,
                                agentCode: agentCode,
                                // Update customer info if it changed
                                customerName: conv.guest?.name || conv.contact?.name || conv.customer?.name || conv.title || `@${uuid}`,
                                customerContact: conv.contactPhone || conv.customer?.phone || conv.customer?.phoneNumber || uuid,
                            },
                            create: {
                                sessionId,
                                platform: platform.toUpperCase() as any,
                                customerName: conv.guest?.name || conv.contact?.name || conv.customer?.name || conv.title || `@${uuid}`,
                                customerContact: conv.contactPhone || conv.customer?.phone || conv.customer?.phoneNumber || uuid,
                                agentCode,
                                agentName,
                                organizationId,
                                status: 'ACTIVE',
                                createdAt: new Date(conv.createdAt || new Date()),
                                updatedAt: new Date(conv.updatedAt || conv.createdAt || new Date())
                            }
                        });

                        // Sync Messages
                        for (const m of messages) {
                            const msgDate = m.createdAt ? new Date(m.createdAt) : new Date();
                            const safeDate = isNaN(msgDate.getTime()) ? new Date() : msgDate;

                            await prisma.message.upsert({
                                where: { id: `assistai-${m.id}` },
                                update: { status: 'DELIVERED' },
                                create: {
                                    id: `assistai-${m.id}`,
                                    conversationId: dbConv.id,
                                    sender: m.role === 'user' ? 'USER' : 'AGENT',
                                    content: m.content || '',
                                    createdAt: safeDate,
                                }
                            });
                        }

                        syncedConvs.push(dbConv);
                    } catch (dbErr) {
                        console.error(`Error syncing conversation ${uuid}:`, dbErr);
                    }
                }
            } catch (agentErr) {
                console.warn(`[AssistAI] Failed to sync for agent ${agent.name}`, agentErr);
            }
        }

        return {
            success: true,
            syncedCount: syncedConvs.length,
            conversations: syncedConvs
        };
    },

    // Legacy full sync (can reuse new logic or keep separate)
    async syncAll(config: AssistAIConfig, organizationId: string) {
        return this.syncRecentConversations(config, organizationId, 100);
    }
};
