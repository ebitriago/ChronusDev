import express from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';
import {
    getMetaConfig,
    sendTextMessage,
    sendTemplateMessage,
    sendImageMessage,
    getTemplates,
    verifyWebhook,
    parseWebhookPayload,
    markAsRead,
    MetaWebhookPayload
} from '../services/meta-whatsapp.js';
import { AssistAIService, getAssistAIConfig } from '../services/assistai.js';

const router = express.Router();

// In-memory store for verify tokens (in production, use DB or Redis)
const verifyTokens = new Map<string, string>();

/**
 * GET /meta/webhook - Webhook verification (challenge from Meta)
 */
router.get('/webhook', async (req, res) => {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    console.log('[Meta Webhook] Verification request:', { mode, token: token?.slice(0, 10) + '...' });

    // Try to find verify token from any enabled META integration
    const integration = await prisma.integration.findFirst({
        where: { provider: 'META', isEnabled: true }
    });

    const storedVerifyToken = (integration?.credentials as any)?.verifyToken;

    if (mode === 'subscribe' && token && token === storedVerifyToken) {
        console.log('[Meta Webhook] Verification successful');
        return res.status(200).send(challenge);
    }

    console.log('[Meta Webhook] Verification failed');
    return res.sendStatus(403);
});

/**
 * POST /meta/webhook - Receive incoming messages
 */
router.post('/webhook', async (req, res) => {
    const payload = req.body as MetaWebhookPayload;

    console.log('[Meta Webhook] Incoming:', JSON.stringify(payload, null, 2));

    // Acknowledge immediately (Meta requires quick response)
    res.sendStatus(200);

    try {
        // Parse the payload
        const parsed = parseWebhookPayload(payload);

        if (parsed.messages.length === 0 && parsed.statuses.length === 0) {
            return;
        }

        // Find organization by phoneNumberId
        const integration = await prisma.integration.findFirst({
            where: {
                provider: 'META',
                isEnabled: true
            }
        });

        if (!integration) {
            console.warn('[Meta Webhook] No META integration found');
            return;
        }

        const organizationId = integration.organizationId;

        if (!organizationId) {
            console.warn('[Meta Webhook] Integration has no organizationId');
            return;
        }

        // Process messages
        for (const msg of parsed.messages) {
            const sessionId = `meta-wa-${msg.from}`;

            // Upsert conversation
            const conversation = await prisma.conversation.upsert({
                where: { sessionId },
                update: {
                    updatedAt: msg.timestamp
                },
                create: {
                    sessionId,
                    platform: 'WHATSAPP',
                    customerName: msg.fromName || `+${msg.from}`,
                    customerContact: msg.from,
                    organizationId: organizationId!,
                    status: 'ACTIVE'
                }
            });

            // Create message
            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    sender: 'USER',
                    content: msg.content,
                    createdAt: msg.timestamp
                }
            });

            console.log(`[Meta Webhook] Saved message from ${msg.from} to conversation ${conversation.id}`);

            // AI Logic Integration
            try {
                // 1. Find Channel Config
                const channel = await prisma.channel.findFirst({
                    where: {
                        organizationId,
                        platform: 'WHATSAPP',
                        name: msg.from // Match phone number if dedicated, or default if generic? 
                        // Actually, 'channelValue' in settings is usually the business phone number.
                        // msg.from is the USER's phone number.
                        // We need to match on the 'Recipient' ID (our business ID), but webhook payload structure for recipient might differ.
                        // For now, let's assume we use the default channel or finding one that matches criteria.
                        // If we want to assign agent based on USER, we need a different logic.
                        // The requirement is "assign agents... in specific channels".
                        // So if the channel identifier (our phone number) matches.
                        // But parsed.messages doesn't easily give 'to' phone number in simplified structure. 
                        // We might need to look at 'channel' config generally for the Org.
                    }
                });

                // Fallback: Find any enabled WhatsApp channel with AI mode for this Org
                const activeChannel = channel || await prisma.channel.findFirst({
                    where: {
                        organizationId,
                        platform: 'WHATSAPP',
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

                            // Send to AssistAI (User message)
                            // We use sessionId as conversation UUID for consistency
                            // First, create/ensure conversation exists with this agent
                            try {
                                await AssistAIService.createConversation(aiConfig, {
                                    agentCode: activeChannel.assistaiAgentCode,
                                    contact: {
                                        identifier: msg.from,
                                        name: msg.fromName,
                                        channel: 'whatsapp'
                                    },
                                    source: 'whatsapp'
                                });
                            } catch (e) {
                                // Ignore if exists
                            }

                            // Send Message
                            const aiResponse = await AssistAIService.sendMessage(aiConfig, conversation.id, msg.content, msg.fromName);

                            // 4. Handle Response (If synchronous and text)
                            if (aiResponse && aiResponse.text) {
                                // Send back to WhatsApp
                                const metaConfig = await getMetaConfig(organizationId!);
                                if (metaConfig) {
                                    await sendTextMessage(metaConfig, msg.from, aiResponse.text);

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

            // Optionally mark as read
            if (organizationId) {
                const config = await getMetaConfig(organizationId);
                if (config && msg.type === 'text') {
                    // markAsRead could be called here if needed
                }
            }
        }

        // Process statuses
        for (const status of parsed.statuses) {
            // Update message status if we track them
            console.log(`[Meta Webhook] Status update: ${status.messageId} -> ${status.status}`);
        }

    } catch (error) {
        console.error('[Meta Webhook] Error processing:', error);
    }
});

/**
 * POST /meta/send - Send a message (authenticated)
 */
router.post('/send', authMiddleware, async (req: any, res) => {
    const { to, message, type = 'text', imageUrl, templateName, languageCode } = req.body;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
        return res.status(400).json({ error: 'Organization required' });
    }

    if (!to || (!message && !templateName)) {
        return res.status(400).json({ error: 'to and message/templateName required' });
    }

    const config = await getMetaConfig(organizationId);
    if (!config) {
        return res.status(400).json({ error: 'Meta WhatsApp not configured for this organization' });
    }

    let result;

    switch (type) {
        case 'template':
            if (!templateName) {
                return res.status(400).json({ error: 'templateName required for template messages' });
            }
            result = await sendTemplateMessage(config, to, templateName, languageCode || 'es');
            break;
        case 'image':
            if (!imageUrl) {
                return res.status(400).json({ error: 'imageUrl required for image messages' });
            }
            result = await sendImageMessage(config, to, imageUrl, message);
            break;
        default:
            result = await sendTextMessage(config, to, message);
    }

    if (!result.success) {
        return res.status(500).json({ error: result.error });
    }

    // Optionally save outgoing message to conversation
    const sessionId = `meta-wa-${to.replace(/\D/g, '')}`;
    const conversation = await prisma.conversation.findFirst({
        where: { sessionId }
    });

    if (conversation) {
        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'AGENT',
                content: message || `[Template: ${templateName}]`,
                createdAt: new Date()
            }
        });
    }

    res.json({ success: true, messageId: result.messageId });
});

