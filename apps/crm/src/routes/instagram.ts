import express from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';
import { AssistAIService, getAssistAIConfig } from '../services/assistai.js';

const router = express.Router();

/**
 * Instagram Messaging API Integration
 * 
 * Required credentials (stored in Integration.credentials):
 * - accessToken: Instagram/Facebook Page Access Token
 * - igUserId: Instagram User ID
 * - pageId: Connected Facebook Page ID
 */

interface InstagramConfig {
    accessToken: string;
    igUserId: string;
    pageId: string;
}

const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Get Instagram config for an organization
 */
async function getInstagramConfig(organizationId: string): Promise<InstagramConfig | null> {
    const integration = await prisma.integration.findFirst({
        where: {
            organizationId,
            provider: 'INSTAGRAM',
            isEnabled: true
        }
    });

    if (!integration || !integration.credentials) {
        return null;
    }

    const creds = integration.credentials as any;
    return {
        accessToken: creds.accessToken,
        igUserId: creds.igUserId,
        pageId: creds.pageId
    };
}

/**
 * GET /instagram/webhook - Webhook verification
 */
router.get('/webhook', async (req, res) => {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    console.log('[Instagram Webhook] Verification request:', { mode, token: token?.slice(0, 10) + '...' });

    // Find verify token from any enabled INSTAGRAM integration
    const integration = await prisma.integration.findFirst({
        where: { provider: 'INSTAGRAM', isEnabled: true }
    });

    const storedVerifyToken = (integration?.credentials as any)?.verifyToken;

    if (mode === 'subscribe' && token && token === storedVerifyToken) {
        console.log('[Instagram Webhook] Verification successful');
        return res.status(200).send(challenge);
    }

    console.log('[Instagram Webhook] Verification failed');
    return res.sendStatus(403);
});

/**
 * POST /instagram/webhook - Receive incoming DMs
 */
