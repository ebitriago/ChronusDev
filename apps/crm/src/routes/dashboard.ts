
import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

router.get('/summary', authMiddleware, async (req: any, res) => {
    console.log('[Dashboard] GET /summary reached');
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: 'No organization context' });

        // Parallelize queries for performance
        const [
            usersCount,
            customersCount,
            leadsCount,
            openTicketsCount,
            pendingOrdersCount,
            lowStockProductsCount,
            recentActivity
        ] = await Promise.all([
            // Users
            prisma.organizationMember.count({ where: { organizationId } }),

            // Customers (Active)
            prisma.customer.count({ where: { organizationId, status: 'ACTIVE' } }),

            // Leads (from Lead model)
            prisma.lead.count({ where: { organizationId, status: { not: 'WON' } } }), // Count active leads

            // Open Tickets
            prisma.ticket.count({ where: { organizationId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),

            // Pending Orders (Mini ERP)
            prisma.assistantShoppingCart.count({ where: { organizationId, status: 'OPEN' } }),

            // Low Stock Products (< 10)
            prisma.globalProduct.count({ where: { organizationId, stock: { lt: 10 } } }),

            // Recent Activity (Combined)
            // This is a bit disjointed in Prisma without a unified Activity Log table, 
            // but we can fetch recent 5 from each and sort.
            // For now, let's just get recent tickets and orders.
            Promise.all([
                prisma.ticket.findMany({
                    where: { organizationId },
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                    include: { customer: { select: { name: true } } }
                }),
                prisma.assistantShoppingCart.findMany({
                    where: { organizationId },
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                    include: { customer: { select: { name: true } } }
                })
            ])
        ]);

        // Calculate Revenue (Basic: Sum of Paid Invoices or Completed Orders)
        // Let's use Transactions if available, or fallback to Invoices
        const revenueResult = await prisma.transaction.aggregate({
            where: { organizationId, type: 'INCOME' },
            _sum: { amount: true }
        });
        const totalRevenue = revenueResult._sum.amount || 0;

        // Process Recent Activity
        const tickets = recentActivity[0].map((t: any) => ({
            id: t.id,
            type: 'TICKET',
            description: `Ticket "${t.title}" created`,
            customer: t.customer?.name,
            date: t.createdAt,
            status: t.status
        }));

        const orders = recentActivity[1].map((o: any) => ({
            id: o.id,
            type: 'ORDER',
            description: `Order #${o.id.slice(-6)} created`,
            customer: o.customer?.name,
            date: o.createdAt,
            status: o.status,
            amount: o.total
        }));

        const combinedActivity = [...tickets, ...orders]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10);

        res.json({
            counts: {
                users: usersCount,
                customers: customersCount,
                leads: leadsCount,
                openTickets: openTicketsCount,
                pendingOrders: pendingOrdersCount,
                lowStockProducts: lowStockProductsCount
            },
            financials: {
                totalRevenue,
                currency: 'USD' // Default for now
            },
            recentActivity: combinedActivity
        });

    } catch (error: any) {
        console.error('GET /dashboard/summary error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
