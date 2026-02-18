import { Router, Response } from 'express';
import { prisma } from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import PDFDocument from 'pdfkit';
import { ReportGenerator } from '../services/report-generator.js';
import { endOfMonth, startOfMonth, parseISO } from 'date-fns';

const router = Router();

// GET /reports/export - Reporte avanzado con filtros (PDF/CSV)
router.get('/export', authMiddleware, async (req: any, res: Response) => {
    try {
        const organizationId = req.user?.organizationId;
        const { startDate, endDate, userId, projectId, clientId, format = 'pdf' } = req.query;

        // 1. Build Where Clause
        const where: any = {
            project: { organizationId },
            end: { not: null }
        };

        if (startDate || endDate) {
            where.start = {};
            if (startDate) where.start.gte = new Date(startDate as string);
            if (endDate) where.start.lte = new Date(endDate as string);
        }

        // Restrict DEVs to only see their own reports
        let targetUserId = userId;
        if (req.user.role === 'DEV') {
            targetUserId = req.user.id;
        }

        if (targetUserId) where.userId = targetUserId;
        if (projectId) where.projectId = projectId;
        if (clientId) where.project.clientId = clientId;

        // 2. Fetch Data
        const timeLogs = await prisma.timeLog.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, email: true } },
                project: { select: { id: true, name: true, client: true } },
                task: { select: { id: true, title: true } }
            },
            orderBy: { start: 'asc' }
        });

        const org = await prisma.organization.findUnique({ where: { id: organizationId } });

        // 3. Resolve Reference Names (for display in PDF/Filtros)
        let userName = '';
        if (userId) {
            const user = await prisma.user.findUnique({ where: { id: userId as string }, select: { name: true } });
            userName = user?.name || '';
        }

        let projectName = '';
        if (projectId) {
            const project = await prisma.project.findUnique({ where: { id: projectId as string }, select: { name: true } });
            projectName = project?.name || '';
        }

        let clientName = '';
        if (clientId) {
            const client = await prisma.client.findUnique({ where: { id: clientId as string }, select: { name: true } });
            clientName = client?.name || '';
        }

        // 4. Calculate Summary Metrics
        const totalHours = timeLogs.reduce((acc: number, log: any) => {
            return acc + (new Date(log.end!).getTime() - new Date(log.start).getTime()) / 3600000;
        }, 0);

        const totalPay = timeLogs.reduce((acc: number, log: any) => {
            return acc + ((new Date(log.end!).getTime() - new Date(log.start).getTime()) / 3600000) * (log.payRate || 0);
        }, 0);

        const totalBill = timeLogs.reduce((acc: number, log: any) => {
            return acc + ((new Date(log.end!).getTime() - new Date(log.start).getTime()) / 3600000) * (log.billRate || 0);
        }, 0);

        const reportData = {
            title: 'Reporte de Actividades y Gastos',
            organizationName: org?.name || 'ChronusDev',
            filters: {
                startDate: startDate as string,
                endDate: endDate as string,
                userName,
                projectName,
                clientName
            },
            timeLogs: req.user.role === 'DEV'
                ? timeLogs.map((log: any) => ({
                    ...log,
                    billRate: 0, // Redact Bill Rate
                    // Keep PayRate as they can see their earnings
                }))
                : timeLogs,
            summary: {
                totalHours,
                totalPay, // Earnings for user, Pay Cost for admin
                totalBill: req.user.role === 'DEV' ? 0 : totalBill, // Redact Total Bill for DEV
                currency: 'USD'
            }
        };

        // 5. Generate and Send
        if (format === 'json') {
            return res.json(reportData);
        } else if (format === 'csv') {
            const csv = ReportGenerator.generateCSV(reportData);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=reporte-${Date.now()}.csv`);
            return res.send(csv);
        } else {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=reporte-${Date.now()}.pdf`);
            return ReportGenerator.generatePDF(reportData, res);
        }

    } catch (e: any) {
        console.error('GET /reports/export error:', e);
        res.status(500).json({ error: 'Error generando el reporte. Por favor intente nuevamente.' });
    }
});

