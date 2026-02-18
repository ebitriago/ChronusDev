
import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

router.get('/predictions', async (req, res) => {
    try {
        // Mock/Heuristic Data for Demo Purposes
        // specific real logic would require historical data analysis

        // MRR Calculation (heuristic)
        const customers = await prisma.customer.findMany({
            where: { status: 'ACTIVE' },
            select: { monthlyRevenue: true, name: true, id: true }
        });

        const currentMRR = customers.reduce((sum, c) => sum + (c.monthlyRevenue || 0), 0);

        // Simple 6-month lineal forecast (+5% growth)
        const forecast = [];
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
        let mrr = currentMRR || 1000; // start with 1000 if 0 for demo

        for (const m of months) {
            forecast.push({ month: m, mrr });
            mrr = mrr * 1.05;
        }

        // Churn Risk (heuristic: no interaction in last 30 days? - simplified for now)
        const riskyCustomers = customers.slice(0, 3).map(c => ({
            id: c.id,
            name: c.name,
            riskLevel: 'MEDIUM',
            reason: 'Baja interacción'
        }));

        res.json({
            mrr: {
                current: currentMRR,
                forecast,
                projectedAnnual: currentMRR * 12 * 1.1 // +10% 
            },
            churn: {
                atRiskCount: riskyCustomers.length,
                atRiskMRR: riskyCustomers.reduce((acc, c) => acc + (customers.find(cu => cu.id === c.id)?.monthlyRevenue || 0), 0),
                customers: riskyCustomers
            },
            pipeline: {
                totalValue: 50000,
                hotLeadsCount: 5,
                avgScore: 85
            }
        });

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
