
import cron from 'node-cron';
import { prisma } from '../db.js';
import { AssistAIService, getAssistAIConfig } from '../services/assistai.js';

/**
 * Job: AssistAI Conversation Sync
 * Frequency: Every 1 minute
 * Purpose: Ensures recent conversations are synced to local DB even without user activity.
 */

let isJobRunning = false;

export const startAssistAISyncJob = () => {
    console.log('[Job] Starting AssistAI Sync Job (Every 1 minute)...');

    // Schedule task to run every minute
    cron.schedule('* * * * *', async () => {
        if (isJobRunning) {
            console.log('[Job] AssistAI Sync skipped - previous run still active');
            return;
        }

        isJobRunning = true;

        try {
            // Fetch all active organizations
            // We iterate all orgs because the integration might be global (orgId=null)
            // and getAssistAIConfig() handles the resolution (specific > global > env).
            const organizations = await prisma.organization.findMany({
                where: { subscriptionStatus: 'ACTIVE' }
            });

            if (organizations.length === 0) {
                // console.log('[Job] No active organizations to sync.');
                return;
            }

            // Sync for each organization
            for (const org of organizations) {
                await syncForOrganization(org.id);
            }

        } catch (error) {
            console.error('[Job] AssistAI Sync Error:', error);
        } finally {
            isJobRunning = false;
        }
    });
};

async function syncForOrganization(organizationId: string) {
    try {
        // This helper will find specific OR global config
        const config = await getAssistAIConfig(organizationId);

        // If no config found for this org (and no global fallback), skip
        if (!config) return;

        // Sync last 20 conversations to keep it light
        const result = await AssistAIService.syncRecentConversations(config, organizationId, 20);

        if (result && result.syncedCount > 0) {
            console.log(`[Job] Synced ${result.syncedCount} conversations for Org ${organizationId}`);
        }
    } catch (error: any) {
        // Log basic error message, avoid spamming stack trace for network blips
        // console.error(`[Job] Failed to sync for Org ${organizationId}:`, error.message);
    }
}
