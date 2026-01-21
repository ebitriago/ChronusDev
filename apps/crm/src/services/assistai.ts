import { prisma } from "../db.js";
import { loadAssistAICache, saveAssistAICache, type AssistAICache, conversations } from "../data.js";
import { AssistAIAgentConfig, ChatMessage } from "../types.js";

// AssistAI Configuration
// AssistAI Configuration
// const ASSISTAI_CONFIG = { ... } REMOVED


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

            // Cache successful response
            if (data && data.data) {
                const currentCache = loadAssistAICache();
                currentCache.agents = data.data;
                saveAssistAICache(currentCache);
            }
            return data;
        } catch (err: any) {
            console.error('[AssistAI] Agent fetch failed:', err.message);
            // Fallback to cache
            const cache = loadAssistAICache();
            if (cache.agents && cache.agents.length > 0) {
                console.log('[AssistAI] Returning cached agents');
                return { data: cache.agents, fromCache: true };
            }
            throw err;
        }
    },

    // Get single agent with details and remote config
    async getAgentDetails(config: AssistAIConfig, code: string) {
        // 1. Get basic info
        const agentsData = await this.getAgents(config);
        const agent = (agentsData.data || []).find((a: any) => a.code === code);

        if (!agent) {
            throw new Error("Agent not found");
        }

        // 2. Fetch detailed configuration (Prompt, Flow, etc.)
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

    // Get specific agent config (Direct Proxy)
    async getAgentConfig(config: AssistAIConfig, agentId: string) {
        // This proxies the specific curl command user requested
        return assistaiFetch(`/agents/${agentId}/configuration`, config);
    },

    // Get all conversations
    async getConversations(config: AssistAIConfig, params: {
        page?: number;
        take?: number;
        agentCode?: string;
        orderBy?: string;
        order?: 'ASC' | 'DESC';
    } = {}) {
        const { page = 1, take = 25, agentCode, orderBy = 'lastMessageDate', order = 'DESC' } = params;

        let endpoint = `/conversations?page=${page}&take=${take}&orderBy=${orderBy}&order=${order}`;

        if (agentCode) {
            endpoint += `&agentCode=${agentCode}`;
        }
        const response = await assistaiFetch(endpoint, config);

        // Map response to match Frontend expectations (AssistAI.tsx)
        // Expected: { uuid, title, createdAt, channel, agentCode }
        if (response && response.data && Array.isArray(response.data)) {
            response.data = response.data.map((c: any) => ({
                ...c,
                // Ensure uuid exists (it seems to work already, but strictly)
                uuid: c.uuid || c.id || c.sessionId,
                // Map Title from various potential sources
                title: c.title || c.subject || c.contact?.name || c.guest?.name || c.customerName || 'Sin título',
                // Map Date
                createdAt: c.createdAt || c.created_at || c.date || new Date().toISOString(),
                // Map Channel
                channel: c.channel || c.platform || (c.source === 'whatsapp' ? 'whatsapp' : 'manual')
            }));
        }

        return response;
    },

    // Get messages for a specific conversation
    async getMessages(config: AssistAIConfig, uuid: string, limit = 100) {
        return assistaiFetch(`/conversations/${uuid}/messages?take=${limit}&order=ASC`, config);
    },

    // Send a message
    async sendMessage(config: AssistAIConfig, uuid: string, content: string, senderName = 'Agent') {
        return assistaiPost(`/conversations/${uuid}/messages`, {
            content,
            senderMetadata: {
                id: 0, // Default or mock ID
                email: 'system@chronus.com', // Default
                firstname: senderName,
                lastname: 'Bot'
            }
        }, config);
    },

    // Full Sync Logic (Agents + Conversations + Messages)
    async syncAll(config: AssistAIConfig) {
        // 1. Get agents for mapping
        const agentsData = await this.getAgents(config);
        const agentsMap = new Map<string, string>();
        for (const agent of agentsData.data || []) {
            agentsMap.set(agent.code, agent.name);
        }

        // 2. Get conversations
        const convData = await assistaiFetch('/conversations?take=100', config);
        const results = {
            total: 0,
            synced: 0,
            updated: 0
        };

        const cache = loadAssistAICache();
        const cachedConvs = cache.conversations || [];
        const syncedConvs = [];

        for (const conv of convData.data || []) {
            results.total++;
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

            // Construct Conversation Object
            const fullConv = {
                sessionId,
                uuid: conv.uuid,
                platform: platform as 'assistai' | 'whatsapp' | 'instagram',
                customerContact: conv.sender || conv.contactPhone || conv.uuid,
                customerName: platform === 'instagram' ? `@${conv.sender || conv.uuid}` : (conv.sender || conv.uuid),
                agentCode,
                agentName,
                messages: messages.map((m: any) => ({
                    id: `msg-${m.id}`,
                    sessionId,
                    from: m.role === 'user' ? (conv.sender || 'user') : 'agent',
                    content: m.content || '',
                    platform: platform as any,
                    sender: m.role === 'user' ? 'user' : 'agent',
                    timestamp: new Date(m.createdAt),
                    status: 'read'
                })) as ChatMessage[],
                status: 'active' as const,
                createdAt: new Date(conv.createdAt),
                updatedAt: new Date(conv.updatedAt || conv.createdAt)
            };

            syncedConvs.push(fullConv);

            // UPDATE SHARED MEMORY STATE
            conversations.set(sessionId, fullConv);
        }

        // Update Cache
        cache.conversations = syncedConvs;
        saveAssistAICache(cache);

        return {
            success: true,
            ...results,
            conversations: syncedConvs
        };
    }
};
