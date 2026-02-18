import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';
import crypto from 'crypto';

const router = Router();

/**
 * @openapi
 * /webhooks:
 *   get:
 *     tags: [Developer Tools]
 *     summary: List Registered Webhooks
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active webhooks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   url: { type: string }
 *                   description: { type: string }
 *                   events: { type: array, items: { type: string } }
 *                   isActive: { type: boolean }
 *                   secret: { type: string }
 *                   createdAt: { type: string, format: date-time }
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const organizationId = req.user!.organizationId;
        if (!organizationId) return res.json([]);

        const webhooks = await prisma.webhookEndpoint.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' }
        });
        return res.json(webhooks);
    } catch (e) {
        return res.status(500).json({ error: 'Internal Error' });
    }
});

/**
 * @openapi
 * /webhooks:
 *   post:
 *     tags: [Developer Tools]
 *     summary: Register a new Webhook
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url]
 *             properties:
 *               url: { type: string, format: uri }
 *               description: { type: string }
 *               events: { type: array, items: { type: string }, example: ["*"] }
 *     responses:
 *       200:
 *         description: Webhook registered
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const organizationId = req.user!.organizationId;
        const { url, description, events } = req.body;

        if (!organizationId) return res.status(400).json({ error: 'No org context' });
        if (!url) return res.status(400).json({ error: 'URL required' });

        const secret = 'whsec_' + crypto.randomBytes(24).toString('hex');

        const webhook = await prisma.webhookEndpoint.create({
            data: {
                organizationId,
                url,
                description,
                events: events || ['*'],
                secret
            }
        });

        return res.json(webhook);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Error creating webhook' });
    }
});

/**
 * @openapi
 * /webhooks/{id}:
 *   delete:
 *     tags: [Developer Tools]
 *     summary: Delete a Webhook
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Webhook deleted
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const organizationId = req.user!.organizationId;
        const { id } = req.params;

        await prisma.webhookEndpoint.deleteMany({
            where: { id, organizationId }
        });

        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: 'Error deleting webhook' });
    }
});

/**
 * @openapi
 * /webhooks/{id}/test:
 *   post:
 *     tags: [Developer Tools]
 *     summary: Trigger a Test Event
 *     description: Sends a dummy payload to the configured webhook URL to verify connectivity and signature verification.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Test event sent successfully
 */
router.post('/:id/test', authMiddleware, async (req: Request, res: Response) => {
    try {
        const organizationId = req.user!.organizationId;
        const { id } = req.params;

        const webhook = await prisma.webhookEndpoint.findFirst({
            where: { id, organizationId }
        });

        if (!webhook) return res.status(404).json({ error: 'Webhook not found' });

        // Simulate Payload
        const payload = {
            id: 'evt_' + Date.now(),
            type: 'test.event',
            created: new Date().toISOString(),
            data: {
                message: 'This is a test event from ChronusCRM Developer Portal',
                user: req.user!.name
            }
        };

        const payloadString = JSON.stringify(payload);

        // Calculate Signature
        const signature = crypto
            .createHmac('sha256', webhook.secret)
            .update(payloadString)
            .digest('hex');

        // Send Request
        // In production, we'd use a queue (Bull/Redis). Here we just fetch.
        console.log(`[Webhook] Sending test to ${webhook.url}`);

        fetch(webhook.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Chronus-Signature': signature,
                'X-Chronus-Event': 'test.event'
            },
            body: payloadString
        })
            .then(async (r) => {
                console.log(`[Webhook] Response: ${r.status}`);
                // We don't wait for this to finish to respond to UI, 
                // but for "Test" button usually user wants to see result.
                // Let's await it slightly.
            })
            .catch(err => console.error(`[Webhook] Failed:`, err));

        return res.json({ success: true, message: 'Test event sent', payload });

    } catch (e) {
        return res.status(500).json({ error: 'Error sending test' });
    }
});


// Helper to hash key
function hashKey(key: string) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * @openapi
 * /webhooks/incoming/leads:
 *   post:
 *     tags: [Developer Tools]
 *     summary: Create Lead via Webhook
 *     security:
 *       - apiKey: []
 *     description: Create a lead using an API Key (in Authorization header as 'Bearer sk_live_...'). Compatible with Zapier, Typeform, etc.
 */
router.post('/incoming/leads', async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }

        const rawKey = authHeader.split(' ')[1];
        if (!rawKey.startsWith('sk_live_')) {
            return res.status(401).json({ error: 'Invalid API Key format' });
        }

        // Validate Key
        const keyHash = hashKey(rawKey);
        const apiKey = await prisma.apiKey.findFirst({
            where: { keyHash },
            include: { organization: true }
        });

        if (!apiKey) {
            return res.status(401).json({ error: 'Invalid API Key' });
        }

        // Update Usage
        await prisma.apiKey.update({
            where: { id: apiKey.id },
            data: { lastUsedAt: new Date() }
        });

        // Create Lead
        const { name, email, company, notes, source } = req.body;

        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        const lead = await prisma.lead.create({
            data: {
                name,
                email,
                company,
                notes: (notes || '') + ` [Source: ${source || 'External'} - Key: ${apiKey.name}]`,
                source: 'WEBHOOK',
                status: 'Nuevo',
                organizationId: apiKey.organizationId
            }
        });

        // Emit socket event
        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(`org_${apiKey.organizationId}`).emit('lead.created', { lead });
        }

        console.log(`[Webhook] Lead created via API Key "${apiKey.name}" for Org ${apiKey.organizationId}`);

        return res.json({ success: true, id: lead.id, message: 'Lead created successfully' });

    } catch (e: any) {
        console.error('Webhook Lead Error:', e);
        return res.status(500).json({ error: 'Internal Error' });
    }
});

export default router;
