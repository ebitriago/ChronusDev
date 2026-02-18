import { Router, Response } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// GET /search?q=query - Global search across customers, leads, tickets
router.get('/', authMiddleware, async (req: any, res: Response) => {
    try {
        const organizationId = req.user?.organizationId;
        const query = (req.query.q as string || '').trim().toLowerCase();

        if (!query || query.length < 2) {
            return res.json({ results: [] });
        }

        // Search in parallel
        const [customers, leads, tickets] = await Promise.all([
            // Search customers
            prisma.customer.findMany({
                where: {
                    organizationId,
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { email: { contains: query, mode: 'insensitive' } },
                        { company: { contains: query, mode: 'insensitive' } },
                        { phone: { contains: query, mode: 'insensitive' } }
                    ]
                },
                select: { id: true, name: true, email: true, company: true, status: true },
                take: 5
            }),

            // Search leads
            prisma.lead.findMany({
                where: {
                    organizationId,
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { email: { contains: query, mode: 'insensitive' } },
                        { company: { contains: query, mode: 'insensitive' } },
                        { phone: { contains: query, mode: 'insensitive' } }
                    ]
                },
                select: { id: true, name: true, email: true, company: true, status: true },
                take: 5
            }),

            // Search tickets
            prisma.ticket.findMany({
                where: {
                    organizationId,
                    OR: [
                        { title: { contains: query, mode: 'insensitive' } },
                        { id: { contains: query, mode: 'insensitive' } }
                    ]
                },
                select: { id: true, title: true, status: true, priority: true },
                take: 5
            })
        ]);

        // Format results
        const results = [
            ...customers.map(c => ({
                type: 'customer' as const,
                id: c.id,
                title: c.name,
                subtitle: c.company || c.email || '',
                status: c.status,
                icon: '👤'
            })),
            ...leads.map(l => ({
                type: 'lead' as const,
                id: l.id,
                title: l.name,
                subtitle: l.company || l.email || '',
                status: l.status,
                icon: '💼'
            })),
            ...tickets.map(t => ({
                type: 'ticket' as const,
                id: t.id,
                title: t.title,
                subtitle: `#${t.id.slice(-6)} · ${t.priority}`,
                status: t.status,
                icon: '🎫'
            }))
        ];

        res.json({ results });
    } catch (error: any) {
        console.error('GET /search error:', error);
        res.status(500).json({ error: 'Error en búsqueda' });
    }
});

export default router;
