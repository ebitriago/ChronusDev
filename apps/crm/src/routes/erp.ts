import express from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = express.Router();

/**
 * @openapi
 * /erp/products:
 *   get:
 *     tags: [ERP]
 *     summary: List global products
 */
router.get('/products', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: 'No organization context' });

        const products = await prisma.globalProduct.findMany({
            where: { organizationId },
            orderBy: { name: 'asc' }
        });

        res.json(products);
    } catch (e: any) {
        console.error('GET /erp/products error:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * @openapi
 * /erp/orders:
 *   get:
 *     tags: [ERP]
 *     summary: List orders (shopping carts)
 */
router.get('/orders', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: 'No organization context' });

        const { status, customerId } = req.query;
        const where: any = { organizationId };

        if (status) where.status = status;
        if (customerId) where.customerId = customerId;

        const orders = await prisma.assistantShoppingCart.findMany({
            where,
            include: {
                customer: { select: { name: true, email: true } },
                items: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(orders);
    } catch (e: any) {
        console.error('GET /erp/orders error:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * @openapi
 * /erp/orders/:id:
 *   get:
 *     tags: [ERP]
 *     summary: Get order details
 */
router.get('/orders/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: 'No organization context' });

        const { id } = req.params;

        const order = await prisma.assistantShoppingCart.findFirst({
            where: { id, organizationId },
            include: {
                customer: true,
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        if (!order) return res.status(404).json({ error: 'Order not found' });

        res.json(order);
    } catch (e: any) {
        console.error('GET /erp/orders/:id error:', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