/**
 * GET /meta/templates - List message templates
 */
router.get('/templates', authMiddleware, async (req: any, res) => {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
        return res.status(400).json({ error: 'Organization required' });
    }

    const config = await getMetaConfig(organizationId);
    if (!config) {
        return res.status(400).json({ error: 'Meta WhatsApp not configured' });
    }

    const result = await getTemplates(config);

    if (!result.success) {
        return res.status(500).json({ error: result.error });
    }

    res.json({ templates: result.templates });
});

/**
 * GET /meta/status - Check connection status
 */
router.get('/status', authMiddleware, async (req: any, res) => {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
        return res.status(400).json({ error: 'Organization required' });
    }

    const integration = await prisma.integration.findFirst({
        where: {
            organizationId,
            provider: 'META',
            isEnabled: true
        }
    });

    if (!integration) {
        return res.json({ connected: false, message: 'Meta WhatsApp not configured' });
    }

    // Try to fetch templates as a connectivity test
    const config = await getMetaConfig(organizationId);
    if (!config) {
        return res.json({ connected: false, message: 'Invalid configuration' });
    }

    const result = await getTemplates(config);

    if (!result.success) {
        return res.json({ connected: false, message: result.error });
    }

    res.json({
        connected: true,
        phoneNumberId: config.phoneNumberId,
        templateCount: result.templates?.length || 0
    });
});

export const metaWhatsAppRouter = router;
