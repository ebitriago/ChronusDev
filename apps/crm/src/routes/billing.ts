
import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// GET /billing/subscription
router.get('/subscription', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: 'No organization context' });

        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            include: { members: true }
        });

        if (!org) return res.status(404).json({ error: 'Organization not found' });

        const seatCount = org.members.length;
        const planLimit = org.plan === 'FREE' ? 3 : org.plan === 'PRO' ? 10 : 999;

        // Mock next billing date
        const nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        nextBillingDate.setDate(1); // 1st of next month

        res.json({
            plan: org.plan,
            status: org.subscriptionStatus,
            seats: {
                total: seatCount,
                limit: planLimit,
                costPerSeat: org.plan === 'PRO' ? 15 : org.plan === 'ENTERPRISE' ? 29 : 0
            },
            billingEmail: org.billingEmail,
            nextBillingDate
        });

    } catch (error: any) {
        console.error('GET /billing/subscription error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /billing/invoices
router.get('/invoices', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;

        const invoices = await prisma.billingInvoice.findMany({
            where: { organizationId },
            orderBy: { invoiceDate: 'desc' }
        });

        res.json(invoices);
    } catch (error: any) {
        console.error('GET /billing/invoices error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /billing/upgrade (Mock)
router.post('/upgrade', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { plan } = req.body; // 'PRO', 'ENTERPRISE'

        if (!['PRO', 'ENTERPRISE', 'FREE'].includes(plan)) {
            return res.status(400).json({ error: 'Invalid plan' });
        }

        await prisma.organization.update({
            where: { id: organizationId },
            data: {
                plan,
                subscriptionStatus: 'ACTIVE'
            }
        });

        // Mock generating an invoice for the upgrade
        await prisma.billingInvoice.create({
            data: {
                amount: plan === 'PRO' ? 45.00 : 290.00,
                status: 'PAID',
                organizationId,
                pdfUrl: '#' // Mock link
            }
        });

        res.json({ success: true });

    } catch (error: any) {
        console.error('POST /billing/upgrade error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
