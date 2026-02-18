
import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { getRecentActivities, ActivityFilters } from '../activity.js';
import { ActivityType } from '@prisma/client';

const router = Router();

// GET /activities?limit=20&projectId=xxx&taskId=xxx&type=COMMENT
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(403).json({ error: 'Organization context required' });
        }

        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

        const filters: ActivityFilters = {};
        if (req.query.projectId) filters.projectId = req.query.projectId as string;
        if (req.query.taskId) filters.taskId = req.query.taskId as string;
        if (req.query.type && Object.values(ActivityType).includes(req.query.type as ActivityType)) {
            filters.type = req.query.type as ActivityType;
        }

        const activities = await getRecentActivities(organizationId, limit, filters);
        res.json(activities);
    } catch (error: any) {
        console.error('GET /activities error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
