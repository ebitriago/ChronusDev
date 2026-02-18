// Notifications routes
import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { getUserNotifications, markAsRead, markAllAsRead } from '../notifications.js';

const router = Router();

// GET /notifications - Obtener notificaciones del usuario
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(401).json({ error: 'No organization context' });
        }

        const notifications = await getUserNotifications(req.user.id, organizationId);
        res.json(notifications);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /notifications/:id/read - Marcar como leída
router.patch('/:id/read', authMiddleware, async (req: any, res) => {
    try {
        await markAsRead(req.params.id, req.user.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /notifications/read-all - Marcar todas como leídas
router.patch('/read-all', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(401).json({ error: 'No organization context' });
        }

        await markAllAsRead(req.user.id, organizationId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
