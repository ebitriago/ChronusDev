// Payouts routes
import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { logActivity } from '../activity.js';
import { createNotification } from '../notifications.js';
import { sendEmail, emailTemplates } from '../email.js';

const router = Router();

// GET /payouts - Listar pagos
router.get('/', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { userId, month } = req.query;

        let where: any = { organizationId };

        if (userId) {
            where.userId = userId;
        }

        if (month) {
            where.month = month;
        }

        const payouts = await prisma.payout.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, email: true } },
                createdBy: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(payouts);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /payouts - Crear pago
router.post('/', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { userId, amount, month, note, sendEmail: shouldSendEmail } = req.body;

        if (!userId || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ error: 'userId y amount (positivo) requeridos' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                memberships: {
                    where: { organizationId }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const payoutMonth = month || new Date().toISOString().slice(0, 7);

        const payout = await prisma.payout.create({
            data: {
                userId,
                organizationId,
                amount: Math.round(amount * 100) / 100,
                month: payoutMonth,
                note: note || undefined,
                createdById: req.user.id
            },
            include: {
                user: { select: { id: true, name: true, email: true } }
            }
        });

        await logActivity({
            type: 'PAYOUT_CREATED',
            description: `Pago de $${payout.amount} registrado para ${payout.user.name}`,
            organizationId,
            userId: payout.userId,
            metadata: { payoutId: payout.id, month: payoutMonth }
        });

        await createNotification({
            userId: payout.userId,
            organizationId,
            type: 'PAYOUT',
            title: 'Pago registrado',
            body: `Se ha registrado un pago de $${payout.amount} para ${payoutMonth}`,
            data: { payoutId: payout.id }
        });

        if (shouldSendEmail && user.email) {
            const emailResult = await sendEmail({
                to: user.email,
                subject: emailTemplates.payoutCreated(payout.amount, payoutMonth).subject,
                html: emailTemplates.payoutCreated(payout.amount, payoutMonth).html,
                organizationId
            });

            if (!emailResult.success) {
                console.warn('[Payout] Email send failed:', emailResult.error);
            }
        }

        res.status(201).json(payout);
    } catch (error: any) {
        console.error('POST /payouts error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /payouts/team-summary - Resumen de balances del equipo
router.get('/team-summary', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;

        const users = await prisma.user.findMany({
            where: {
                memberships: {
                    some: { organizationId }
                }
            },
            include: {
                timeLogs: {
                    where: {
                        project: { organizationId },
                        end: { not: null }
                    }
                },
                payouts: {
                    where: { organizationId }
                },
                memberships: {
                    where: { organizationId }
                }
            }
        });

        const summary = users.map((user: any) => {
            const totalDebt = user.timeLogs.reduce((acc: any, log: any) => {
                if (log.end) {
                    const hours = (log.end.getTime() - log.start.getTime()) / 3600000;
                    return acc + (hours * (log.payRate || 0));
                }
                return acc;
            }, 0);

            const totalHours = user.timeLogs.reduce((acc: any, log: any) => {
                if (log.end) {
                    return acc + ((log.end.getTime() - log.start.getTime()) / 3600000);
                }
                return acc;
            }, 0);

            const totalPaid = user.payouts.reduce((acc: any, p: any) => acc + p.amount, 0);

            return {
                userId: user.id,
                userName: user.name,
                defaultPayRate: user.memberships.find((m: any) => m.organizationId === organizationId)?.defaultPayRate || 0,
                totalHours: Math.round(totalHours * 100) / 100,
                totalDebt: Math.round(totalDebt * 100) / 100,
                totalPaid: Math.round(totalPaid * 100) / 100,
                balance: Math.round((totalDebt - totalPaid) * 100) / 100,
                totalBill: Math.round(user.timeLogs.reduce((acc: any, log: any) => {
                    if (log.end) {
                        const hours = (log.end.getTime() - log.start.getTime()) / 3600000;
                        return acc + (hours * (log.billRate || 0));
                    }
                    return acc;
                }, 0) * 100) / 100,
                projectCount: new Set(user.timeLogs.map((l: any) => l.projectId)).size // useful for frontend
            };
        });

        res.json(summary);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /payouts/team-summary/:userId/details - Detalle diario de ganancias
router.get('/team-summary/:userId/details', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { userId } = req.params;
        const { month } = req.query;

        const dateFilter: any = {
            project: { organizationId },
            end: { not: null },
            userId
        };

        if (month) {
            const startDate = new Date(`${month}-01`);
            const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);
            dateFilter.start = {
                gte: startDate,
                lte: endDate
            };
        }

        const logs = await prisma.timeLog.findMany({
            where: dateFilter,
            include: {
                project: { select: { name: true } },
                task: { select: { title: true } }
            },
            orderBy: { start: 'desc' }
        });

        // Group by Date and specific Rate/Project
        const dailyMap = new Map();

        for (const log of logs) {
            const date = log.start.toISOString().split('T')[0];
            const rate = log.payRate || 0;
            const project = log.project.name;
            const key = `${date}-${project}-${rate}`;

            if (!dailyMap.has(key)) {
                dailyMap.set(key, {
                    id: key,
                    date,
                    project,
                    rate,
                    hours: 0,
                    amount: 0,
                    tasks: new Set()
                });
            }

            const entry = dailyMap.get(key);
            if (!log.end) continue;
            const hours = (log.end.getTime() - log.start.getTime()) / 3600000;

            entry.hours += hours;
            entry.amount += hours * rate;
            if (log.task?.title) {
                entry.tasks.add(log.task.title);
            }
        }

        const details = Array.from(dailyMap.values()).map(entry => ({
            ...entry,
            hours: Math.round(entry.hours * 100) / 100,
            amount: Math.round(entry.amount * 100) / 100,
            taskCount: entry.tasks.size, // Count unique tasks
            taskSummary: Array.from(entry.tasks).slice(0, 3).join(', ') + (entry.tasks.size > 3 ? '...' : '')
        })).sort((a, b) => b.date.localeCompare(a.date));

        res.json(details);

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /payouts/user/:userId/balance - Balance de un usuario
router.get('/user/:userId/balance', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const user = await prisma.user.findUnique({
            where: { id: req.params.userId },
            include: {
                timeLogs: {
                    where: {
                        project: { organizationId },
                        end: { not: null }
                    }
                },
                payouts: {
                    where: { organizationId }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const totalDebt = user.timeLogs.reduce((acc: any, log: any) => {
            if (log.end) {
                const hours = (log.end.getTime() - log.start.getTime()) / 3600000;
                return acc + (hours * (log.payRate || 0));
            }
            return acc;
        }, 0);

        const totalHours = user.timeLogs.reduce((acc: any, log: any) => {
            if (log.end) {
                return acc + ((log.end.getTime() - log.start.getTime()) / 3600000);
            }
            return acc;
        }, 0);

        const totalPaid = user.payouts.reduce((acc: any, p: any) => acc + p.amount, 0);

        res.json({
            userId: user.id,
            userName: user.name,
            totalHours: Math.round(totalHours * 100) / 100,
            totalDebt: Math.round(totalDebt * 100) / 100,
            totalPaid: Math.round(totalPaid * 100) / 100,
            balance: Math.round((totalDebt - totalPaid) * 100) / 100,
            payouts: user.payouts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /payouts/:id - Eliminar pago
router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const payout = await prisma.payout.findFirst({
            where: {
                id: req.params.id,
                organizationId
            }
        });

        if (!payout) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }

        await prisma.payout.delete({
            where: { id: req.params.id }
        });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
