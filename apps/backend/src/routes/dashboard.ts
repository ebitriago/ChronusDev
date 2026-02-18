import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';

const router = Router();

// GET /dashboard/summary
router.get('/summary', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(401).json({ error: 'No organization context' });
        }

        // 1. Financials: Total Revenue (Sum of PAID invoices)
        const paidInvoices = await prisma.invoice.aggregate({
            where: {
                organizationId,
                status: 'PAID'
            },
            _sum: {
                amount: true
            }
        });

        const totalRevenue = paidInvoices._sum.amount || 0;

        // 2. Counts
        // Open Tickets
        const openTickets = await prisma.ticket.count({
            where: {
                organizationId,
                status: { in: ['OPEN', 'IN_PROGRESS'] }
            }
        });

        // Leads (Clients with status 'LEAD')
        const leads = await prisma.client.count({
            where: {
                organizationId,
                status: 'LEAD'
            }
        });

        // Pending Orders
        const pendingOrders = await prisma.order.count({
            where: {
                organizationId,
                status: 'PENDING'
            }
        });

        // Recent Activity (Mocked for now or fetched from Activity model)
        const recentActivity = await prisma.activity.findMany({
            where: {
                organizationId
            },
            take: 5,
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                user: { select: { name: true } },
                client: { select: { name: true } }
            }
        });

        const formattedActivity = recentActivity.map(act => ({
            id: act.id,
            type: act.type,
            description: act.description,
            date: act.createdAt,
            user: act.user?.name || 'Sistema',
            customer: act.client?.name || 'Desconocido',
            customerId: act.clientId,
            metadata: act.metadata
        }));

        res.json({
            financials: {
                totalRevenue
            },
            counts: {
                openTickets,
                leads,
                pendingOrders
            },
            recentActivity: formattedActivity
        });

    } catch (error: any) {
        console.error('GET /dashboard/summary error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /dashboard/team-status - Estado del equipo en tiempo real
router.get('/team-status', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(401).json({ error: 'No organization context' });
        }

        const users = await prisma.user.findMany({
            where: {
                memberships: {
                    some: { organizationId }
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                avatar: true
            }
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const teamStatus = await Promise.all(users.map(async (user) => {
            // 1. Check if currently active (running timer)
            const activeLog = await prisma.timeLog.findFirst({
                where: {
                    userId: user.id,
                    project: { organizationId },
                    end: null
                },
                include: {
                    project: { select: { id: true, name: true } },
                    task: { select: { id: true, title: true } }
                }
            });

            // 2. Calculate hours worked today
            const todayLogs = await prisma.timeLog.findMany({
                where: {
                    userId: user.id,
                    project: { organizationId },
                    start: { gte: today }
                }
            });

            const msToday = todayLogs.reduce((acc, log) => {
                const end = log.end ? log.end.getTime() : Date.now();
                return acc + (end - log.start.getTime());
            }, 0);

            const hoursToday = Math.round(msToday / 3600000 * 100) / 100;

            // 3. Get last activity if not active
            let lastActive = null;
            if (!activeLog) {
                const lastLog = await prisma.timeLog.findFirst({
                    where: { userId: user.id, project: { organizationId } },
                    orderBy: { end: 'desc' }
                });
                lastActive = lastLog?.end || lastLog?.start || null;
            }

            return {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                status: activeLog ? 'ACTIVE' : 'OFFLINE',
                currentTask: activeLog ? {
                    title: activeLog.task?.title || 'Sin tarea',
                    project: activeLog.project.name,
                    startedAt: activeLog.start
                } : null,
                lastActive,
                hoursToday
            };
        }));

        // Sort: Active users first, then by hours worked
        teamStatus.sort((a, b) => {
            if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
            if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
            return b.hoursToday - a.hoursToday;
        });

        res.json(teamStatus);
    } catch (error: any) {
        console.error('GET /dashboard/team-status error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
