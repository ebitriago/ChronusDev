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

router.post('/products', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { name, description, price, sku, stock, category, imageUrl } = req.body;

        const product = await prisma.globalProduct.create({
            data: {
                name, description, price: Number(price), sku, stock: Number(stock), category, imageUrl,
                organizationId
            }
        });
        res.json(product);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/products/:id', authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;
        const { name, description, price, sku, stock, category, imageUrl } = req.body;

        const product = await prisma.globalProduct.update({
            where: { id, organizationId },
            data: {
                name, description, price: Number(price), sku, stock: Number(stock), category, imageUrl
            }
        });
        res.json(product);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/products/:id', authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;
        await prisma.globalProduct.delete({ where: { id, organizationId } });
        res.json({ success: true });
    } catch (e: any) {
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

// Create Order (Manual)
router.post('/orders', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { customerId, items, status = 'OPEN' } = req.body;

        // items = [{ productId, quantity }]
        let total = 0;
        const orderItems = [];

        for (const item of items) {
            const product = await prisma.globalProduct.findUnique({ where: { id: item.productId } });
            if (product) {
                const itemTotal = product.price * item.quantity;
                total += itemTotal;
                orderItems.push({
                    productId: product.id,
                    quantity: item.quantity,
                    unitPrice: product.price,
                    total: itemTotal
                });
            }
        }

        const order = await prisma.assistantShoppingCart.create({
            data: {
                organizationId,
                customerId,
                status,
                total,
                items: {
                    create: orderItems
                }
            },
            include: { items: true, customer: true }
        });

        res.json(order);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Update Order Status
router.put('/orders/:id', authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;
        const { status } = req.body;

        const order = await prisma.assistantShoppingCart.update({
            where: { id, organizationId },
            data: { status }
        });
        res.json(order);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/orders/:id', authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;
        await prisma.assistantShoppingCart.delete({ where: { id, organizationId } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
