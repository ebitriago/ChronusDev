// ChronusDev Backend - Main Entry Point
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

// Importar módulos
import { prisma } from './db.js';
import { authMiddleware, handleLogin, handleRegister, handleLogout, verifyToken, switchOrganization, verifyTokenEndpoint, handleForgotPassword, handleResetPassword } from './auth.js';
import { setSocketIO } from './notifications.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar documentación
import { specs } from './swagger.js';
import { apiReference } from '@scalar/express-api-reference';

// Importar rutas
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';
import timelogsRouter from './routes/timelogs.js';
import clientsRouter from './routes/clients.js';
import notificationsRouter from './routes/notifications.js';
import reportsRouter from './routes/reports.js';
import payoutsRouter from './routes/payouts.js';
import calendarRouter from './routes/calendar.js';
import usersRouter from './routes/users.js';
import organizationsRouter from './routes/organizations.js';
import webhooksRouter from './routes/webhooks/crm.js';
import uploadRouter from './routes/upload.js';
import standupsRouter from './routes/standups.js';
import activityRouter from './routes/activity.js';
import { registerDevice } from './controllers/push.controller.js';

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Coolify/Traefik)
const httpServer = createServer(app);
const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Configurar Socket.io en módulos
setSocketIO(io);

// Middleware
app.use(cors());
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
            "img-src": ["'self'", "data:", "https:"],
        },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json());
// Serve static files from public directory (one level up from src)
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 200 : 999999,
    message: { error: 'Demasiadas solicitudes' }
});

if (process.env.NODE_ENV === 'production' && process.env.RATE_LIMIT_DISABLED !== 'true') {
    app.use(limiter);
}

// Exponer io a rutas
app.set('io', io);

// Socket.io Connection
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    const token = socket.handshake.auth.token;
    if (token) {
        try {
            const decoded = verifyToken(token);
            if (decoded) {
                socket.join(`user_${decoded.userId}`);
                if (decoded.organizationId) {
                    socket.join(`org_${decoded.organizationId}`);
                }
                console.log(`✅ Socket authenticated: ${decoded.email}`);
            }
        } catch (err) {
            console.error('Socket auth error:', err);
        }
    }

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'chronusdev',
        timestamp: new Date().toISOString()
    });
});

// API Reference (Scalar)
app.get('/reference', apiReference({
    spec: {
        content: specs,
    },
    theme: 'purple',
    layout: 'modern',
}));

// ========== AUTH ROUTES ==========

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso
 *       401:
 *         description: Credenciales inválidas
 */
app.post(['/auth/login', '/api/auth/login'], async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'email y password requeridos' });
        }

        const result = await handleLogin(email, password);
        if (result.error) {
            return res.status(401).json(result);
        }

        res.json(result);
    } catch (error: any) {
        console.error('POST /auth/login error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Registrar nuevo usuario y organización
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 */
app.post(['/auth/register', '/api/auth/register'], async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'name, email y password requeridos' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password debe tener al menos 6 caracteres' });
        }

        const result = await handleRegister(name, email, password);
        if (result.error) {
            return res.status(400).json(result);
        }

        res.status(201).json(result);
    } catch (error: any) {
        console.error('POST /auth/register error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sesión cerrada
 */
app.post(['/auth/logout', '/api/auth/logout'], authMiddleware, async (req: any, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            await handleLogout(token);
        }
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Obtener perfil del usuario actual
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del usuario
 */
app.get(['/auth/me', '/api/auth/me'], authMiddleware, async (req: any, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                memberships: {
                    include: {
                        organization: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /auth/verify - Verificar token (útil para frontend)
app.post(['/auth/verify', '/api/auth/verify'], async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'token requerido' });
        }

        const result = await verifyTokenEndpoint(token);

        if (!result.valid) {
            return res.status(401).json(result);
        }

        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /auth/forgot-password
app.post(['/auth/forgot-password', '/api/auth/forgot-password'], async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email requerido' });

        const result = await handleForgotPassword(email);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /auth/reset-password
app.post(['/auth/reset-password', '/api/auth/reset-password'], async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ error: 'Token y nueva contraseña requeridos' });

        const result = await handleResetPassword(token, newPassword);
        if (result.error) return res.status(400).json(result);

        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ========== API ROUTER ==========
const apiRouter = express.Router();

// Mount all feature routes to apiRouter
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/tasks', tasksRouter);
apiRouter.use('/timelogs', timelogsRouter);
apiRouter.use('/clients', clientsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/payouts', payoutsRouter);
apiRouter.use('/payments', payoutsRouter); // Alias for frontend compatibility
apiRouter.use('/calendar', calendarRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/organizations', organizationsRouter);
apiRouter.use('/webhooks/crm', webhooksRouter);
apiRouter.use('/upload', uploadRouter);
apiRouter.use('/standups', standupsRouter);
apiRouter.use('/activity', activityRouter);

import searchRouter from './routes/search.js';
apiRouter.use('/search', searchRouter);

import chatRouter from './routes/chat.js';
apiRouter.use('/chat', chatRouter);

import dashboardRouter from './routes/dashboard.js';
apiRouter.use('/dashboard', dashboardRouter);

import ticketsRouter from './routes/tickets.js';
apiRouter.use('/tickets', ticketsRouter);

import transactionsRouter from './routes/transactions.js';
apiRouter.use('/transactions', transactionsRouter);

// Push Notifications
apiRouter.post('/push-devices', authMiddleware, registerDevice);

// Mount apiRouter at root AND /api to handle proxy differences
app.use('/api', apiRouter);
app.use('/', apiRouter);


// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Error interno del servidor'
    });
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 ChronusDev API listening on http://0.0.0.0:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔌 Socket.io ready on /socket.io`);
});
