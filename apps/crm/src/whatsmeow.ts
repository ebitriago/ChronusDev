// WhatsMeow WhatsApp API Client
// API Base: https://whatsapp.qassistai.work/api/v1

const WHATSMEOW_API_BASE = process.env.WHATSMEOW_API_URL || 'https://whatsapp.qassistai.work/api/v1';

// HTTP Basic Auth for WhatsMeow API server
const WHATSMEOW_API_USER = process.env.WHATSMEOW_API_USER || 'admin';
const WHATSMEOW_API_PASS = process.env.WHATSMEOW_API_PASS || '1234';
const WHATSMEOW_BASIC_AUTH = Buffer.from(`${WHATSMEOW_API_USER}:${WHATSMEOW_API_PASS}`).toString('base64');

// Types
export interface WhatsMeowAgent {
    id: number;
    code: string;
    token: string;
    deviceId?: { string: string; valid: boolean } | null;
    externalAgentId?: string;
    externalAgentToken?: string;
    incomingWebhook?: string;
}

export interface CreateAgentInput {
    externalAgentId?: string;
    externalAgentToken?: string;
    incomingWebhook?: string;
}

export interface SendMessageInput {
    to: string;
    message: string;
}

export interface SendImageInput {
    to: string;
    imageUrl: string;
    caption?: string;
}

export interface SendAudioInput {
    to: string;
    audioUrl: string;
    ptt?: boolean; // Push to talk (voice note)
}

export interface SendDocumentInput {
    to: string;
    documentUrl: string;
    fileName?: string;
    caption?: string;
}

export interface SendVideoInput {
    to: string;
    videoUrl: string;
    caption?: string;
}

export interface SendLocationInput {
    to: string;
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
}

export interface SendStickerInput {
    to: string;
    stickerUrl: string;
}

export interface PresenceInput {
    to: string;
    status: 'typing' | 'recording' | 'paused';
}

export interface QRCodeResponse {
    status: 'pending' | 'connected';
    qr?: string;
    deviceId?: string;
}

// Helper function for API calls
async function whatsMeowFetch<T>(
    endpoint: string,
    options: {
        method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        token?: string;
        body?: any;
    } = {}
): Promise<T> {
    const { method = 'GET', token, body } = options;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${WHATSMEOW_BASIC_AUTH}`,
    };

    if (token) {
        headers['X-Token'] = token;
    }

    const response = await fetch(`${WHATSMEOW_API_BASE}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const errorText = await response.text();
        // Don't log 404s as errors, just throw. It's common for getAgent checks.
        if (response.status !== 404) {
            console.error(`[WhatsMeow API Error] ${endpoint}: ${response.status} - ${errorText}`);
        }
        throw new Error(`WhatsMeow API error: ${response.status} - ${errorText}`);
    }

    // Check if response is image (QR PNG)
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('image/png')) {
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer) as unknown as T;
    }

    return response.json();
}

// Agent Management

/**
 * List all agents
 */
export async function getAgents(): Promise<WhatsMeowAgent[]> {
    return whatsMeowFetch<WhatsMeowAgent[]>('/agents');
}

/**
 * Create a new agent
 */
export async function createAgent(input?: CreateAgentInput): Promise<WhatsMeowAgent> {
    return whatsMeowFetch<WhatsMeowAgent>('/agents', {
        method: 'POST',
        body: input || {},
    });
}

/**
 * Get QR code for device linking (JSON response with status)
 */
export async function getQRCode(code: string, token: string): Promise<QRCodeResponse> {
    return whatsMeowFetch<QRCodeResponse>(`/agents/${code}/qrCode`, {
        method: 'POST',
        token,
    });
}

/**
 * Get QR code as PNG image
 */
export async function getQRImage(code: string, token: string): Promise<Buffer> {
    return whatsMeowFetch<Buffer>(`/agents/${code}/qr`, {
        method: 'GET',
        token,
    });
}

/**
 * Get WhatsApp account info for connected device
 */
export async function getAccountInfo(code: string, token: string): Promise<Record<string, any>> {
    return whatsMeowFetch<Record<string, any>>(`/agents/${code}/info`, {
        method: 'GET',
        token,
    });
}

/**
 * Disconnect WhatsApp device
 */
export async function disconnect(code: string, token: string): Promise<{ message: string }> {
    return whatsMeowFetch<{ message: string }>(`/agents/${code}/disconnect`, {
        method: 'POST',
        token,
    });
}

/**
 * Set incoming webhook URL for an agent
 * Messages received on WhatsApp will be forwarded to this URL
 */
export async function setWebhook(code: string, token: string, webhookUrl: string): Promise<WhatsMeowAgent> {
    return whatsMeowFetch<WhatsMeowAgent>(`/agents/${code}`, {
        method: 'PUT',
        token,
        body: { incomingWebhook: webhookUrl },
    });
}

/**
 * Get agent details including webhook configuration
 */
export async function getAgent(code: string, token: string): Promise<WhatsMeowAgent> {
    return whatsMeowFetch<WhatsMeowAgent>(`/agents/${code}/info`, {
        method: 'GET',
        token,
    });
}

// Message Sending

/**
 * Send text message
 */
export async function sendMessage(
    code: string,
    token: string,
    input: SendMessageInput
): Promise<{ message: string }> {
    return whatsMeowFetch<{ message: string }>(`/agents/${code}/message`, {
        method: 'POST',
        token,
        body: input,
    });
}

/**
 * Send image
 */
export async function sendImage(
    code: string,
    token: string,
    input: SendImageInput
): Promise<{ message: string }> {
    return whatsMeowFetch<{ message: string }>(`/agents/${code}/image`, {
        method: 'POST',
        token,
        body: input,
    });
}

/**
 * Send audio/voice note
 */
export async function sendAudio(
    code: string,
    token: string,
    input: SendAudioInput
): Promise<{ message: string }> {
    return whatsMeowFetch<{ message: string }>(`/agents/${code}/audio`, {
        method: 'POST',
        token,
        body: input,
    });
}

/**
 * Send document
 */
export async function sendDocument(
    code: string,
    token: string,
    input: SendDocumentInput
): Promise<{ message: string }> {
    return whatsMeowFetch<{ message: string }>(`/agents/${code}/document`, {
        method: 'POST',
        token,
        body: input,
    });
}

/**
 * Send video
 */
export async function sendVideo(
    code: string,
    token: string,
    input: SendVideoInput
): Promise<{ message: string }> {
    return whatsMeowFetch<{ message: string }>(`/agents/${code}/video`, {
        method: 'POST',
        token,
        body: input,
    });
}

/**
 * Send location
 */
export async function sendLocation(
    code: string,
    token: string,
    input: SendLocationInput
): Promise<{ message: string }> {
    return whatsMeowFetch<{ message: string }>(`/agents/${code}/location`, {
        method: 'POST',
        token,
        body: input,
    });
}

/**
 * Send sticker
 */
export async function sendSticker(
    code: string,
    token: string,
    input: SendStickerInput
): Promise<{ message: string }> {
    return whatsMeowFetch<{ message: string }>(`/agents/${code}/sticker`, {
        method: 'POST',
        token,
        body: input,
    });
}

/**
 * Send presence status (typing, recording, paused)
 */
export async function sendPresence(
    code: string,
    token: string,
    input: PresenceInput
): Promise<{ message: string }> {
    return whatsMeowFetch<{ message: string }>(`/agents/${code}/presence`, {
        method: 'POST',
        token,
        body: input,
    });
}

// Utility function to format phone number for WhatsApp
export function formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 0, assume local and need country code
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }

    // Ensure it doesn't start with +
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    }

    return cleaned;
}
