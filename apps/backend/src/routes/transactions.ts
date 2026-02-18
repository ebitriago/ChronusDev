import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// GET /transactions
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { startDate, endDate, type, category, limit } = req.query;

        const where: any = { organizationId };

        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        if (type && type !== 'ALL') {
            where.type = type;
        }

        if (category && category !== 'ALL') {
            where.category = category;
        }

        const transactions = await prisma.transaction.findMany({
            where,
            orderBy: { date: 'desc' },
            take: limit ? parseInt(limit) : undefined,
            include: {
                client: {
                    select: { id: true, name: true }
                }
            }
        });

        res.json(transactions);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /transactions
router.post('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { amount, type, category, description, date, customerId, reference, metadata } = req.body;

        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID missing' });
        }

        if (!amount || !type || !category || !description) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        console.log('Creating transaction:', { amount, type, category, customerId });

        const transaction = await prisma.transaction.create({
            data: {
                organizationId,
                amount: parseFloat(amount),
                type,
                category,
                description,
                date: date ? new Date(date) : new Date(),
                customerId: (customerId && customerId.trim() !== '') ? customerId : null,
                reference,
                metadata: metadata || {}
            }
        });

        res.status(201).json(transaction);
    } catch (error: any) {
        console.error('Error creating transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /transactions/categories
router.get('/categories', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const type = req.query.type as string; // Optional filter by type

        const where: any = { organizationId };
        if (type) where.type = type;

        const categories = await prisma.transaction.groupBy({
            by: ['category'],
            where,
            _count: {
                category: true
            },
            orderBy: {
                category: 'asc'
            }
        });

        res.json(categories.map(c => c.category));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
