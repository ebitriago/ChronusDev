import { Router, Response } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// GET /search?q=query - Global search across projects and tasks
router.get('/', authMiddleware, async (req: any, res: Response) => {
    try {
        const organizationId = req.user?.organizationId;
        const query = (req.query.q as string || '').trim().toLowerCase();

        if (!query || query.length < 2) {
            return res.json({ results: [] });
        }

        // Search in parallel
        const [projects, tasks] = await Promise.all([
            // Search projects
            prisma.project.findMany({
                where: {
                    organizationId,
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { description: { contains: query, mode: 'insensitive' } }
                    ]
                },
                select: { id: true, name: true, status: true, client: { select: { name: true } } },
                take: 5
            }),

            // Search tasks
            prisma.task.findMany({
                where: {
                    project: { organizationId },
                    OR: [
                        { title: { contains: query, mode: 'insensitive' } },
                        { description: { contains: query, mode: 'insensitive' } }
                    ]
                },
                select: {
                    id: true,
                    title: true,
                    status: true,
                    priority: true,
                    project: { select: { name: true } }
                },
                take: 5
            })
        ]);

        // Format results
        const results = [
            ...projects.map(p => ({
                type: 'project' as const,
                id: p.id,
                title: p.name,
                subtitle: p.client?.name || p.status,
                status: p.status,
                icon: '📁'
            })),
            ...tasks.map(t => ({
                type: 'task' as const,
                id: t.id,
                title: t.title,
                subtitle: t.project?.name || t.priority,
                status: t.status,
                icon: '✅'
            }))
        ];

        res.json({ results });
    } catch (error: any) {
        console.error('GET /search error:', error);
        res.status(500).json({ error: 'Error en búsqueda' });
    }
});

export default router;