// GET /reports/project/:id/pdf - Reporte de proyecto en PDF
router.get('/project/:id/pdf', authMiddleware, async (req: any, res: Response) => {
    try {
        const organizationId = req.user?.organizationId;
        const project = await prisma.project.findFirst({
            where: {
                id: req.params.id,
                organizationId
            },
            include: {
                client: true,
                tasks: {
                    include: {
                        assignedTo: { select: { id: true, name: true } },
                        _count: { select: { timeLogs: true, comments: true } }
                    }
                },
                timeLogs: {
                    where: { end: { not: null } },
                    include: {
                        user: { select: { id: true, name: true } },
                        task: { select: { id: true, title: true } }
                    }
                },
                members: {
                    include: {
                        user: { select: { id: true, name: true, email: true } }
                    }
                }
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=proyecto-${project.name}-${Date.now()}.pdf`);
        doc.pipe(res);

        doc
            .fontSize(20)
            .text(`Reporte de Proyecto: ${project.name}`, 50, 50)
            .fontSize(10)
            .text('ChronusDev', { align: 'right' })
            .text(`Generado: ${new Date().toLocaleDateString()}`, { align: 'right' })
            .moveDown(2);

        doc
            .fontSize(14)
            .text('Información del Proyecto', 50, 150)
            .fontSize(10)
            .text(`Cliente: ${project.client?.name || 'N/A'}`, 50, 175)
            .text(`Presupuesto: ${project.budget} ${project.currency}`, 50, 190)
            .text(`Estado: ${project.status}`, 50, 205)
            .moveDown();

        const totalHours = project.timeLogs.reduce((acc: any, log: any) => {
            if (log.end) {
                const hours = (log.end.getTime() - log.start.getTime()) / 3600000;
                return acc + hours;
            }
            return acc;
        }, 0);

        const totalBillCost = project.timeLogs.reduce((acc: any, log: any) => {
            if (log.end) {
                const hours = (log.end.getTime() - log.start.getTime()) / 3600000;
                return acc + (hours * (log.billRate || 0));
            }
            return acc;
        }, 0);

        const totalPayCost = project.timeLogs.reduce((acc: any, log: any) => {
            if (log.end) {
                const hours = (log.end.getTime() - log.start.getTime()) / 3600000;
                return acc + (hours * (log.payRate || 0));
            }
            return acc;
        }, 0);

        let yPos = 250;
        doc
            .fontSize(14)
            .text('Resumen Financiero', 50, yPos)
            .fontSize(10)
            .text(`Total Horas: ${Math.round(totalHours * 100) / 100}h`, 50, yPos + 25)
            .text(`Costo Total (Cliente): ${project.currency} ${Math.round(totalBillCost * 100) / 100}`, 50, yPos + 40)
            .text(`Costo Total (Interno): ${project.currency} ${Math.round(totalPayCost * 100) / 100}`, 50, yPos + 55)
            .text(`Presupuesto Restante: ${project.currency} ${Math.round((project.budget - totalBillCost) * 100) / 100}`, 50, yPos + 70);

        yPos = yPos + 120;
        doc
            .fontSize(14)
            .text('Tareas', 50, yPos)
            .fontSize(10);

        project.tasks.forEach((task: any, index: any) => {
            const taskY = yPos + 25 + (index * 15);
            if (taskY > 750) {
                doc.addPage();
                yPos = 50;
            }
            doc.text(`${task.title} - ${task.status}`, 50, taskY);
        });

        doc.end();
    } catch (error: any) {
        console.error('GET /reports/project/:id/pdf error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /reports/payroll.csv - Reporte de nómina en CSV
router.get('/payroll.csv', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res: Response) => {
    try {
        const organizationId = req.user?.organizationId;
        const month = req.query.month as string || new Date().toISOString().slice(0, 7);
        const monthDate = parseISO(`${month}-01`);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        const timeLogs = await prisma.timeLog.findMany({
            where: {
                project: { organizationId },
                end: { not: null },
                start: {
                    gte: monthStart,
                    lte: monthEnd
                }
            },
            include: {
                user: { select: { id: true, name: true } },
                task: { select: { id: true, title: true } },
                project: { select: { id: true, name: true } }
            }
        });

        const header = 'fecha,usuario,proyecto,tarea,horas,pay_rate,pay_cost';
        const rows = timeLogs.map((log: any) => {
            const hours = log.end ? (log.end.getTime() - log.start.getTime()) / 3600000 : 0;
            const payCost = hours * (log.payRate || 0);
            return [
                log.start.toISOString().split('T')[0],
                log.user.name,
                log.project.name,
                log.task?.title || '',
                hours.toFixed(2),
                (log.payRate || 0).toFixed(2),
                payCost.toFixed(2)
            ].join(',');
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=payroll-${month}.csv`);
        res.send([header, ...rows].join('\n'));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /reports/team-earnings - Reporte de ganancias del equipo
router.get('/team-earnings', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const month = req.query.month as string || new Date().toISOString().slice(0, 7);
        const monthDate = parseISO(`${month}-01`);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        // 1. Fetch all organization members first
        const members = await prisma.organizationMember.findMany({
            where: { organizationId },
            include: { user: { select: { id: true, name: true } } }
        });

        const userEarnings: Record<string, {
            userId: string;
            userName: string;
            totalHours: number;
            totalPay: number;
            totalBill: number;
            projects: { projectId: string; projectName: string; hours: number; pay: number }[]
        }> = {};

        // Initialize with all members
        for (const member of members) {
            userEarnings[member.user.id] = {
                userId: member.user.id,
                userName: member.user.name,
                totalHours: 0,
                totalPay: 0,
                totalBill: 0,
                projects: []
            };
        }

        const timeLogs = await prisma.timeLog.findMany({
            where: {
                project: { organizationId },
                end: { not: null },
                start: {
                    gte: monthStart,
                    lte: monthEnd
                }
            },
            include: {
                user: { select: { id: true, name: true } },
                project: { select: { id: true, name: true } }
            }
        });

        for (const log of timeLogs) {
            const hours = log.end ? (log.end.getTime() - log.start.getTime()) / 3600000 : 0;
            const pay = hours * (log.payRate || 0);
            const bill = hours * (log.billRate || 0);

            // Ensure user exists in map (should be there from members list, but safety check)
            if (!userEarnings[log.userId]) {
                userEarnings[log.userId] = {
                    userId: log.user.id,
                    userName: log.user.name,
                    totalHours: 0,
                    totalPay: 0,
                    totalBill: 0,
                    projects: []
                };
            }

            const entry = userEarnings[log.userId];
            entry.totalHours += hours;
            entry.totalPay += pay;
            entry.totalBill += bill;

            let projEntry = entry.projects.find(p => p.projectId === log.projectId);
            if (!projEntry) {
                projEntry = { projectId: log.projectId, projectName: log.project.name, hours: 0, pay: 0 };
                entry.projects.push(projEntry);
            }
            projEntry.hours += hours;
            projEntry.pay += pay;
        }

        const result = Object.values(userEarnings).map((u: any) => ({
            ...u,
            totalHours: Math.round(u.totalHours * 100) / 100,
            totalPay: Math.round(u.totalPay * 100) / 100,
            totalBill: Math.round(u.totalBill * 100) / 100,
        }));

        res.json({ month, earnings: result });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
