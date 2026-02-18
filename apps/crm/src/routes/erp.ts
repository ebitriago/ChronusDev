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

        // Build update data dynamically to support partial updates
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (price !== undefined) updateData.price = Number(price);
        if (sku !== undefined) updateData.sku = sku;
        if (stock !== undefined) updateData.stock = Number(stock);
        if (category !== undefined) updateData.category = category;
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

        const product = await prisma.globalProduct.update({
            where: { id, organizationId },
            data: updateData
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

// Convert Order to Invoice
router.post('/orders/:id/convert', authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;

        // 1. Fetch Order
        const order = await prisma.assistantShoppingCart.findUnique({
            where: { id, organizationId },
            include: { items: { include: { product: true } }, customer: true }
        });

        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (!order.customerId) return res.status(400).json({ error: 'Order has no customer attached' });

        // 2. Create Invoice
        // Generate a simple unique number for now (can be improved)
        const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

        const invoice = await prisma.invoice.create({
            data: {
                organizationId,
                customerId: order.customerId,
                number: invoiceNumber,
                status: 'DRAFT',
                issueDate: new Date(),
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Net 30
                amount: order.total,
                subtotal: order.total,
                balance: order.total,
                items: {
                    create: order.items.map(item => ({
                        description: item.product.name,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        total: item.total
                    }))
                }
            },
            include: { items: true }
        });

        // 3. Mark order as COMPLETED (optional, but good workflow)
        await prisma.assistantShoppingCart.update({
            where: { id },
            data: { status: 'COMPLETED' }
        });

        res.json({ success: true, invoiceId: invoice.id, invoice });
    } catch (e: any) {
        console.error('Convert Error:', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
