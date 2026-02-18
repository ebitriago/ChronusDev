
import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';
import { logActivity } from '../activity.js';

const router = Router();

// GET /standups - Get recent standups (for dashboard or team view)
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { date } = req.query; // Optional filter by date

        let where: any = { organizationId };

        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            where.createdAt = {
                gte: startOfDay,
                lte: endOfDay
            };
        }

        const standups = await prisma.standup.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, avatar: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.json(standups);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /standups - Create a standup
router.post('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { yesterday, today, blockers } = req.body;

        if (!yesterday || !today) {
            return res.status(400).json({ error: 'Yesterday and Today fields are required' });
        }

        // Check if already submitted today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const existing = await prisma.standup.findFirst({
            where: {
                userId: req.user.id,
                organizationId,
                createdAt: { gte: startOfDay }
            }
        });

        if (existing) {
            // Update existing? Or block? Let's allow update or return existing
            // For now, let's update it
            const updated = await prisma.standup.update({
                where: { id: existing.id },
                data: { yesterday, today, blockers }
            });
            return res.json(updated);
        }

        const standup = await prisma.standup.create({
            data: {
                userId: req.user.id,
                organizationId,
                yesterday,
                today,
                blockers
            }
        });

        await logActivity({
            type: 'STANDUP',
            description: `${req.user.name} posted a daily standup`,
            organizationId,
            userId: req.user.id,
            metadata: { standupId: standup.id }
        });

        res.json(standup);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
