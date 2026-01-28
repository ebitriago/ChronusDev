import { prisma } from "../db.js";
import { ChatMessage } from "../types.js";

export interface AssistAIConfig {
    baseUrl: string;
    apiToken: string;
    tenantDomain: string;
    organizationCode: string;
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
        return assistaiFetch(`/conversations/${uuid}/messages?take=${limit}&order=ASC`, config);
    },

    async sendMessage(config: AssistAIConfig, uuid: string, content: string, senderName = 'Agent') {
        return assistaiPost(`/conversations/${uuid}/messages`, {
            content,
            senderMetadata: {
                id: 0,
                email: 'system@chronus.com',
                firstname: senderName,
                lastname: 'Bot'
            }
        }, config);
    },

    // Full Sync Logic (Agents + Conversations + Messages)
    async syncAll(config: AssistAIConfig, organizationId: string) {
        // 1. Get agents for mapping
        const agentsData = await this.getAgents(config);
        const agentsMap = new Map<string, string>();
        for (const agent of agentsData.data || []) {
            agentsMap.set(agent.code, agent.name);
        }

        // 2. Get conversations
        const convData = await assistaiFetch('/conversations?take=100', config);
        const syncedConvs = [];

        for (const conv of convData.data || []) {
            const sessionId = `assistai-${conv.uuid}`;

            // Fetch messages
            let messages: any[] = [];
            try {
                const msgData = await this.getMessages(config, conv.uuid);
                messages = msgData.data || [];
            } catch (e) {
                console.warn(`Failed to fetch messages for ${conv.uuid}`);
            }

            // Determine Platform
            const firstMessage = messages[0];
            let platform = 'assistai';
            if (firstMessage?.channel === 'whatsapp') platform = 'whatsapp';
            else if (firstMessage?.channel === 'instagram') platform = 'instagram';

            // Agent Info
            const agentCode = conv.agentCode || '';
            const agentName = agentCode ? (agentsMap.get(agentCode) || 'AssistAI Bot') : 'Unknown Agent';

            // PERSIST TO DATABASE
            try {
                const dbConv = await prisma.conversation.upsert({
                    where: { sessionId },
                    update: {
                        updatedAt: new Date(conv.updatedAt || conv.createdAt),
                        status: 'ACTIVE',
                        agentName: agentName,
                        agentCode: agentCode
                    },
                    create: {
                        sessionId,
                        platform: platform.toUpperCase() as any,
                        customerName: platform === 'instagram' ? `@${conv.sender || conv.uuid}` : (conv.sender || conv.uuid),
                        customerContact: conv.sender || conv.contactPhone || conv.uuid,
                        agentCode,
                        agentName,
                        organizationId,
                        status: 'ACTIVE',
                        createdAt: new Date(conv.createdAt),
                        updatedAt: new Date(conv.updatedAt || conv.createdAt)
                    }
                });

                // Sync Messages
                for (const m of messages) {
                    await prisma.message.upsert({
                        where: { id: `assistai-${m.id}` },
                        update: { status: 'DELIVERED' },
                        create: {
                            id: `assistai-${m.id}`,
                            conversationId: dbConv.id,
                            sender: m.role === 'user' ? 'USER' : 'AGENT',
                            content: m.content || '',
                            createdAt: new Date(m.createdAt),
                        }
                    });
                }

                syncedConvs.push(dbConv);
            } catch (dbErr) {
                console.error(`Error syncing conversation ${conv.uuid}:`, dbErr);
            }
        }

        return {
            success: true,
            syncedCount: syncedConvs.length,
            conversations: syncedConvs
        };
    }
};
