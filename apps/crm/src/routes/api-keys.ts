import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';
import crypto from 'crypto';

const router = Router();

// Helper to hash key
function hashKey(key: string) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * @openapi
 * /api-keys:
 *   post:
 *     tags: [Developer Tools]
 *     summary: Generate a new API Key
 *     description: Creates a new API Key for the authenticated organization. The raw key is returned ONLY ONCE.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Zapier Integration"
 *     responses:
 *       200:
 *         description: API Key created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 name: { type: string }
 *                 key: { type: string, description: "Raw key (sk_live_...)" }
 *                 keyPrefix: { type: string }
 *                 createdAt: { type: string, format: date-time }
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id; // authMiddleware ensures this
        const { name } = req.body;

        // Ensure user has an active organization in context
        // In real app, we might want to check permissions (e.g. only ADMIN)
        const organizationId = req.user!.organizationId;

        if (!organizationId) {
            return res.status(400).json({ error: 'No active organization context' });
        }

        const rawKey = 'sk_live_' + crypto.randomBytes(24).toString('hex');
        const keyHash = hashKey(rawKey);
        const keyPrefix = rawKey.substring(0, 10); // "sk_live_..."

        const apiKey = await prisma.apiKey.create({
            data: {
                organizationId,
                name: name || 'API Key',
                keyHash,
                keyPrefix
            }
        });

        // Return rawKey ONLY ONCE
        return res.json({
            id: apiKey.id,
            name: apiKey.name,
            key: rawKey, // This is the only time user sees it
            keyPrefix: keyPrefix,
            createdAt: apiKey.createdAt
        });

    } catch (e) {
        console.error("Error creating API Key", e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * @openapi
 * /api-keys:
 *   get:
 *     tags: [Developer Tools]
 *     summary: List API Keys
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active API Keys
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   name: { type: string }
 *                   keyPrefix: { type: string }
 *                   lastUsedAt: { type: string, format: date-time }
 *                   createdAt: { type: string, format: date-time }
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const organizationId = req.user!.organizationId;
        if (!organizationId) return res.json([]);

        const keys = await prisma.apiKey.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                keyPrefix: true,
                lastUsedAt: true,
                createdAt: true
            }
        });

        return res.json(keys);
    } catch (e) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * @openapi
 * /api-keys/{id}:
 *   delete:
 *     tags: [Developer Tools]
 *     summary: Revoke an API Key
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Key revoked successfully
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const organizationId = req.user!.organizationId;
        const { id } = req.params;

        await prisma.apiKey.deleteMany({
            where: {
                id,
                organizationId // Ensure ownership
            }
        });

        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: 'Error revoking key' });
    }
});

export default router;
