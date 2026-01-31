import fetch from 'node-fetch';
import { prisma } from '../db.js';

export interface MetaWhatsAppConfig {
    accessToken: string;
    phoneNumberId: string;
    businessAccountId: string;
    verifyToken: string;
}

export interface MetaMessage {
    from: string;
    timestamp: string;
    type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'location' | 'contacts';
    text?: { body: string };
    image?: { id: string; caption?: string };
    document?: { id: string; filename?: string };
    audio?: { id: string };
    video?: { id: string };
}

export interface MetaWebhookPayload {
    object: string;
    entry: Array<{
        id: string;
        changes: Array<{
            value: {
                messaging_product: string;
                metadata: { display_phone_number: string; phone_number_id: string };
                contacts?: Array<{ profile: { name: string }; wa_id: string }>;
                messages?: MetaMessage[];
                statuses?: Array<{
                    id: string;
                    status: 'sent' | 'delivered' | 'read' | 'failed';
                    timestamp: string;
                    recipient_id: string;
                }>;
            };
            field: string;
        }>;
    }>;
}

const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Get Meta WhatsApp config for an organization
 */
export async function getMetaConfig(organizationId: string): Promise<MetaWhatsAppConfig | null> {
    const integration = await prisma.integration.findFirst({
        where: {
            organizationId,
            provider: 'META',
            isEnabled: true
        }
    });

    if (!integration || !integration.credentials) {
        return null;
    }

    const creds = integration.credentials as any;
    return {
        accessToken: creds.accessToken,
        phoneNumberId: creds.phoneNumberId,
        businessAccountId: creds.businessAccountId,
        verifyToken: creds.verifyToken
    };
}

/**
 * Send a text message via Meta WhatsApp Business API
 */
export async function sendTextMessage(
    config: MetaWhatsAppConfig,
    to: string,
    body: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const url = `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to.replace(/\D/g, ''), // Clean phone number
                type: 'text',
                text: { body }
            })
        });

        const data = await response.json() as any;

        if (!response.ok) {
            return { success: false, error: data.error?.message || 'Unknown error' };
        }

        return { success: true, messageId: data.messages?.[0]?.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Send a template message (for initiating conversations)
 */
export async function sendTemplateMessage(
    config: MetaWhatsAppConfig,
    to: string,
    templateName: string,
    languageCode: string = 'es',
    components?: any[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const url = `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`;

        const payload: any = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: to.replace(/\D/g, ''),
            type: 'template',
            template: {
                name: templateName,
                language: { code: languageCode }
            }
        };

        if (components && components.length > 0) {
            payload.template.components = components;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json() as any;

        if (!response.ok) {
            return { success: false, error: data.error?.message || 'Unknown error' };
        }

        return { success: true, messageId: data.messages?.[0]?.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Send an image message
 */
export async function sendImageMessage(
    config: MetaWhatsAppConfig,
    to: string,
    imageUrl: string,
    caption?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const url = `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to.replace(/\D/g, ''),
                type: 'image',
                image: {
                    link: imageUrl,
                    caption
                }
            })
        });

        const data = await response.json() as any;

        if (!response.ok) {
            return { success: false, error: data.error?.message || 'Unknown error' };
        }

        return { success: true, messageId: data.messages?.[0]?.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Mark a message as read
 */
export async function markAsRead(
    config: MetaWhatsAppConfig,
    messageId: string
): Promise<boolean> {
    try {
        const url = `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId
            })
        });

        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Get list of message templates
 */
export async function getTemplates(
    config: MetaWhatsAppConfig
): Promise<{ success: boolean; templates?: any[]; error?: string }> {
    try {
        const url = `${GRAPH_API_BASE}/${config.businessAccountId}/message_templates`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${config.accessToken}`
            }
        });

        const data = await response.json() as any;

        if (!response.ok) {
            return { success: false, error: data.error?.message || 'Unknown error' };
        }

        return { success: true, templates: data.data || [] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Verify webhook subscription
 */
export function verifyWebhook(
    mode: string,
    token: string,
    challenge: string,
    verifyToken: string
): { valid: boolean; challenge?: string } {
    if (mode === 'subscribe' && token === verifyToken) {
        return { valid: true, challenge };
    }
    return { valid: false };
}

/**
 * Parse incoming webhook payload
 */
export function parseWebhookPayload(payload: MetaWebhookPayload): {
    phoneNumberId: string;
    messages: Array<{
        from: string;
        fromName?: string;
        timestamp: Date;
        type: string;
        content: string;
        mediaId?: string;
    }>;
    statuses: Array<{
        messageId: string;
        status: string;
        timestamp: Date;
        recipientId: string;
    }>;
} {
    const result = {
        phoneNumberId: '',
        messages: [] as any[],
        statuses: [] as any[]
    };

    for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
            if (change.field !== 'messages') continue;

            const value = change.value;
            result.phoneNumberId = value.metadata?.phone_number_id || '';

            // Parse contacts for names
            const contactNames = new Map<string, string>();
            for (const contact of value.contacts || []) {
                contactNames.set(contact.wa_id, contact.profile?.name || '');
            }

            // Parse messages
            for (const msg of value.messages || []) {
                let content = '';
                let mediaId = '';

                switch (msg.type) {
                    case 'text':
                        content = msg.text?.body || '';
                        break;
                    case 'image':
                        content = msg.image?.caption || '[Imagen]';
                        mediaId = msg.image?.id || '';
                        break;
                    case 'document':
                        content = msg.document?.filename || '[Documento]';
                        mediaId = msg.document?.id || '';
                        break;
                    case 'audio':
                        content = '[Audio]';
                        mediaId = msg.audio?.id || '';
                        break;
                    case 'video':
                        content = '[Video]';
                        mediaId = msg.video?.id || '';
                        break;
                    default:
                        content = `[${msg.type}]`;
                }

                result.messages.push({
                    from: msg.from,
                    fromName: contactNames.get(msg.from),
                    timestamp: new Date(parseInt(msg.timestamp) * 1000),
                    type: msg.type,
                    content,
                    mediaId
                });
            }

            // Parse statuses
            for (const status of value.statuses || []) {
                result.statuses.push({
                    messageId: status.id,
                    status: status.status,
                    timestamp: new Date(parseInt(status.timestamp) * 1000),
                    recipientId: status.recipient_id
                });
            }
        }
    }

    return result;
}
