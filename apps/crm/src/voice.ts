import { prisma } from './db.js';

/**
 * Validates if the Agent ID exists in ElevenLabs.
 * This replaces the direct Twilio integration, allowing ElevenLabs to handle telephony.
 */
export async function validateAgentId(agentId: string, apiKey: string) {
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
            method: 'GET',
            headers: {
                'xi-api-key': apiKey
            }
        });

        if (!response.ok) {
            throw new Error(`Invalid Agent ID or API Key (Status: ${response.status})`);
        }

        const data = await response.json();
        return { success: true, agentName: data.name };
    } catch (err: any) {
        console.error('[Voice] Validation error:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Initiates an outbound call. 
 * Since we decoupled Twilio, this now relies on the ElevenLabs Widget or externally configured triggers.
 * If backend triggering is needed later, we can use ElevenLabs specific API if available.
 */
export async function initiateOutboundCall(customerNumber: string, agentId?: string) {
    // Current requirement: "The call must be executed from ElevenLabs".
    // Since we don't have direct Twilio credentials anymore, we cannot bridge the call ourselves.
    // We log the intent, but the actual call must be started via the Widget or Dashboard.
    console.log(`[Voice] Outbound call requested to ${customerNumber}. Please use the Voice Widget.`);
    return { success: false, error: "Direct outbound calling via backend is disabled. Please use the Voice Widget." };
}

// Handle incoming transcripts (unchanged, depends on webhook configuration in ElevenLabs)
export async function handleElevenLabsTranscript(payload: any) {
    try {
        console.log('[Voice] Received transcript payload:', JSON.stringify(payload, null, 2));
        if (!payload.conversation_id || !payload.transcript) {
            return;
        }
        return { success: true };
    } catch (err: any) {
        console.error('[Voice] Webhook error:', err.message);
        return { success: false, error: err.message };
    }
}
