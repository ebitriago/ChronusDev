import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

/**
 * POST /chat/send
 * Sends a message from the authenticated user to the CRM support inbox.
 */
router.post('/send', authMiddleware, async (req: any, res) => {
    try {
        const { content } = req.body;
        const userId = req.user.id;
        const userName = req.user.name;
        // Default to internal ID
        let organizationId = req.user.organizationId;

        if (!content) {
            return res.status(400).json({ error: 'Content required' });
        }

        // Fetch Organization to check for CRM Link
        // This handles the case where ChronusDev Org ID != CRM Org ID
        if (organizationId) {
            // Check if organization exists in DB (JIT users might have phantom ID)
            const org = await prisma.organization.findUnique({
                where: { id: organizationId },
                select: { crmOrganizationId: true }
            });

            // If linked, USE THE LINKED ID
            if (org && org.crmOrganizationId) {
                console.log(`[Chat] Using Linked CRM Org ID: ${org.crmOrganizationId} (instead of ${organizationId})`);
                organizationId = org.crmOrganizationId;
            }
        }

        // Configuration for CRM connection
        const crmApiUrl = process.env.CRM_API_URL ||
            (process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : 'https://chronuscrm.assistai.work');
        const syncKey = process.env.CRM_SYNC_KEY || 'dev-sync-key';

        // Forward to CRM Webhook
        const response = await fetch(`${crmApiUrl}/webhooks/chronusdev/chat-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Key': syncKey,
                'x-sync-key': syncKey // Some middleware checks lowercase
            },
            body: JSON.stringify({
                userId,
                userName,
                organizationId, // Now correctly linked
                content
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('[Chat] Failed to send to CRM:', response.status, errText);
            return res.status(response.status).json({ error: 'Failed to send message to support' });
        }

        const data = await response.json();
        res.json(data);

    } catch (error: any) {
        console.error('[Chat] Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
