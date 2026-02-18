// Calendar routes
import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';
import { getGoogleAuthUrl, handleGoogleCallback, createEvent, listEvents } from '../calendar.js';
import { logActivity } from '../activity.js';

const router = Router();

// GET /calendar/auth-url - Obtener URL de autenticación de Google
router.get('/auth-url', authMiddleware, async (req: any, res) => {
    try {
        const url = await getGoogleAuthUrl(req.user.id);
        res.json({ url });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /calendar/callback - Callback de OAuth de Google
router.get('/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code || !state) {
            return res.status(400).json({ error: 'code y state requeridos' });
        }

        const result = await handleGoogleCallback(code as string, state as string);
        if (result.success) {
            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?google_connected=true`);
        } else {
            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?google_error=${result.error}`);
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /calendar/events - Listar eventos
router.get('/events', authMiddleware, async (req: any, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        const events = await listEvents(req.user.id, start, end);
        res.json(events);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /calendar/events - Crear evento
router.post('/events', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { summary, description, location, start, end, attendees, reminders, addMeet } = req.body;

        if (!summary || !start || !end) {
            return res.status(400).json({ error: 'summary, start y end requeridos' });
        }

        const result = await createEvent(
            req.user.id,
            {
                summary,
                description,
                location,
                start: new Date(start),
                end: new Date(end),
                attendees,
                reminders,
                addMeet
            },
            organizationId
        );

        if (result.success) {
            await logActivity({
                type: 'CREATED',
                description: `Evento de calendario creado: ${summary}`,
                organizationId: organizationId || '',
                userId: req.user.id
            });

            res.status(201).json(result);
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /calendar/local - Eventos locales (de la BD)
router.get('/local', authMiddleware, async (req: any, res) => {
    try {
        const { startDate, endDate } = req.query;
        let where: any = { userId: req.user.id };

        if (startDate || endDate) {
            where.start = {};
            if (startDate) {
                where.start.gte = new Date(startDate as string);
            }
            if (endDate) {
                where.start.lte = new Date(endDate as string);
            }
        }

        const events = await prisma.calendarEvent.findMany({
            where,
            orderBy: { start: 'asc' }
        });

        res.json(events);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
