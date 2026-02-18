import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// GET unread notifications
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const userId = req.user!.id;
        const notifications = await prisma.notification.findMany({
            where: {
                userId,
                read: false
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        const validNotifications = notifications.map((n: any) => ({
            ...n,
            link: n.data && n.data.ticketId ? `/tickets/${n.data.ticketId}` : undefined
        }));

        res.json(validNotifications);
    } catch (e) {
        res.status(500).json({ error: "Error fetching notifications" });
    }
});

// PUT mark as read
router.put('/:id/read', authMiddleware, async (req: any, res) => {
    try {
        const userId = req.user!.id;
        const notification = await prisma.notification.update({
            where: { id: req.params.id, userId } as any, // Ensure ownership
            data: { read: true }
        });
        res.json(notification);
    } catch (e) {
        res.status(500).json({ error: "Error updating notification" });
    }
});

// PUT mark ALL as read
router.put('/read-all', authMiddleware, async (req: any, res) => {
    try {
        const userId = req.user!.id;
        await prisma.notification.updateMany({
            where: { userId, read: false },
            data: { read: true }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Error updating notifications" });
    }
});

export const notificationsRouter = router;
