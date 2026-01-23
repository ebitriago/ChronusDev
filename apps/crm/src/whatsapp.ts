import { prisma } from './db.js';

export type WhatsAppMessage = {
    id: string;
    providerId: string;
    from: string;
    to: string;
    content: string;
    mediaType: 'text' | 'image' | 'audio' | 'video' | 'document';
    mediaUrl?: string;
    timestamp: Date;
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    direction: 'outbound' | 'inbound';
    metadata?: any;
};

export async function sendWhatsAppMessage(
    to: string,
    content: string,
    mediaType: 'text' | 'image' | 'audio' | 'video' | 'document' = 'text',
    mediaUrl?: string
): Promise<{ success: boolean; message?: WhatsAppMessage; error?: string }> {
    try {
        // Find active WhatsApp provider
        const provider = await prisma.integration.findFirst({
            where: {
                provider: { in: ['WHATSAPP', 'META_WHATSAPP', 'WHATSMEOW'] },
                isEnabled: true
            }
        });

        if (!provider) {
            return { success: false, error: "No hay proveedor de WhatsApp activo/conectado" };
        }

        const message: WhatsAppMessage = {
            id: `wa-msg-${Date.now()}`,
            providerId: provider.id,
            from: 'crm',
            to: to.replace(/\D/g, ''), // Clean number
            content,
            mediaType,
            mediaUrl,
            timestamp: new Date(),
            status: 'pending',
            direction: 'outbound'
        };

        const config = provider.credentials as any || {};

        // Send logic
        if (provider.provider === 'WHATSMEOW' || (config.type === 'whatsmeow')) {
            // WhatsMeow Logic (Placeholder / Bernardo's API)
            // For now, fast path simulation or API call if URL exists
            console.log(`[WhatsMeow] Mensaje simulado a ${to}: ${content}`);
            message.status = 'sent';

            // If we had a real API:
            // await fetch(`${config.apiUrl}/send`, ...);

        } else if (provider.provider === 'META_WHATSAPP' || (config.phoneNumberId && config.accessToken)) {
            // Meta Business API
            const response = await fetch(
                `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.accessToken}`
                    },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        to: message.to,
                        type: mediaType,
                        text: mediaType === 'text' ? { body: content } : undefined,
                        image: mediaType === 'image' ? { link: mediaUrl } : undefined
                    })
                }
            );

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'Error enviando mensaje Meta');
            }

            const data = await response.json();
            message.metadata = { messageId: data.messages?.[0]?.id };
            message.status = 'sent';
        } else {
            // Generic simulation or error if unknowns
            console.log(`[WhatsApp] Provider ${provider.provider} configured but logic not fully implemented. Simulating send.`);
            message.status = 'sent';
        }

        return { success: true, message };

    } catch (err: any) {
        console.error('[WhatsApp Send Error]', err);
        return { success: false, error: err.message };
    }
}