router.post('/webhook', async (req, res) => {
    const payload = req.body;

    console.log('[Instagram Webhook] Incoming:', JSON.stringify(payload, null, 2));

    // Acknowledge immediately
    res.sendStatus(200);

    try {
        // Instagram webhook payload structure
        if (payload.object !== 'instagram') {
            return;
        }

        for (const entry of payload.entry || []) {
            // Process messaging events
            for (const messaging of entry.messaging || []) {
                const senderId = messaging.sender?.id;
                const recipientId = messaging.recipient?.id;
                const message = messaging.message;

                if (!senderId || !message) continue;

                // Find organization by IG User ID
                const integration = await prisma.integration.findFirst({
                    where: {
                        provider: 'INSTAGRAM',
                        isEnabled: true
                    }
                });

                if (!integration) {
                    console.warn('[Instagram Webhook] No INSTAGRAM integration found');
                    continue;
                }

                const organizationId = integration.organizationId;
                if (!organizationId) continue;
                const sessionId = `instagram-${senderId}`;

                // Get user profile for name
                let userName = `IG:${senderId}`;
                try {
                    const config = await getInstagramConfig(organizationId);
                    if (config) {
                        const profileRes = await fetch(
                            `${GRAPH_API_BASE}/${senderId}?fields=name,username&access_token=${config.accessToken}`
                        );
                        if (profileRes.ok) {
                            const profile = await profileRes.json() as any;
                            userName = profile.name || profile.username || userName;
                        }
                    }
                } catch (e) {
                    // Ignore profile fetch errors
                }

                // Upsert conversation
                const conversation = await prisma.conversation.upsert({
                    where: { sessionId },
                    update: {
                        updatedAt: new Date()
                    },
                    create: {
                        sessionId,
                        platform: 'INSTAGRAM',
                        customerName: userName,
                        customerContact: senderId,
                        organizationId: organizationId!,
                        status: 'ACTIVE'
                    }
                });

                // Create message
                await prisma.message.create({
                    data: {
                        conversationId: conversation.id,
                        sender: 'USER',
                        content: message.text || '[Media]',
                        createdAt: new Date(messaging.timestamp || Date.now())
                    }
                });

                console.log(`[Instagram Webhook] Saved message from ${senderId} to conversation ${conversation.id}`);

                // AI Logic Integration
                try {
                    // 1. Find Channel Config
                    // For Instagram, we might rely on the single connected user (igUserId) per Org.
                    // But if we have multiple, we'd need to match recipientId.
                    // Assuming one main Instagram channel per Org for now.

                    const activeChannel = await prisma.channel.findFirst({
                        where: {
                            organizationId,
                            platform: 'INSTAGRAM',
                            enabled: true,
                            mode: { in: ['AI_ONLY', 'HYBRID'] }
                        }
                    });

                    if (activeChannel && (activeChannel.mode === 'AI_ONLY' || activeChannel.mode === 'HYBRID')) {
                        // 2. Check for Human Takeover
                        const takeover = await prisma.takeover.findUnique({
                            where: { conversationId: conversation.id }
                        });

                        if (takeover && takeover.expiresAt > new Date()) {
                            console.log(`[AssistAI] Skipping: Human takeover active for ${sessionId}`);
                            continue;
                        }

                        // 3. Trigger AssistAI
                        if (activeChannel.assistaiAgentCode) {
                            const aiConfig = await getAssistAIConfig(organizationId!);
                            if (aiConfig) {
                                console.log(`[AssistAI] Triggering agent ${activeChannel.assistaiAgentCode} for ${sessionId}`);

                                // Create/Ensure Conversation
                                try {
                                    await AssistAIService.createConversation(aiConfig, {
                                        agentCode: activeChannel.assistaiAgentCode,
                                        contact: {
                                            identifier: senderId,
                                            name: userName,
                                            channel: 'instagram'
                                        },
                                        source: 'instagram'
                                    });
                                } catch (e) {
                                    // Ignore
                                }

                                // Send Message
                                const aiResponse = await AssistAIService.sendMessage(aiConfig, conversation.id, message.text || '[Media]', userName);

                                // 4. Handle Response
                                if (aiResponse && aiResponse.text) {
                                    // Send back to Instagram
                                    const config = await getInstagramConfig(organizationId!);
                                    if (config) {
                                        await fetch(`${GRAPH_API_BASE}/${config.igUserId}/messages`, {
                                            method: 'POST',
                                            headers: {
                                                'Authorization': `Bearer ${config.accessToken}`,
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({
                                                recipient: { id: senderId },
                                                message: { text: aiResponse.text }
                                            })
                                        });

                                        // Save AI reply
                                        await prisma.message.create({
                                            data: {
                                                conversationId: conversation.id,
                                                sender: 'AI',
                                                content: aiResponse.text
                                            }
                                        });
                                    }
                                }
                            }
                        } else {
                            console.log(`[AssistAI] No agent assigned to channel ${activeChannel.name}`);
                        }
                    }
                } catch (aiError) {
                    console.error('[AssistAI] Error trigger:', aiError);
                }
            }
        }
    } catch (error) {
        console.error('[Instagram Webhook] Error processing:', error);
    }
});

/**
 * POST /instagram/send - Send a DM (authenticated)
 */
router.post('/send', authMiddleware, async (req: any, res) => {
    const { to, message } = req.body;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
        return res.status(400).json({ error: 'Organization required' });
    }

    if (!to || !message) {
        return res.status(400).json({ error: 'to and message required' });
    }

    const config = await getInstagramConfig(organizationId);
    if (!config) {
        return res.status(400).json({ error: 'Instagram not configured for this organization' });
    }

    try {
        const response = await fetch(`${GRAPH_API_BASE}/${config.igUserId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipient: { id: to },
                message: { text: message }
            })
        });

        const data = await response.json() as any;

        if (!response.ok) {
            return res.status(500).json({ error: data.error?.message || 'Failed to send message' });
        }

        // Save outgoing message
        const sessionId = `instagram-${to}`;
        const conversation = await prisma.conversation.findFirst({
            where: { sessionId }
        });

        if (conversation) {
            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    sender: 'AGENT',
                    content: message,
                    createdAt: new Date()
                }
            });
        }

        res.json({ success: true, messageId: data.message_id });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /instagram/status - Check connection status
 */
router.get('/status', authMiddleware, async (req: any, res) => {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
        return res.status(400).json({ error: 'Organization required' });
    }

    const config = await getInstagramConfig(organizationId);
    if (!config) {
        return res.json({ connected: false, message: 'Instagram not configured' });
    }

    try {
        // Test connection by fetching IG account info
        const response = await fetch(
            `${GRAPH_API_BASE}/${config.igUserId}?fields=id,username&access_token=${config.accessToken}`
        );

        if (!response.ok) {
            const data = await response.json() as any;
            return res.json({ connected: false, message: data.error?.message || 'Connection failed' });
        }

        const data = await response.json() as any;
        res.json({
            connected: true,
            igUserId: config.igUserId,
            username: data.username
        });
    } catch (error: any) {
        res.json({ connected: false, message: error.message });
    }
});

export const instagramRouter = router;
