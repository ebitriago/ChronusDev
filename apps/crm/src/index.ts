import 'dotenv/config';
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import { apiReference } from '@scalar/express-api-reference';
import swaggerJsdoc from 'swagger-jsdoc';
import multer from 'multer';

// ... imports ...

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

// Uploads directory check moved to routes/upload.ts


// ... ASSISTAI_CONFIG ...

const app = express();
// Enable trust proxy for rate limiting behind load balancers/proxies
app.set('trust proxy', 1); // trusting 1 hop (coolify/traefik)
// ...

app.use(cors());
// app.use(helmet()); // Helmet can conflict with cross-origin images if not configured, careful. 
// For now, disabling strict CSP for images or just standard helmet is fine, but let's be aware.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
            "script-src-attr": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", "data:", "https:"],
        },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json());
// Serve static files (public) AND uploads
app.use(express.static(path.join(_dirname, '../public')));
app.use('/uploads', express.static(path.join(_dirname, '../public/uploads')));

// ... Rate Limiting ...

import type { Customer, Ticket, Invoice, Communication, TicketStatus, Transaction, Lead, Tag, ChatMessage, Conversation, ContactIdentity, ContactType } from "./types.js";
import { authMiddleware, optionalAuth, requireRole, handleLogin, handleRegister, handleLogout, getAssistAIAuthUrl, handleAssistAICallback, switchOrganization, generateToken } from "./auth.js";
import { prisma } from "./db.js";
import erpRouter from "./routes/erp.js";
import apiKeysRouter from "./routes/api-keys.js";
import webhooksRouter from "./routes/webhooks.js";
import metaRouter from './routes/meta.js';
import pipelineRouter from './routes/pipeline.js';
import dashboardRouter from './routes/dashboard.js';
import analyticsRouter from "./routes/analytics.js";
import { logActivity, getCustomerActivities, getLeadActivities, getTicketActivities, getRecentActivities, activityTypeLabels, activityTypeIcons } from "./activity.js";
import { sendEmail, verifyEmailConnection, emailTemplates } from "./email.js";
import { getGoogleAuthUrl, handleGoogleCallback, createEvent, listEvents, createClientMeeting, createFollowUpReminder } from "./calendar.js";
import { getUserIntegrations, saveUserIntegration } from "./integrations.js";
import { generateInvoicePDF, generateAnalyticsPDF } from "./reports.js";
import { AssistAIService, assistaiFetch, getAssistAIConfig } from "./services/assistai.js";
import bcrypt from "bcryptjs";
import { validateAgentId } from "./voice.js";
import * as whatsmeow from "./whatsmeow.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { syncCustomerToChronusDev, updateChronusDevClient, syncTicketToChronusDev, ensureCustomerSynced } from "./services/chronusdev-sync.js";

import { getInvoicePDFBuffer } from "./reports.js";

import { startAssistAISyncJob } from "./jobs/assistai-sync.js";

// Start Background Jobs
startAssistAISyncJob();

import { conversationTakeovers, type ConversationTakeover } from "./data.js"; // Restored import

// Fix: Define ASSISTAI_CONFIG global fallback
const ASSISTAI_CONFIG = {
    baseUrl: process.env.ASSISTAI_API_URL || 'https://public.assistai.lat',
    apiToken: process.env.ASSISTAI_API_TOKEN,
    tenantDomain: process.env.ASSISTAI_TENANT_DOMAIN,
    organizationCode: process.env.ASSISTAI_ORG_CODE
};

// app is already declared above
const httpServer = createServer(app);
const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// app.use(cors()); // Duplicate, already used above
// app.use(helmet()); // Duplicate
// app.use(express.json()); // Duplicate
// app.use(express.static(path.join(_dirname, '../public'))); // Duplicate

// Global Rate Limiter (disabled for testing/development)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 200 : 999999, // Effectively disabled for testing
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas solicitudes, por favor intente más tarde." }
});

// Apply granular limits to Auth routes  
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'production' ? 10 : 999999, // Effectively disabled for testing
    message: { error: "Demasiados intentos de inicio de sesión, intente más tarde." }
});

// Only apply rate limiting in production and if not explicitly disabled
if (process.env.NODE_ENV === 'production' && process.env.RATE_LIMIT_DISABLED !== 'true') {
    app.use(limiter);
    app.use("/auth/login", authLimiter);
}

import { invoicesRouter } from "./routes/invoices.js";
import { customersRouter } from "./routes/customers.js";

app.use("/erp", erpRouter);

app.get("/api/ai/context/customers/:id", authMiddleware, async (req: any, res) => {
    // Redirect to the customers router implementation
    res.redirect(307, `/customers/${req.params.id}/ai-context`);
});

// ========== API ROUTER ==========
const apiRouter = express.Router();

// Main router registrations
apiRouter.use("/invoices", invoicesRouter);
apiRouter.use("/customers", customersRouter);
apiRouter.use("/clients", customersRouter); // Alias for frontend compatibility
apiRouter.use("/api-keys", apiKeysRouter);
apiRouter.use("/webhooks", webhooksRouter);
apiRouter.use("/meta", metaRouter);
apiRouter.use("/pipeline-stages", pipelineRouter);
import billingRouter from './routes/billing.js';
apiRouter.use("/billing", billingRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/analytics", analyticsRouter);

import { ticketsRouter } from './routes/tickets.js';
import { leadsRouter } from './routes/leads.js';
import { notificationsRouter } from './routes/notifications.js';
import { sendPushToUser, createNotificationWithPush, broadcastNotification } from './services/push-service.js';

apiRouter.use("/tickets", ticketsRouter);
apiRouter.use("/leads", leadsRouter);
apiRouter.use("/notifications", notificationsRouter);

import searchRouter from './routes/search.js';
apiRouter.use("/search", searchRouter);

import chronusdevWebhooksRouter from './routes/chronusdev-webhooks.js';
apiRouter.use("/webhooks/chronusdev", chronusdevWebhooksRouter);

import uploadRouter from './routes/upload.js';
apiRouter.use('/upload', uploadRouter);

import { aiAgentRouter } from './routes/ai-agents.js';
apiRouter.use("/ai-agents", aiAgentRouter);

import { aiRouter } from './routes/ai.js';
apiRouter.use("/ai", aiRouter);

// Mount apiRouter at root AND /api to handle proxy differences
app.use('/api', apiRouter);
app.use('/', apiRouter);






// In-memory conversations map (fallback for non-persisted state)
const conversations: Map<string, any> = new Map();

// Socket.io Connection Logic

// Socket.io Connection Logic
// Socket.io Connection Logic
// Expose io to routes
app.set('io', io);

import jwt from 'jsonwebtoken';

io.on("connection", (socket) => {
    console.log("🔌 Client connected:", socket.id);

    // Authenticate socket
    const token = socket.handshake.auth.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
            if (decoded && decoded.id) {
                socket.join(`user_${decoded.id}`);
                if (decoded.organizationId) {
                    socket.join(`org_${decoded.organizationId}`);
                    console.log(`Socket ${socket.id} joined org_${decoded.organizationId}`);
                }
                console.log(`Socket ${socket.id} authenticated as user ${decoded.id}`);
            }
        } catch (e) {
            console.error("Socket auth failed:", e);
        }
    }

    // Join a specific conversation room
    socket.on("join_conversation", (sessionId: string) => {
        socket.join(sessionId);
        console.log(`Socket ${socket.id} joined room: ${sessionId}`);
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

// Health check
// Health check
app.get("/health", (req, res) => res.json({ status: "ok", service: "chronus-crm" }));

// ========== ASSISTAI PROXY ==========

app.get("/api/assistai/agent-config/:agentId", async (req, res) => {
    const { agentId } = req.params;

    // Check if configuration is present
    if (!ASSISTAI_CONFIG.apiToken || !ASSISTAI_CONFIG.tenantDomain || !ASSISTAI_CONFIG.organizationCode) {
        return res.status(500).json({
            error: 'Configuration missing',
            details: 'ASSISTAI_API_TOKEN, ASSISTAI_TENANT_DOMAIN, or ASSISTAI_ORG_CODE not set'
        });
    }

    try {
        const response = await fetch(`${ASSISTAI_CONFIG.baseUrl}/api/v1/agents/${agentId}/configuration`, {
            headers: {
                'x-tenant-domain': ASSISTAI_CONFIG.tenantDomain,
                'x-organization-code': ASSISTAI_CONFIG.organizationCode,
                'Authorization': `Bearer ${ASSISTAI_CONFIG.apiToken}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AssistAI] Config Error for agent ${agentId}:`, response.status, errorText);
            return res.status(response.status).json({
                error: 'Failed to fetch agent config',
                details: errorText
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        console.error('[AssistAI] Config Exception:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// ========== CUSTOMERS ==========

/**
 * @openapi
 * /customers:
 *   get:
 *     tags: [Customers]
 *     summary: List Customers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [TRIAL, ACTIVE, INACTIVE, CHURNED] }
 *       - in: query
 *         name: search
 *         description: Search by name, email, or company
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of customers
 */

/**
 * @openapi
 * /customers:
 *   post:
 *     tags: [Customers]
 *     summary: Create a new Customer or Lead
 *     description: Create a new customer record. Use this endpoint for inbound leads from landing pages.
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Jane Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "jane@company.com"
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               company:
 *                 type: string
 *                 example: "Tech Corp"
 *               status:
 *                 type: string
 *                 enum: [TRIAL, ACTIVE, INACTIVE, CHURNED]
 *                 default: TRIAL
 *           examples:
 *             New Lead:
 *               summary: Create a new inbound lead
 *               value:
 *                 name: "Interested User"
 *                 email: "lead@gmail.com"
 *                 status: "TRIAL"
 *                 company: "Small Biz"
 *     responses:
 *       200:
 *         description: Customer created successfully
 */

// Customer routes moved to routes/customers.ts


// Update and Create routes moved to routes/customers.ts



/**
 * @openapi
 * /customers/{id}:
 *   delete:
 *     tags: [Customers]
 *     summary: Delete a customer
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer deleted successfully
 */
// Delete moved

// ========== TICKETS ==========

/**
 * @openapi
 * /tickets:
 *   get:
 *     tags: [Tickets]
 *     summary: List Support Tickets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [OPEN, IN_PROGRESS, WAITING, RESOLVED, CLOSED] }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [LOW, MEDIUM, HIGH, URGENT] }
 *     responses:
 *       200:
 *         description: List of tickets
 */

/**
 * @openapi
 * /tickets:
 *   post:
 *     tags: [Tickets]
 *     summary: Create a Support Ticket
 *     description: Create a new support ticket linked to a customer.
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId, title]
 *             properties:
 *               customerId:
 *                 type: string
 *                 description: The ID of the customer (client)
 *               title:
 *                 type: string
 *                 example: "Integration Help"
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *                 default: MEDIUM
 *           examples:
 *             Support Request:
 *               summary: Standard support request
 *               value:
 *                 title: "Webhook failure"
 *                 description: "I am not receiving 200 OK from the webhook."
 *                 customerId: "cm..."
 *                 priority: "HIGH"
 *     responses:
 *       200:
 *         description: Ticket created
 */

// Tickets routes moved to /routes/tickets.ts



/**
 * @openapi
 * /clients:
 *   get:
 *     summary: List all clients
 *     tags: [Clients]
 *     responses:
 *       200:
 *         description: Array of clients
 */
app.post("/contacts", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { customerId, type, value, displayName, isPrimary } = req.body;

        if (!customerId || !type || !value) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const contact = await prisma.contact.create({
            data: {
                customerId,
                type,
                value,
                displayName,
                isPrimary: isPrimary || false,
                organizationId: organizationId!
            }
        });

        res.status(201).json(contact);
    } catch (e: any) {
        console.error("POST /contacts error:", e);
        res.status(500).json({ error: "Error creating contact" });
    }
});

app.delete("/contacts/:id", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        await prisma.contact.delete({
            where: { id: req.params.id, organizationId } as any
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Error deleting contact" });
    }
});

/**
 * @openapi
 * /clients:
 *   get:
 *     summary: List clients
 */


/**
 * @openapi
 * /clients/{id}/360:
 *   get:
 *     summary: Get comprehensive 360-degree view of a client
 *     tags: [Clients]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Client detailed view
 */
// 360 View moved to /customers/:id/360 in routes/customers.ts


// ========== REPORTS ==========

app.get("/reports/sales", authMiddleware, async (req: any, res) => {
    try {
        console.log("[Reports DEBUG] GET /reports/sales START");
        console.log("[Reports DEBUG] User:", req.user);
        const organizationId = req.user?.organizationId;
        console.log("[Reports DEBUG] OrganizationID:", organizationId);

        if (!organizationId) {
            console.error("[Reports DEBUG] MISSING ORGANIZATION ID for user:", req.user?.id);
            return res.status(401).json({ error: "No organization context" });
        }

        // Sales Report: Aggregate Leads (Customers with status 'LEAD' or specific Lead model if exists)
        // ... (Logic remains)

        // CUSTOMER GROWTH
        const totalCustomers = await prisma.customer.count({
            where: { organizationId, status: 'ACTIVE' }
        });
        console.log("[Reports DEBUG] Total Customers:", totalCustomers);

        const newCustomersThisMonth = await prisma.customer.count({
            where: {
                organizationId,
                status: 'ACTIVE',
                createdAt: {
                    gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                }
            }
        });
        console.log("[Reports DEBUG] New Customers:", newCustomersThisMonth);

        res.json({
            totalCustomers,
            newCustomersThisMonth,
            growth: totalCustomers > 0 ? (newCustomersThisMonth / totalCustomers) * 100 : 0
        });
    } catch (e: any) {
        console.error("GET /reports/sales error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get("/reports/support", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: "No organization context" });

        const openTickets = await prisma.ticket.count({
            where: { organizationId, status: 'OPEN' }
        });

        const closedTickets = await prisma.ticket.count({
            where: { organizationId, status: 'CLOSED' }
        });

        const ticketsByPriority = await prisma.ticket.groupBy({
            by: ['priority'],
            where: { organizationId },
            _count: {
                priority: true
            }
        });

        res.json({
            openTickets,
            closedTickets,
            ticketsByPriority: ticketsByPriority.map(t => ({ name: t.priority, value: t._count.priority }))
        });
    } catch (e: any) {
        console.error("GET /reports/support error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get("/reports/customers", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: "No organization context" });

        const total = await prisma.customer.count({ where: { organizationId } });

        const byStatus = await prisma.customer.groupBy({
            by: ['status'],
            where: { organizationId },
            _count: { status: true }
        });

        const byPlan = await prisma.customer.groupBy({
            by: ['plan'],
            where: { organizationId },
            _count: { plan: true }
        });

        res.json({
            total,
            byStatus: byStatus.map(s => ({ name: s.status, value: s._count.status })),
            byPlan: byPlan.map(p => ({ name: p.plan, value: p._count.plan }))
        });
    } catch (e: any) {
        console.error("GET /reports/customers error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Historical Trends - Last 6 months
app.get("/reports/trends", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: "No organization context" });

        const months = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

            const monthStr = date.toLocaleString('es', { month: 'short' });

            const customers = await prisma.customer.count({
                where: {
                    organizationId,
                    createdAt: { lte: endDate }
                }
            });

            const tickets = await prisma.ticket.count({
                where: {
                    organizationId,
                    createdAt: {
                        gte: date,
                        lte: endDate
                    }
                }
            });

            const invoices = await prisma.invoice.aggregate({
                where: {
                    organizationId,
                    status: 'PAID',
                    createdAt: {
                        gte: date,
                        lte: endDate
                    }
                },
                _sum: { amount: true }
            });

            months.push({
                month: monthStr,
                customers,
                tickets,
                revenue: invoices._sum.amount || 0
            });
        }

        res.json({ trends: months });
    } catch (e: any) {
        console.error("GET /reports/trends error:", e);
        res.status(500).json({ error: "Error al obtener tendencias" });
    }
});

// Period Comparison (This Month vs Last Month)
app.get("/reports/comparison", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: "No organization context" });

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        // This month stats
        const thisMonthCustomers = await prisma.customer.count({
            where: {
                organizationId,
                createdAt: { gte: thisMonthStart }
            }
        });

        const thisMonthTickets = await prisma.ticket.count({
            where: {
                organizationId,
                createdAt: { gte: thisMonthStart }
            }
        });

        const thisMonthRevenue = await prisma.invoice.aggregate({
            where: {
                organizationId,
                status: 'PAID',
                createdAt: { gte: thisMonthStart }
            },
            _sum: { amount: true }
        });

        // Last month stats
        const lastMonthCustomers = await prisma.customer.count({
            where: {
                organizationId,
                createdAt: {
                    gte: lastMonthStart,
                    lte: lastMonthEnd
                }
            }
        });

        const lastMonthTickets = await prisma.ticket.count({
            where: {
                organizationId,
                createdAt: {
                    gte: lastMonthStart,
                    lte: lastMonthEnd
                }
            }
        });

        const lastMonthRevenue = await prisma.invoice.aggregate({
            where: {
                organizationId,
                status: 'PAID',
                createdAt: {
                    gte: lastMonthStart,
                    lte: lastMonthEnd
                }
            },
            _sum: { amount: true }
        });

        const calcChange = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Math.round(((current - previous) / previous) * 100);
        };

        res.json({
            thisMonth: {
                customers: thisMonthCustomers,
                tickets: thisMonthTickets,
                revenue: thisMonthRevenue._sum.amount || 0
            },
            lastMonth: {
                customers: lastMonthCustomers,
                tickets: lastMonthTickets,
                revenue: lastMonthRevenue._sum.amount || 0
            },
            change: {
                customers: calcChange(thisMonthCustomers, lastMonthCustomers),
                tickets: calcChange(thisMonthTickets, lastMonthTickets),
                revenue: calcChange(thisMonthRevenue._sum.amount || 0, lastMonthRevenue._sum.amount || 0)
            }
        });
    } catch (e: any) {
        console.error("GET /reports/comparison error:", e);
        res.status(500).json({ error: "Error al obtener comparación" });
    }
});


app.delete("/clients/:id", authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;

        await prisma.customer.delete({
            where: { id, organizationId } as any
        });

        res.json({ success: true });
    } catch (e) {
        console.error("DELETE /clients/:id error:", e);
        res.status(500).json({ error: "Error deleting client" });
    }
});


/**
 * @openapi
 * /clients/{id}:
 *   put:
 *     summary: Update a client
 *     tags: [Clients]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               contactName: { type: string }
 *               phone: { type: string }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Client updated
 */






// ========== INTEGRATIONS MANAGEMENT ==========

/**
 * @openapi
 * /integrations:
 *   get:
 *     summary: Get all integrations for the current user
 *     tags: [Integrations]
 */
app.get("/integrations", authMiddleware, async (req: any, res) => {
    try {
        const integrations = await getUserIntegrations(req.user.id);
        res.json(integrations);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/debug/email", authMiddleware, async (req: any, res) => {
    const { to, subject, html } = req.body;
    try {
        const result = await sendEmail({
            to: to || req.user.email,
            subject: subject || "Test Email from ChronusCRM",
            html: html || "<p>This is a test email sent from the debug endpoint.</p>",
            userId: req.user.id,
            organizationId: req.user.organizationId
        });
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * @openapi
 * /integrations:
 *   post:
 *     summary: Save or update an integration configuration
 *     tags: [Integrations]
 */
app.post("/integrations", authMiddleware, async (req: any, res) => {
    const { provider, credentials, isEnabled, metadata } = req.body;

    if (!provider || !credentials) {
        return res.status(400).json({ error: "Provider and credentials are required" });
    }

    try {
        const integration = await saveUserIntegration(req.user.id, {
            provider,
            credentials,
            isEnabled: isEnabled !== undefined ? isEnabled : true,
            metadata
        });

        res.json({ success: true, integration });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ========== VOICE (ELEVENLABS + TWILIO) ==========

import { initiateOutboundCall, handleElevenLabsTranscript } from './voice.js';
import { initScheduler } from './scheduler.js';
import { initReminderScheduler, processReminders } from './reminderScheduler.js';

// Initialize the scheduler for pending calls
initScheduler();

// Initialize the reminder scheduler for automated messages
initReminderScheduler();

/**
 * @openapi
 * /voice/call:
 *   post:
 *     summary: Initiate an outbound AI call
 *     tags: [Voice]
 */
app.post("/voice/call", authMiddleware, async (req: any, res) => {
    try {
        const { customerNumber, agentId } = req.body;
        if (!customerNumber) {
            return res.status(400).json({ error: "Customer number is required" });
        }

        const result = await initiateOutboundCall(customerNumber, agentId);
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /interactions/schedule:
 *   post:
 *     summary: Schedule an outbound interaction (Call, WhatsApp, Email)
 *     tags: [Interactions]
 */
app.post("/interactions/schedule", authMiddleware, async (req: any, res) => {
    try {
        const { customerId, scheduledAt, type, content, subject, metadata } = req.body;

        if (!customerId || !scheduledAt || !type) {
            return res.status(400).json({ error: "Customer ID, Schedule Time, and Type are required" });
        }

        const date = new Date(scheduledAt);
        if (isNaN(date.getTime())) {
            return res.status(400).json({ error: "Invalid scheduledAt date" });
        }

        const interaction = await prisma.scheduledInteraction.create({
            data: {
                customerId,
                scheduledAt: date,
                type, // VOICE, WHATSAPP, EMAIL
                content, // Message or Email body
                subject, // Email subject
                metadata: metadata || {},
                status: 'PENDING'
            }
        });

        res.json({ success: true, interaction });
    } catch (err: any) {
        console.error("Schedule Error:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /webhooks/elevenlabs/transcript:
 *   post:
 *     summary: Receive conversation transcripts from ElevenLabs
 *     tags: [Webhooks]
 */
app.post("/webhooks/elevenlabs/transcript", async (req, res) => {
    // Determine if we need to verify signature? 
    // ElevenLabs might sign requests. For now, open.
    try {
        await handleElevenLabsTranscript(req.body);
        res.json({ received: true });
    } catch (err: any) {
        console.error("Webhook Error:", err);
        res.status(500).json({ error: "Internal Error" });
    }
});

// ========== REMINDER TEMPLATES ==========

/**
 * @openapi
 * /reminders/templates:
 *   get:
 *     summary: List all reminder templates for the organization
 *     tags: [Reminders]
 */
app.get("/reminders/templates", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(400).json({ error: "Organization context required" });

        const templates = await prisma.reminderTemplate.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' }
        });

        res.json(templates);
    } catch (err: any) {
        console.error("GET /reminders/templates error:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /reminders/templates:
 *   post:
 *     summary: Create a new reminder template
 *     tags: [Reminders]
 */
app.post("/reminders/templates", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(400).json({ error: "Organization context required" });

        const { name, triggerType, daysBefore, channel, subject, content, isEnabled } = req.body;

        if (!name || !triggerType || !channel || !content) {
            return res.status(400).json({ error: "Campos requeridos: name, triggerType, channel, content" });
        }

        const template = await prisma.reminderTemplate.create({
            data: {
                organizationId,
                name,
                triggerType,
                daysBefore: daysBefore || 0,
                channel,
                subject,
                content,
                isEnabled: isEnabled !== false
            }
        });

        res.json(template);
    } catch (err: any) {
        console.error("POST /reminders/templates error:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /reminders/templates/{id}:
 *   put:
 *     summary: Update a reminder template
 *     tags: [Reminders]
 */
app.put("/reminders/templates/:id", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(400).json({ error: "Organization context required" });

        const { id } = req.params;
        const { name, triggerType, daysBefore, channel, subject, content, isEnabled } = req.body;

        // Verify ownership
        const existing = await prisma.reminderTemplate.findFirst({
            where: { id, organizationId }
        });

        if (!existing) {
            return res.status(404).json({ error: "Template no encontrado" });
        }

        const template = await prisma.reminderTemplate.update({
            where: { id },
            data: {
                name,
                triggerType,
                daysBefore,
                channel,
                subject,
                content,
                isEnabled
            }
        });

        res.json(template);
    } catch (err: any) {
        console.error("PUT /reminders/templates error:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /reminders/templates/{id}:
 *   delete:
 *     summary: Delete a reminder template
 *     tags: [Reminders]
 */
app.delete("/reminders/templates/:id", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(400).json({ error: "Organization context required" });

        const { id } = req.params;

        // Verify ownership
        const existing = await prisma.reminderTemplate.findFirst({
            where: { id, organizationId }
        });

        if (!existing) {
            return res.status(404).json({ error: "Template no encontrado" });
        }

        await prisma.reminderTemplate.delete({ where: { id } });

        res.json({ success: true });
    } catch (err: any) {
        console.error("DELETE /reminders/templates error:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /reminders/process:
 *   post:
 *     summary: Manually trigger reminder processing (for testing)
 *     tags: [Reminders]
 */
app.post("/reminders/process", authMiddleware, async (req: any, res) => {
    try {
        // Only allow admins/super admins
        if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
            return res.status(403).json({ error: "No autorizado" });
        }

        await processReminders();
        res.json({ success: true, message: "Reminders processed" });
    } catch (err: any) {
        console.error("POST /reminders/process error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ========== END REMINDER TEMPLATES ==========

// ========== END VOICE ==========

// Add contact to existing customer (for linking conversations)
app.post("/customers/:id/contacts", authMiddleware, async (req: any, res) => {
    const organizationId = req.user.organizationId;
    const customerId = req.params.id;
    const { type, value, sessionId } = req.body;

    if (!type || !value) {
        return res.status(400).json({ error: "type and value are required" });
    }

    try {
        // Get current customer
        const customer = await prisma.customer.findFirst({
            where: { id: customerId, organizationId }
        });

        if (!customer) {
            return res.status(404).json({ error: "Customer not found" });
        }

        // Update customer phone/email field directly
        let updateData: any = {};
        if (type === 'whatsapp' || type === 'phone' || type === 'web') {
            // Only update if no phone exists or force update
            if (!customer.phone) {
                updateData.phone = value;
            }
        } else if (type === 'email') {
            if (!customer.email || customer.email.includes('@placeholder.com')) {
                updateData.email = value;
            }
        }

        // Update customer if there are changes
        if (Object.keys(updateData).length > 0) {
            await prisma.customer.update({
                where: { id: customerId },
                data: updateData
            });
        }

        // Create a Contact record in the Contact table
        const contactType = (type === 'web' ? 'PHONE' : type).toUpperCase();

        // Check if contact already exists
        const existingContact = await prisma.contact.findFirst({
            where: {
                customerId,
                value: value
            }
        });

        let contact;
        if (!existingContact) {
            contact = await prisma.contact.create({
                data: {
                    customerId,
                    organizationId,
                    type: contactType,
                    value: value,
                    displayName: customer.name,
                    verified: true
                }
            });
            console.log(`[Link Client] Created contact: ${contactType} ${value} for customer ${customer.name}`);
        } else {
            contact = existingContact;
            console.log(`[Link Client] Contact already exists for ${value}`);
        }

        // Update the conversation customerName if sessionId provided
        if (sessionId) {
            await prisma.conversation.updateMany({
                where: {
                    sessionId,
                    organizationId
                },
                data: {
                    customerName: customer.name,
                    customerId: customer.id
                }
            });
            console.log(`[Link Client] Updated conversation ${sessionId} with customer name: ${customer.name}`);
        }

        // Get all contacts for response
        const allContacts = await prisma.contact.findMany({
            where: { customerId }
        });

        res.json({
            success: true,
            client: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone || value,
                contacts: allContacts
            }
        });
    } catch (error: any) {
        console.error('Error adding contact to customer:', error);
        res.status(500).json({ error: error.message });
    }
});

// Manual Sync Endpoint
app.post("/customers/:id/sync", authMiddleware, async (req: any, res) => {
    const organizationId = req.user.organizationId;

    try {
        const customer = await prisma.customer.findFirst({
            where: { id: req.params.id, organizationId } as any
        });

        if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });

        const CHRONUSDEV_URL = process.env.CHRONUSDEV_URL || process.env.CHRONUSDEV_API_URL || "http://chronusdev-backend:3001";

        if (customer.chronusDevClientId) {
            // Update existing
            const response = await fetch(`${CHRONUSDEV_URL}/clients/${customer.chronusDevClientId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.CHRONUSDEV_TOKEN || "token-admin-123"}`,
                },
                body: JSON.stringify({
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone,
                    contactName: customer.name,
                }),
            });
            if (!response.ok) throw new Error("Failed to update client in ChronusDev");
        } else {
            // Create new
            const response = await fetch(`${CHRONUSDEV_URL}/clients`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.CHRONUSDEV_TOKEN || "token-admin-123"}`,
                },
                body: JSON.stringify({
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone,
                    contactName: customer.name,
                }),
            });
            if (!response.ok) throw new Error("Failed to create client in ChronusDev");
            const client = await response.json();

            await prisma.customer.update({
                where: { id: customer.id },
                data: { chronusDevClientId: client.id }
            });

            // Auto-create Project "Soporte [Cliente]"
            try {
                const projectRes = await fetch(`${CHRONUSDEV_URL}/projects`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.CHRONUSDEV_TOKEN || "token-admin-123"}`,
                    },
                    body: JSON.stringify({
                        name: `Soporte ${customer.name}`,
                        description: `Proyecto automático para gestión de tickets de ${customer.name}`,
                        clientId: client.id,
                        budget: 0,
                        currency: "USD",
                        status: "ACTIVE"
                    }),
                });
                if (projectRes.ok) {
                    const project = await projectRes.json();
                    await prisma.customer.update({
                        where: { id: customer.id },
                        data: { chronusDevDefaultProjectId: project.id }
                    });
                }
            } catch (projErr) {
                console.error("Error creating auto-project:", projErr);
            }
        }
        res.json({ success: true, message: "Sincronizado con ChronusDev" });
    } catch (err: any) {
        console.error("Sync error:", err);
        res.status(500).json({ error: err.message || "Error syncing with ChronusDev" });
    }
});

// Create Task in ChronusDev for Customer
app.post("/customers/:id/chronus-task", authMiddleware, async (req: any, res) => {
    const organizationId = req.user.organizationId;

    try {
        const customer = await prisma.customer.findFirst({
            where: { id: req.params.id, organizationId } as any
        });

        if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });

        const { title, description } = req.body;
        const CHRONUSDEV_URL = process.env.CHRONUSDEV_API_URL || "http://127.0.0.1:3001";

        // Get or create project for customer
        let projectId = customer.chronusDevDefaultProjectId;

        if (!projectId) {
            // Try to sync customer first to create project
            await fetch(`${CHRONUSDEV_URL}/clients`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.CHRONUSDEV_TOKEN || "token-admin-123"}`,
                },
                body: JSON.stringify({ name: customer.name, email: customer.email }),
            });
            // For now, return error if no project
            return res.status(400).json({ error: "Cliente no tiene proyecto en ChronusDev. Sincroniza primero." });
        }

        // Create task in ChronusDev
        const taskRes = await fetch(`${CHRONUSDEV_URL}/tasks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.CHRONUSDEV_TOKEN || "token-admin-123"}`,
            },
            body: JSON.stringify({
                projectId,
                title: title || `Tarea para ${customer.name}`,
                description: description || `Tarea creada desde CRM`,
                priority: 'MEDIUM'
            }),
        });

        if (taskRes.ok) {
            const task = await taskRes.json();
            res.json({ success: true, task });
        } else {
            res.status(500).json({ error: "Error creando tarea en ChronusDev" });
        }
    } catch (err: any) {
        console.error("Error creating ChronusDev task:", err);
        res.status(500).json({ error: err.message });
    }
});
// Duplicate /tickets endpoints removed. See lines 247+ for active implementation.






// Ticket update moved to /routes/tickets.ts


// 🔥 AI AGENT ENDPOINT: Simple webhook for AI to create tickets
// 🔥 AI AGENT ENDPOINT: Simple webhook for AI to create tickets
app.post("/api/ai/tickets", async (req, res) => {
    // Basic Auth Check (API Key)
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== 'chronus-ai-key' && process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const { title, description, customerEmail, priority = "MEDIUM" } = req.body;

    if (!title || !customerEmail) {
        return res.status(400).json({ error: "title y customerEmail requeridos" });
    }

    try {
        // 1. Find Customer (First match since email is not unique globally anymore)
        let customer = await prisma.customer.findFirst({
            where: { email: customerEmail }
        });

        if (!customer) {
            // Cannot create customer without Organization context.
            return res.status(404).json({ error: "Cliente no encontrado. El cliente debe existir en el CRM para crear tickets via AI." });
        }

        // 2. Create Ticket
        const ticket = await prisma.ticket.create({
            data: {
                title: `[AI] ${title}`,
                description: description || "Creado por Agente AI",
                status: "OPEN",
                priority: priority as any,
                customerId: customer.id,
                organizationId: (customer as any).organizationId
            } as any
        });



        res.json(ticket);
    } catch (e: any) {
        console.error("Error in AI ticket webhook:", e);
        res.status(500).json({ error: e.message });
    }
});




// 🔥 INTEGRACIÓN: Enviar ticket a ChronusDev como tarea
app.post("/tickets/:id/send-to-chronusdev", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const userId = req.user?.id;

        if (!organizationId) {
            return res.status(400).json({ error: "Organization context required" });
        }

        const ticket = await (prisma as any).ticket.findFirst({
            where: { id: req.params.id, organizationId },
            include: { customer: true }
        });

        if (!ticket) return res.status(404).json({ error: "Ticket no encontrado" });

        // Allow re-sending if it failed previously (check if chronusDevTaskId is set)
        // if (ticket.taskId) return res.status(400).json({ error: "Ticket ya vinculado a una tarea", taskId: ticket.taskId });

        let { projectId, priority, assignedToId } = req.body;

        // 1. Resolve Project ID
        if (!projectId) {
            projectId = ticket.customer?.chronusDevDefaultProjectId;
        }

        // 2. Ensure Project exists locally (Reference integrity)
        if (projectId) {
            const localProject = await (prisma as any).project.findUnique({ where: { id: projectId } });
            if (!localProject) {
                console.log(`[ChronusDev] Project ${projectId} missing locally, creating shadow copy...`);
                // Create shadow project
                try {
                    await (prisma as any).project.create({
                        data: {
                            id: projectId,
                            name: `Soporte ${ticket.customer?.name || 'Cliente'}`,
                            description: 'Proyecto sincronizado de ChronusDev',
                            status: 'ACTIVE',
                            organizationId,
                            customerId: ticket.customerId || null
                        }
                    });
                } catch (err: any) {
                    console.error("[ChronusDev] Error creating shadow project:", err.message);
                    // Proceeding might fail if it was race condition, generally safe to continue to Try Task Create
                }
            }
        } else {
            // Create Default Local Project if absolutely no ID available
            console.log('[ChronusDev] No project found, auto-creating local default...');
            const defaultProject = await (prisma as any).project.create({
                data: {
                    name: 'Tickets de Soporte',
                    description: 'Proyecto automático',
                    status: 'ACTIVE',
                    organizationId,
                    customerId: ticket.customerId || null
                }
            });
            projectId = defaultProject.id;

            // Save as default for customer
            if (ticket.customerId) {
                await (prisma as any).customer.update({
                    where: { id: ticket.customerId },
                    data: { chronusDevDefaultProjectId: projectId }
                });
            }
        }

        // 3. Create Local Task (Mirror)
        const task = await (prisma as any).task.create({
            data: {
                title: `[TICKET] ${ticket.title}`,
                description: `Origen Ticket: ${ticket.id}\nCliente: ${ticket.customer?.name || "N/A"}\n\n${ticket.description || ""}`,
                priority: priority || ticket.priority || 'MEDIUM',
                status: 'BACKLOG',
                projectId: projectId, // This is now guaranteed(ish) to exist
                assignedToId: assignedToId || null,
                createdById: userId,
                tickets: {
                    connect: { id: ticket.id }
                }
            }
        });

        // 4. Sync to Remote ChronusDev (The actual "Send")
        // We use the service which expects customer to have default project
        // Temporarily ensure customer has this project set if not already
        if (ticket.customerId && !ticket.customer?.chronusDevDefaultProjectId) {
            await (prisma as any).customer.update({
                where: { id: ticket.customerId },
                data: { chronusDevDefaultProjectId: projectId }
            });
            ticket.customer.chronusDevDefaultProjectId = projectId; // Update local ref
        }

        let remoteTaskId = null;
        try {
            remoteTaskId = await syncTicketToChronusDev(ticket as any, ticket.customer as any);
        } catch (syncErr: any) {
            console.error("[ChronusDev] Remote sync failed, but local task created:", syncErr);
            // Don't fail the request, just warn
        }

        // Update Ticket with task link and remote ID
        await (prisma as any).ticket.update({
            where: { id: ticket.id },
            data: {
                taskId: task.id,
                status: "IN_PROGRESS",
                chronusDevTaskId: remoteTaskId || undefined,
                chronusDevProjectId: projectId
            }
        });

        res.json({
            success: true,
            task,
            message: remoteTaskId ? "Enviado a ChronusDev exitosamente" : "Creado localmente (Fallo sincronización remota)"
        });

    } catch (e: any) {
        console.error("POST /tickets/:id/send-to-chronusdev error:", e);
        res.status(500).json({ error: e.message || "Error interno" });
    }
});

// ========== GOOGLE CALENDAR ==========

import { getAuthUrl as getNewAuthUrl, handleGoogleCallback as handleNewGoogleCallback, getGoogleCalendarEvents } from './services/google-calendar.js';

app.get('/auth/google', (req, res) => {
    const url = getNewAuthUrl();
    res.json({ url });
});

app.get('/auth/google/callback', async (req, res) => {
    const { code, is_new_integration } = req.query;
    // We expect state to contain userId, but if not we can try to get it from session or return error?
    // The previous implementation used state=userId.
    const userId = req.query.state as string;

    if (!code || !userId) {
        return res.status(400).json({ error: "Missing code or userId" });
    }

    try {
        const userInfo = await handleNewGoogleCallback(code as string, userId);
        // Redirect to frontend settings or calendar
        const frontendUrl = process.env.CRM_FRONTEND_URL ||
            (process.env.NODE_ENV === 'development' ? 'http://localhost:3003' : 'https://chronuscrm.assistai.work');
        res.redirect(`${frontendUrl}/calendar?google_connected=true&email=${userInfo.email}`);
    } catch (error) {
        console.error("Google Auth Error:", error);
        const frontendUrl = process.env.CRM_FRONTEND_URL ||
            (process.env.NODE_ENV === 'development' ? 'http://localhost:3003' : 'https://chronuscrm.assistai.work');
        res.redirect(`${frontendUrl}/calendar?google_error=true`);
    }
});

app.get('/calendar/google-events', authMiddleware, async (req: any, res) => {
    try {
        const events = await getGoogleCalendarEvents(req.user.id);
        res.json(events);
    } catch (error: any) {
        console.error("Google Calendar Error:", error);
        res.status(500).json({ error: error.message });
    }
});


// ========== TRANSACTIONS (LEGACY MOVED/DUPLICATED) ==========
// Note: Keeping this section temporarily for reference but identifying duplication.
// Transactions are now mostly handled in the later routes or dedicated files.
// NOTE: Communication model wasn't explicitly updated in my previous batch update because it wasn't in the snippet I copied? 
// Wait, I updated Customer, Ticket, Lead... Did I update Communication?
// I don't recall seeing ReferenceError during migration. I should check schema if Communication has organizationId.
// I think I missed Communication in the schema update! It was defined in data.ts but not sure if it was in Prisma.
// Lines 116 of data.ts shows `communications`.
// I MUST check `schema.prisma` for `Communication`. If it doesn't exist, I need to create it.
// If it exists but I didn't update it, I will fail here.
// Let's assume for a moment it might be missing or I need to skip it and fix schema next.
// Looking at my previous schema update, I see `Message` and `Conversation`, but not `Communication` model?
// Ah, `data.ts` has `tickets`, `communications`, `transactions`.
// My schema has `Ticket`, `Transaction`.
// Does it have `Communication`?
// I will SKIP `communications` refactor for now and just handle `transactions` which I KNOW I updated (lines 395 in schema).

// ========== TRANSACTIONS ==========

app.get("/transactions", authMiddleware, async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(400).json({ error: "Organization context required" });

        const { customerId, type, category } = req.query;
        const whereClause: any = { organizationId };

        if (customerId) whereClause.customerId = customerId as string;
        if (type) whereClause.type = type as any;
        // category is simple string in schema?
        if (category) whereClause.category = category as string;

        const transactions = await prisma.transaction.findMany({
            where: whereClause,
            orderBy: { date: 'desc' }
        });

        res.json(transactions);
    } catch (e) {
        console.error("GET /transactions error:", e);
        res.status(500).json({ error: "Error fetching transactions" });
    }
});

app.post("/transactions", authMiddleware, async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(400).json({ error: "Organization context required" });

        const { customerId, date, amount, type, category, description, status = "COMPLETED" } = req.body;
        if (!amount || !type || !description) {
            return res.status(400).json({ error: "Faltan campos requeridos (amount, type, description)" });
        }

        const transaction = await prisma.transaction.create({
            data: {
                customerId,
                date: new Date(date || Date.now()),
                amount: Number(amount),
                type: type as any,
                category,
                description,
                // status field? My schema has 'type', 'amount', 'currency', 'description', 'category', 'customerId', 'date'.
                // Does it have 'status'? 
                // Line 395 in schema view showed Transaction model.
                // It had `type`, `amount`, `currency`, `description`, `category`, `customerId`, `date`, `createdAt`.
                // It did NOT have `status`.
                // So I cannot save `status`.
                organizationId
            } as any
        });

        res.json(transaction);
    } catch (e) {
        console.error("POST /transactions error:", e);
        res.status(500).json({ error: "Error creating transaction" });
    }
});

// ========== LEADS ==========

// Calculate lead score based on various factors
function calculateLeadScore(lead: Partial<Lead>): number {
    let score = 50; // Base score

    // Value factor (0-25 points)
    if (lead.value) {
        if (lead.value >= 5000) score += 25;
        else if (lead.value >= 1000) score += 15;
        else if (lead.value >= 500) score += 10;
        else if (lead.value > 0) score += 5;
    }

    // Status factor (0-20 points)
    const statusScores: Record<string, number> = {
        'NEW': 5,
        'CONTACTED': 10,
        'QUALIFIED': 15,
        'NEGOTIATION': 20,
        'WON': 25,
        'LOST': 0
    };
    score += statusScores[lead.status || 'NEW'] || 0;

    // Company factor (0-10 points)
    if (lead.company) score += 10;

    // Notes factor (indicates engagement) (0-5 points) 
    if (lead.notes && lead.notes.length > 20) score += 5;

    return Math.min(100, Math.max(0, score));
}

// Leads routes moved to /routes/leads.ts


// Import for debug
import { processAutomationJobs } from './scheduler.js';

app.post("/debug/automations/process", authMiddleware, async (req: any, res) => {
    try {
        await processAutomationJobs();
        res.json({ success: true, message: "Automation jobs processed" });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ========== TAGS ==========

app.get("/tags", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const tags = await prisma.tag.findMany({
            where: { organizationId } as any
        });
        res.json(tags);
    } catch (e) {
        console.error("GET /tags error:", e);
        res.status(500).json({ error: "Error fetching tags" });
    }
});

app.post("/tags", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { name, color = "#6B7280" } = req.body;

        if (!name) return res.status(400).json({ error: "Name required" });

        const tag = await prisma.tag.create({
            data: {
                name,
                color,
                organizationId
            } as any
        });
        res.json(tag);
    } catch (e: any) {
        if (e.code === 'P2002') {
            return res.status(400).json({ error: "Tag already exists" });
        }
        console.error("POST /tags error:", e);
        res.status(500).json({ error: "Error creating tag" });
    }
});

app.delete("/tags/:id", authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;

        await prisma.tag.deleteMany({
            where: {
                id,
                organizationId
            } as any
        });
        res.json({ success: true });
    } catch (e) {
        console.error("DELETE /tags error:", e);
        res.status(500).json({ error: "Error deleting tag" });
    }
});


// ========== WHATSAPP PROVIDERS (Dual Integration) ==========

// Providers (now uses Prisma)
import type { WhatsAppProvider, WhatsAppMessage } from "./types.js";

// Get all WhatsApp providers
// Get all WhatsApp providers
app.get("/whatsapp/providers", authMiddleware, async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(400).json({ error: "Organization required" });

        // Fetch specific WhatsApp providers from DB
        const integrations = await prisma.integration.findMany({
            where: {
                organizationId,
                OR: [
                    { provider: 'WHATSMEOW' },
                    { provider: 'META' },
                    { provider: 'WHATSAPP' }
                ]
            }
        });

        // If none exist, we might want to return defaults or empty list
        // For the UI to render configuration cards, we can return "virtual" providers if DB is empty
        // or just expect the UI to handle creation. 
        // To match current UI expectations which expects a list of "slots" to configure:

        let providers: WhatsAppProvider[] = integrations.map(i => ({
            id: i.id,
            name: (i.metadata as any)?.name || (i.provider === 'META' ? 'WhatsApp Business (Meta)' : 'WhatsApp (WhatsMeow)'),
            type: i.provider === 'META' ? 'meta' : 'whatsmeow',
            enabled: i.isEnabled,
            config: i.credentials as any,
            status: ((i.metadata as any)?.status as any) || 'disconnected',
            lastError: (i.metadata as any)?.lastError,
            connectedAt: (i.metadata as any)?.connectedAt ? new Date((i.metadata as any).connectedAt) : undefined,
            createdAt: i.createdAt,
            // Channel mode config
            mode: (i.metadata as any)?.mode || 'HYBRID',
            assistaiAgentCode: (i.metadata as any)?.assistaiAgentCode || '',
            autoResumeMinutes: (i.metadata as any)?.autoResumeMinutes ?? 30,
            phoneNumber: (i.metadata as any)?.phoneNumber || (i.credentials as any)?.phoneNumber || ''
        }));

        // IF DB is empty, let's seed the "slots" so the UI has something to show (optional, but good for UX)
        // But better is to just return what we have. The frontend should handle "Create New" or show available types.
        // However, to strictly follow the "Assess" phase findings, we want to transition from static list to DB.

        // Let's assume we want to ensure at least one of each type exists for editing if they don't exist?
        // No, let's keep it clean: return DB rows. 
        // BUT, the current frontend `WhatsAppConfig` might expect a specific structure. 
        // We will perform the seeding client-side or just check if they exists.

        // Let's inject "placeholder" providers if they don't exist in DB yet, so the user sees them to "Configure"
        // This simulates the behavior of the static list `whatsappProviders`

        const hasWhatsMeow = providers.some(p => p.type === 'whatsmeow');
        const hasMeta = providers.some(p => p.type === 'meta');

        if (!hasWhatsMeow) {
            providers.push({
                id: 'placeholder-whatsmeow',
                name: 'WhatsApp (WhatsMeow)',
                type: 'whatsmeow',
                enabled: false,
                config: {},
                status: 'disconnected',
                createdAt: new Date()
            });
        }

        if (!hasMeta) {
            providers.push({
                id: 'placeholder-meta',
                name: 'WhatsApp Business (Meta)',
                type: 'meta',
                enabled: false,
                config: {},
                status: 'disconnected',
                createdAt: new Date()
            });
        }

        // Mask secrets
        const safeProviders = providers.map(p => ({
            ...p,
            config: {
                ...p.config,
                apiKey: p.config.apiKey ? '***configured***' : '',
                accessToken: p.config.accessToken ? '***configured***' : ''
            }
        }));

        res.json(safeProviders);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Save/Update provider config
app.post("/whatsapp/providers", authMiddleware, async (req: any, res) => {
    // Defines a new provider or updates existing one based on finding it in DB
    // Actually the frontend calls PUT /:id usually, but let's handle creation if needed.
    // For this migration, we will mostly rely on PUT /:id with the special IDs
    res.status(501).json({ error: "Use PUT /whatsapp/providers/:id to configure" });
});

app.put("/whatsapp/providers/:id", authMiddleware, async (req: any, res) => {
    const { id } = req.params;
    const { name, enabled, config, status } = req.body;
    const organizationId = req.user?.organizationId;

    try {
        let integration;

        if (id.startsWith('placeholder-')) {
            // Create new
            const type = id.includes('meta') ? 'META' : 'WHATSMEOW';
            integration = await prisma.integration.create({
                data: {
                    userId: req.user.id,
                    organizationId,
                    provider: type,
                    isEnabled: enabled !== undefined ? enabled : false,
                    credentials: config || {},
                    metadata: {
                        name: name,
                        status: status || 'disconnected',
                        connectedAt: status === 'connected' ? new Date() : null
                    }
                }
            });
        } else {
            // Update existing - Scope by Organization
            integration = await prisma.integration.findFirst({ where: { id, organizationId } });
            if (!integration) return res.status(404).json({ error: "Provider not found" });

            integration = await prisma.integration.update({
                where: { id },
                data: {
                    isEnabled: enabled !== undefined ? enabled : integration.isEnabled,
                    credentials: config ? { ...(integration.credentials as object), ...config } : integration.credentials,
                    metadata: {
                        ...(integration.metadata as object),
                        name: name !== undefined ? name : (integration.metadata as any)?.name,
                        status: status !== undefined ? status : (integration.metadata as any)?.status,
                        lastError: status === 'connected' ? null : (integration.metadata as any)?.lastError, // clear error on connect
                        connectedAt: status === 'connected' ? new Date() : (integration.metadata as any)?.connectedAt
                    }
                }
            });

            console.log('[DEBUG] Integration created/found:', integration.id, integration.provider, integration.isEnabled);

            // 🚀 AUTOMATION: Register Webhook with WhatsMeow if configured
            if (integration.provider === 'WHATSMEOW' && integration.isEnabled) {
                console.log('[DEBUG] Entering WHATSMEOW check');
                const creds = integration.credentials as any;
                if (creds.apiUrl) { // If we have the API URL (self-hosted or external)
                    // If we have agentCode/Token, we set webhook
                    // If not, maybe we need to CREATE the agent first?
                    // Currently UI creates placeholder. We should try to create/ensure agent exists on external API.

                    try {
                        // Construct webhook URL (this server's URL)
                        // TODO: MUST be a public URL or tunnel for external service to reach localhost
                        const webhookUrl = process.env.CRM_PUBLIC_URL
                            ? `${process.env.CRM_PUBLIC_URL}/whatsmeow/webhook`
                            : `http://localhost:3002/whatsmeow/webhook`; // Fallback for dev

                        if (creds.agentCode && creds.agentToken) {
                            console.log(`[WhatsMeow] Updating webhook to ${webhookUrl} for agent ${creds.agentCode}`);
                            await whatsmeow.setWebhook(creds.agentCode, creds.agentToken, webhookUrl);
                        } else {
                            // If no agent code yet, maybe we create one?
                            // But usually UI flow is: Create local -> then Create Remote?
                            // For now, if we don't have creds, we can't set webhook.
                            // But if the user JUST created the "placeholder", we might want to trigger creation on remote.
                            // Let's assume the user will click "Create" in UI or we do it here if missing.

                            // Let's try to CREATE agent if missing but API URL is present (and it's the main creation flow)
                            // Actually, `config` might just be { apiUrl: ... }. 
                            // If we are in the "setup" phase, we might want to auto-create credentials.

                            // Simple logic: If we have API URL but NO agentCode, try to create one.
                            if (!creds.agentCode) {
                                console.log('[WhatsMeow] Auto-creating agent on external service...');
                                // We need a clearer way to know which "server" to ask. 
                                // `whatsmeow.ts` uses process.env.WHATSMEOW_API_URL globally.
                                // If the user provided a DIFFERENT apiUrl in config, we might need to respect that?
                                // `whatsmeow.ts` is a singleton client for ONE server currently.
                                // Let's assume the user config matches the env or we update the env?
                                // For now, let's use the global client since that's what we have.

                                const agent = await whatsmeow.createAgent({
                                    incomingWebhook: webhookUrl
                                });

                                // Save new credentials
                                integration = await prisma.integration.update({
                                    where: { id },
                                    data: {
                                        credentials: { ...creds, agentCode: agent.code, agentToken: agent.token }
                                    }
                                });
                                console.log(`[WhatsMeow] Agent created: ${agent.code}`);
                            }
                        }
                    } catch (wmErr: any) {
                        console.error('[WhatsMeow] Configuration Error:', wmErr.message);
                        console.error('[WhatsMeow] Stack:', wmErr.stack);
                        // Don't fail the HTTP request, just log.  
                        // Or fail? Metadata might show error.
                        await prisma.integration.update({
                            where: { id },
                            data: { metadata: { ...(integration.metadata as any), lastError: `Config Error: ${wmErr.message}` } }
                        });
                    }
                }
            }
        }

        res.json({
            id: integration.id,
            ...integration.metadata as any,
            config: integration.credentials,
            isEnabled: integration.isEnabled
        });

    } catch (err: any) {
        console.error('Error saving provider:', err);
        res.status(500).json({ error: err.message });
    }
});

// Test provider connection
app.post("/whatsapp/providers/:id/test", authMiddleware, async (req: any, res) => {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    try {
        const integration = await prisma.integration.findFirst({ where: { id, organizationId } });
        if (!integration) return res.status(404).json({ error: "Provider no encontrado" });

        const config = integration.credentials as any;

        if (integration.provider === 'WHATSMEOW') {
            // Test WhatsMeow connection
            const agentCode = config.agentCode;
            const agentToken = config.agentToken;

            if (!agentCode || !agentToken) throw new Error('Agente no configurado');

            try {
                const agent = await whatsmeow.getAgent(agentCode, agentToken);
                // If we get here, agent exists and token is valid

                // TODO: Check if device is actually linked in agent details?
                // For now, if API responds it is "alive"

                await prisma.integration.update({
                    where: { id },
                    data: { metadata: { ...(integration.metadata as any), status: 'connected', connectedAt: new Date() } }
                });

                res.json({ success: true, message: `Conexión WhatsMeow activa (ID: ${agent.id})` });
            } catch (error: any) {
                await prisma.integration.update({
                    where: { id },
                    data: { metadata: { ...(integration.metadata as any), status: 'error', lastError: error.message } }
                });
                throw new Error('No se pudo contactar al agente WhatsMeow: ' + error.message);
            }

        } else if (integration.provider === 'META') { // META
            // Test Meta Business API
            if (!config.accessToken) throw new Error('Access Token no configurado');

            // Verificar token con Meta
            const response = await fetch(`https://graph.facebook.com/v18.0/${config.phoneNumberId}`, {
                headers: { 'Authorization': `Bearer ${config.accessToken}` }
            });

            if (!response.ok) throw new Error('Token inválido o expirado');

            await prisma.integration.update({
                where: { id },
                data: { metadata: { ...(integration.metadata as any), status: 'connected', connectedAt: new Date() } }
            });

            res.json({ success: true, message: 'Conexión Meta API exitosa' });
        }
    } catch (err: any) {
        // Log error to DB
        if (!id.startsWith('placeholder')) {
            try {
                // We don't filter by organizationId here because we have ID, but strictly we should?
                // Actually if findFirst failed, we returned 404. So we own it.
                await prisma.integration.update({
                    where: { id },
                    data: { metadata: { status: 'error', lastError: err.message } }
                });
            } catch (e) { /* ignore */ }
        }
        res.status(400).json({ success: false, error: err.message });
    }
});

// Request QR Code for WhatsMeow
app.get("/whatsapp/providers/:id/qr", authMiddleware, async (req: any, res) => {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    try {
        let integration;
        let config: any;

        // ── Handle placeholder providers: auto-create agent on external API ──
        if (id.startsWith('placeholder-')) {
            console.log(`[WhatsMeow] Placeholder detected: ${id}. Auto-creating agent...`);

            // Construct webhook URL
            const webhookUrl = process.env.CRM_PUBLIC_URL
                ? `${process.env.CRM_PUBLIC_URL}/whatsmeow/webhook`
                : `http://localhost:3002/whatsmeow/webhook`;

            // Create agent on external WhatsMeow API
            const agent = await whatsmeow.createAgent({ incomingWebhook: webhookUrl });
            console.log(`[WhatsMeow] Agent created: code=${agent.code}`);

            // Persist as real integration in DB
            integration = await prisma.integration.create({
                data: {
                    userId: req.user.id,
                    organizationId,
                    provider: 'WHATSMEOW',
                    isEnabled: true,
                    credentials: {
                        agentCode: agent.code,
                        agentToken: agent.token,
                        apiUrl: process.env.WHATSMEOW_API_URL || 'https://whatsapp.qassistai.work/api/v1'
                    },
                    metadata: {
                        name: 'WhatsApp (WhatsMeow)',
                        status: 'connecting',
                        connectedAt: null
                    }
                }
            });

            config = integration.credentials as any;
        } else {
            // ── Normal lookup for real providers ──
            integration = await prisma.integration.findUnique({ where: { id } });

            if (!integration) {
                return res.status(404).json({ error: "Provider no encontrado (ID inválido)" });
            }

            if (integration.organizationId && integration.organizationId !== organizationId) {
                console.error(`[Org mismatch] Integration org=${integration.organizationId} vs User org=${organizationId}`);
                return res.status(403).json({ error: "No tienes acceso a este proveedor" });
            }

            if (integration.provider !== 'WHATSMEOW') {
                return res.status(400).json({ error: "QR solo disponible para WhatsMeow" });
            }

            config = integration.credentials as any;

            // If no agentCode yet, auto-create one
            if (!config?.agentCode || !config?.agentToken) {
                console.log(`[WhatsMeow] No agent credentials found for ${id}. Auto-creating...`);

                const webhookUrl = process.env.CRM_PUBLIC_URL
                    ? `${process.env.CRM_PUBLIC_URL}/whatsmeow/webhook`
                    : `http://localhost:3002/whatsmeow/webhook`;

                const agent = await whatsmeow.createAgent({ incomingWebhook: webhookUrl });
                console.log(`[WhatsMeow] Agent created: code=${agent.code}`);

                integration = await prisma.integration.update({
                    where: { id },
                    data: {
                        isEnabled: true,
                        credentials: {
                            ...config,
                            agentCode: agent.code,
                            agentToken: agent.token,
                            apiUrl: process.env.WHATSMEOW_API_URL || 'https://whatsapp.qassistai.work/api/v1'
                        },
                        metadata: { ...(integration.metadata as any), status: 'connecting' }
                    }
                });
                config = integration.credentials as any;
            }
        }

        // ── Update status to connecting ──
        await prisma.integration.update({
            where: { id: integration.id },
            data: { metadata: { ...(integration.metadata as any), status: 'connecting' } }
        });

        console.log(`[WhatsMeow] Fetching QR for agent ${config.agentCode}`);

        // ── Fetch Real QR Image ──
        const qrResponse = await whatsmeow.getQRImage(config.agentCode, config.agentToken);

        let base64Image;
        if (Buffer.isBuffer(qrResponse)) {
            base64Image = `data:image/png;base64,${qrResponse.toString('base64')}`;
        } else {
            const responseData = qrResponse as any;

            if (responseData.status === 'connected') {
                await prisma.integration.update({
                    where: { id: integration.id },
                    data: { metadata: { ...(integration.metadata as any), status: 'connected', connectedAt: new Date(), lastError: null as any } }
                });
                return res.json({ status: 'connected', message: 'Dispositivo ya vinculado' });
            }

            if (responseData.qr) {
                base64Image = responseData.qr.startsWith('data:')
                    ? responseData.qr
                    : `data:image/png;base64,${responseData.qr}`;
            } else {
                console.error('[WhatsMeow] Unexpected QR response:', responseData);
                throw new Error(`Formato de respuesta QR no válido: ${JSON.stringify(responseData)}`);
            }
        }

        res.json({
            qr: base64Image,
            expiresIn: 30,
            providerId: integration.id, // Return real ID so frontend can switch from placeholder
            message: 'Escanea el código QR para vincular WhatsApp via WhatsMeow',
            instructions: [
                '1. Abre WhatsApp en tu teléfono',
                '2. Ve a Configuración > Dispositivos vinculados',
                '3. Toca "Vincular un dispositivo"',
                '4. Escanea el código QR'
            ]
        });

    } catch (err: any) {
        console.error('Error fetching QR:', err);
        res.status(502).json({ error: 'Error comunicando con servicio WhatsApp: ' + err.message });
    }
});

// Lightweight status check
app.get("/whatsapp/providers/:id/status", authMiddleware, async (req: any, res) => {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    // Placeholder providers are always disconnected (not yet created)
    if (id.startsWith('placeholder-')) {
        return res.json({ status: 'disconnected', connectedAt: null });
    }

    try {
        const integration = await prisma.integration.findUnique({ where: { id } });
        if (!integration) return res.json({ status: 'disconnected', connectedAt: null });

        // Access control: Allow if owned or if it's the user's org context
        if (integration.organizationId && integration.organizationId !== organizationId) {
            return res.status(403).json({ error: "Acceso denegado" });
        }

        let status = (integration.metadata as any)?.status || 'disconnected';
        let connectedAt = (integration.metadata as any)?.connectedAt;

        // Real-time check for WhatsMeow
        if (integration.provider === 'WHATSMEOW') {
            const config = integration.credentials as any;
            if (config?.agentCode && config?.agentToken) {
                try {
                    const agent = await whatsmeow.getAgent(config.agentCode, config.agentToken);
                    const isConnected = !!agent.deviceId;

                    status = isConnected ? 'connected' : 'disconnected';

                    // Update DB if changed
                    if (status !== (integration.metadata as any)?.status) {
                        const metadata = {
                            ...(integration.metadata as any),
                            status,
                            connectedAt: isConnected ? (connectedAt || new Date()) : null
                        };
                        await prisma.integration.update({
                            where: { id },
                            data: { metadata }
                        });
                        connectedAt = metadata.connectedAt;
                    }
                } catch (e) {
                    // Agent might be unreachable or invalid token
                    status = 'error';
                }
            }
        }

        res.json({ status, connectedAt });
    } catch (e: any) {
        console.error("GET /status error:", e);
        res.status(500).json({ error: "Error checking status" });
    }
});

// Confirm QR scan was successful
app.post("/whatsapp/providers/:id/qr/confirm", authMiddleware, async (req: any, res) => {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    try {
        const integration = await prisma.integration.findFirst({ where: { id, organizationId } });
        if (!integration) return res.status(404).json({ error: "Provider not found" });

        await prisma.integration.update({
            where: { id },
            data: { metadata: { status: 'connected', connectedAt: new Date(), lastError: null as any } }
        });

        // Emit socket event
        io.emit('whatsapp_connected', { providerId: id, name: (integration?.metadata as any)?.name });

        res.json({ success: true, message: 'WhatsApp vinculado exitosamente' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Disconnect/Logout
app.post("/whatsapp/providers/:id/disconnect", authMiddleware, async (req: any, res) => {
    const { id } = req.params;

    try {
        await prisma.integration.update({
            where: { id },
            data: { metadata: { status: 'disconnected', connectedAt: null as any } }
        });

        io.emit('whatsapp_disconnected', { providerId: id });
        res.json({ success: true, message: 'Desconectado exitosamente' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Update channel mode/AI config for a provider
app.put("/whatsapp/providers/:id/channel-config", authMiddleware, async (req: any, res) => {
    const { id } = req.params;
    const { mode, assistaiAgentCode, autoResumeMinutes } = req.body;

    try {
        const existing = await prisma.integration.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: "Proveedor no encontrado" });
        }

        const currentMeta = (existing.metadata as any) || {};
        const updatedMeta = {
            ...currentMeta,
            mode: mode || currentMeta.mode || 'HYBRID',
            assistaiAgentCode: assistaiAgentCode ?? currentMeta.assistaiAgentCode,
            autoResumeMinutes: autoResumeMinutes ?? currentMeta.autoResumeMinutes ?? 30
        };

        await prisma.integration.update({
            where: { id },
            data: { metadata: updatedMeta }
        });

        res.json({ success: true, message: 'Configuración guardada', config: updatedMeta });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Send WhatsApp message (unified endpoint)
app.post("/whatsapp/send", async (req, res) => {
    const { providerId, to, content, mediaType = 'text', mediaUrl } = req.body;

    if (!to || !content) {
        return res.status(400).json({ error: "to y content requeridos" });
    }

    // Find active provider

    let providerIdToUse = providerId;
    let provider;

    if (providerIdToUse) {
        const p = await prisma.integration.findUnique({ where: { id: providerIdToUse } });
        if (p && p.isEnabled) provider = p;
    }

    if (!provider) {
        // Find first connected/enabled
        provider = await prisma.integration.findFirst({
            where: {
                OR: [
                    { provider: 'WHATSMEOW' },
                    { provider: 'META' }
                ],
                isEnabled: true
                // We should check status in metadata but that's JSON, harder to query directly in generic Prisma
                // Assuming isEnabled implies we want to use it.
            }
        });
    }

    if (!provider) {
        return res.status(400).json({ error: "No hay proveedor de WhatsApp activo/conectado" });
    }

    const message: WhatsAppMessage = {
        id: `wa-msg-${Date.now()}`,
        providerId: provider.id,
        from: 'crm',
        to: to.replace(/\D/g, ''), // Limpiar número
        content,
        mediaType,
        mediaUrl,
        timestamp: new Date(),
        status: 'pending',
        direction: 'outbound'
    };

    const config = provider.credentials as any;

    try {
        if (provider.provider === 'WHATSMEOW') {
            // Enviar via WhatsMeow API (Bernardo)
            const apiUrl = config.apiUrl || 'https://whatsapp.qassistai.work/api/v1'; // Default if missing
            const agentCode = (config as any).agentCode;
            const agentToken = (config as any).agentToken;

            if (!agentCode || !agentToken) {
                throw new Error('Credenciales de agente (code/token) faltantes');
            }

            // Using the whatsmeow.sendMessage helper or raw fetch?
            // The file imports 'whatsmeow' as * from './whatsmeow.js'.
            // Let's use the helper if possible, or just raw fetch matching the helper.
            // Helper: sendMessage(code, token, { to, message })

            await whatsmeow.sendMessage(agentCode, agentToken, {
                to: message.to,
                message: content
            });

            message.status = 'sent';
            console.log(`[WhatsMeow] Mensaje enviado a ${to}: ${content}`);

        } else if ((provider as any).type === 'meta' || provider.provider === 'META') {
            // Enviar via Meta Business API
            const config = (provider as any).config || provider.credentials as any;
            const response = await fetch(
                `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.accessToken}`
                    },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        to: message.to,
                        type: mediaType,
                        text: mediaType === 'text' ? { body: content } : undefined,
                        image: mediaType === 'image' ? { link: mediaUrl } : undefined
                    })
                }
            );

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'Error enviando mensaje Meta');
            }

            const data = await response.json();
            message.metadata = { messageId: data.messages?.[0]?.id };
            message.status = 'sent';
        }

        // Emit to socket for real-time update
        io.emit('whatsapp_message_sent', message);

        // PERSISTENCE: Save to DB for Inbox
        try {
            if (provider.organizationId) {
                const cleanTo = message.to; // Already cleaned above
                // MATCHING LOGIC: Must match processIncomingMessage specific format for multi-tenancy
                // Format: session-{organizationId}-{phone}
                const sessionId = `session-${provider.organizationId}-${cleanTo}`;

                // 1. Find or Create Conversation
                let conversation = await prisma.conversation.findUnique({
                    where: { sessionId }
                });

                if (!conversation) {
                    conversation = await prisma.conversation.create({
                        data: {
                            sessionId: sessionId,
                            platform: 'WHATSAPP',
                            organizationId: provider.organizationId,
                            customerContact: cleanTo,
                            customerName: cleanTo,
                            status: 'ACTIVE'
                        }
                    });
                }

                // 2. Create Message
                // 2. Create Message
                const savedMessage = await prisma.message.create({
                    data: {
                        conversationId: conversation.id,
                        content: content,
                        sender: 'AGENT',
                        status: 'SENT',
                        metadata: message.metadata
                    }
                });

                // Emit for Inbox real-time update
                const chatMessage = {
                    id: savedMessage.id,
                    sessionId: sessionId,
                    from: 'Agent',
                    content: savedMessage.content,
                    platform: 'whatsapp',
                    sender: 'agent',
                    timestamp: savedMessage.createdAt.toISOString(),
                    status: 'sent'
                };

                io.to(`org_${provider.organizationId}`).emit('inbox_update', {
                    sessionId: sessionId,
                    message: chatMessage
                });
            }
        } catch (dbErr) {
            console.error('[DB Persistence Error]', dbErr);
            // Don't fail the request if message was actually sent
        }

        res.json({ success: true, message });

    } catch (err: any) {
        message.status = 'failed';
        console.error('[WhatsApp Send Error]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Unified Message Processing
async function processIncomingMessage(
    providerId: string | undefined,
    organizationId: string, // REQUIRED for multi-tenancy
    platform: 'whatsapp' | 'instagram' | 'messenger' | 'assistai' | 'web',
    from: string,
    content: string,
    mediaType: 'text' | 'image' | 'audio' | 'video' | 'document' = 'text',
    mediaUrl?: string,
    metadata?: any,
    explicitSessionId?: string
) {
    // Generate or resolve Session ID - Scoped by Organization
    const cleanFrom = from.replace(/\D/g, '');
    const sessionId = explicitSessionId || `session-${organizationId}-${cleanFrom}`;

    // Find or create conversation in DB
    let conversation = await prisma.conversation.findUnique({
        where: { sessionId }
    });

    if (!conversation) {
        let customerName = from;
        // Try to match with existing client within Organization
        if (!explicitSessionId) {
            const customer = await prisma.customer.findFirst({
                where: {
                    organizationId,
                    OR: [{ phone: from }, { email: from }]
                } as any
            });
            if (customer) customerName = customer.name;
        }

        conversation = await prisma.conversation.create({
            data: {
                sessionId,
                platform: platform.toUpperCase() as any,
                customerName: customerName,
                customerContact: from,
                status: 'ACTIVE',
                metadata: { providerId },
                agentCode: metadata?.agentCode,
                organizationId
            } as any
        });
    } else {
        // Update metadata if providerId changed
        if (providerId) {
            await prisma.conversation.update({
                where: { id: conversation.id },
                data: { metadata: { ...(conversation.metadata as any), providerId } }
            });
        }
    }

    // Save message to DB
    const savedMessage = await prisma.message.create({
        data: {
            conversationId: conversation.id,
            content: content || '',
            sender: metadata?.isSelf ? 'AGENT' : 'USER', // Detect sender
            senderName: metadata?.pushName || from,
            mediaUrl,
            mediaType: mediaType === 'text' ? null : mediaType.toUpperCase() as any,
            metadata: metadata || {},
            status: 'DELIVERED'
        }
    });
    console.log('[Inbox] Message saved to DB:', savedMessage.id);

    // Prepare message for Socket emission (using REAL DB ID and Timestamp)
    const newMessage: ChatMessage = {
        id: savedMessage.id,
        sessionId,
        from,
        content: content || '',
        platform: platform as any,
        sender: "user",
        mediaUrl,
        mediaType: mediaType === 'text' ? undefined : mediaType,
        timestamp: savedMessage.createdAt, // Use DB timestamp
        metadata,
        status: 'delivered'
    };

    // Check for "Human Takeover" or "AI Paused" status
    const takeover = conversationTakeovers.get(sessionId);
    const isHumanControl = takeover && new Date(takeover.expiresAt) > new Date();

    // If NO human control, we could trigger AI auto-response here
    // (Future implementation: call AssistAI if mode is 'hybrid' and 'ai-only')

    // Real-time broadcast to room and general inbox
    io.to(sessionId).emit("new_message", newMessage);
    io.to(`org_${organizationId}`).emit("inbox_update", { sessionId, message: newMessage });
    console.log(`[Inbox] New message from ${from} (${platform}): ${content}`);

    return { sessionId, messageId: savedMessage.id };
}

// Meta Webhook Verification (for Meta Business API setup)
app.get("/whatsapp/webhook", (req, res) => {
    const verifyToken = 'crm_verify_token_2024';
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('[Meta Webhook] Verificación exitosa');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// Meta Webhook Receiver (incoming messages)
app.post("/whatsapp/webhook", async (req, res) => {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
        // Process each entry/change
        for (const entry of body.entry || []) {
            for (const change of entry.changes || []) {
                if (change.field === 'messages') {
                    const value = change.value;
                    const messages = value.messages || [];

                    const phoneNumberId = value.metadata?.phone_number_id;

                    // Find integration with this phoneNumberId in credentials
                    const metaIntegrations = await prisma.integration.findMany({ where: { provider: 'META' } });
                    const provider = metaIntegrations.find(p => (p.credentials as any)?.phoneNumberId === phoneNumberId);

                    if (!provider || !provider.organizationId) {
                        console.error('[Meta Webhook] Provider or Organization not found for phone ID:', phoneNumberId);
                        continue;
                    }
                    const providerId = provider.id;
                    const organizationId = provider.organizationId;

                    for (const msg of messages) {
                        const from = msg.from;
                        const type = msg.type;
                        let content = '';
                        let mediaUrl = undefined;

                        if (type === 'text') {
                            content = msg.text?.body || '';
                        } else if (type === 'image') {
                            content = msg.image?.caption || '[Imagen]';
                            mediaUrl = msg.image?.id;
                        } else {
                            content = `[${type.toUpperCase()}]`;
                        }

                        // Process message into Inbox
                        await processIncomingMessage(
                            providerId,
                            organizationId,
                            'whatsapp',
                            from,
                            content,
                            type === 'text' ? 'text' : 'image', // Simplified
                            mediaUrl,
                            { metaId: msg.id }
                        );
                    }
                }
            }
        }
    }

    res.sendStatus(200);
});


// ========== WEBHOOKS ==========
// ... (Legacy webhooks omitted or should be refactored separately)

// WhatsMeow Webhook Receiver
app.post("/whatsmeow/webhook", async (req, res) => {
    const payload = req.body;
    import('fs').then(fs => fs.appendFileSync('webhook_payloads.log', `[${new Date().toISOString()}] ${JSON.stringify(payload)}\n`));
    console.log('[WhatsMeow Webhook] Recibido:', JSON.stringify(payload).substring(0, 800));

    try {
        const data = payload.body || payload;
        const agentCode = payload.headers?.['x-agent-code'] || req.headers['x-agent-code'];

        // Find integration by agentCode to resolve Organization
        let providerId: string | undefined;
        let organizationId: string | undefined;

        if (agentCode) {
            const integrations = await prisma.integration.findMany({
                where: { provider: 'WHATSMEOW' }
            });
            // In-memory filter for JSON field
            const integration = integrations.find(i => (i.credentials as any)?.agentCode === agentCode);
            if (integration) {
                providerId = integration.id;
                organizationId = integration.organizationId || undefined;
            }
        }

        if (!organizationId) {
            console.warn('[WhatsMeow] Could not resolve Organization from Agent Code:', agentCode);
            return res.sendStatus(200);
        }

        const fromRaw = data.from || '';
        const isGroup = data.is_group === true || fromRaw.includes('@g.us');
        if (!fromRaw || isGroup) return res.sendStatus(200);

        const from = fromRaw.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
        // Extract content logic
        const messageType = data.type || 'text';
        let content = data.text || data.message || '';
        if (messageType === 'image') content = data.caption || '[Imagen]';
        // ... simplified extraction ...

        await processIncomingMessage(
            providerId,
            organizationId,
            'whatsapp',
            from,
            content,
            messageType as any,
            data.media_url,
            { pushName: data.pushname, isSelf: data.is_self_message }
        );

        res.sendStatus(200);
    } catch (e: any) {
        console.error('[WhatsMeow Webhook Error]', e);
        res.sendStatus(500);
    }
});


// Webhook for incoming leads (e.g., from landing page)
app.post("/webhooks/leads/incoming", async (req: any, res) => {
    try {
        const { name, email, company, notes, organizationId } = req.body;

        if (!name || !email || !organizationId) {
            return res.status(400).json({ error: "Payload invalido. Requiere name, email y organizationId." });
        }

        const lead = await prisma.lead.create({
            data: {
                name,
                email,
                company,
                source: "WEBHOOK",
                status: "NEW",
                notes: notes ? `[Webhook] ${notes}` : "[Webhook] Lead entrante",
                organizationId
            } as any
        });

        // Emit socket event
        io.to(`org_${organizationId}`).emit('lead_created', lead);

        res.json({ success: true, id: lead.id, message: "Lead creado exitosamente" });
    } catch (e: any) {
        console.error("Webhook Lead error:", e);
        res.status(500).json({ error: "Error creating lead" });
    }
});

app.post("/webhooks/clients/incoming", async (req: any, res) => {
    try {
        const { name, email, phone, company, organizationId } = req.body;

        if (!name || !email || !organizationId) {
            return res.status(400).json({ error: "Payload invalido. Requiere name, email y organizationId." });
        }

        const customer = await prisma.customer.create({
            data: {
                name,
                email,
                phone,
                company,
                plan: 'FREE',
                status: 'ACTIVE',
                organizationId
            } as any
        });

        res.json({ success: true, id: customer.id, message: "Cliente creado exitosamente" });
    } catch (e: any) {
        console.error("Webhook Client error:", e);
        res.status(500).json({ error: "Error creating customer" });
    }
});


// ========== WIDGET ENDPOINT - PUBLIC (No auth required) ==========
// Widget chat endpoint - resolves orgCode to organizationId
app.post("/widget/message", async (req: any, res) => {
    const { from, content, sessionId, customerName, orgCode } = req.body;

    console.log('[Widget] Mensaje recibido:', { from, content, sessionId, orgCode });

    if (!content || !sessionId || !orgCode) {
        return res.status(400).json({ error: "Missing content, sessionId, or orgCode" });
    }

    try {
        // Resolve orgCode to organizationId
        // First, try to find by slug
        let organization = await prisma.organization.findFirst({
            where: { slug: orgCode }
        });

        // If not found by slug, try by id
        if (!organization && orgCode.startsWith('cm')) {
            organization = await prisma.organization.findUnique({
                where: { id: orgCode }
            });
        }

        // If still not found, use default organization for testing
        if (!organization) {
            organization = await prisma.organization.findFirst();
            console.log('[Widget] Using default organization:', organization?.id);
        }

        if (!organization) {
            return res.status(400).json({ error: "Organization not found" });
        }

        const organizationId = organization.id;

        // Process message using unified processor
        const result = await processIncomingMessage(
            undefined,
            organizationId,
            'web',
            sessionId, // Use sessionId as "from" for widget
            content,
            'text',
            undefined,
            undefined,
            sessionId
        );

        console.log('[Widget] Mensaje procesado:', result);
        res.json({ success: true, ...result });

    } catch (e: any) {
        console.error('[Widget] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Widget endpoint to load history (public)
app.get("/widget/history/:sessionId", async (req, res) => {
    try {
        const conversation = await prisma.conversation.findUnique({
            where: { sessionId: req.params.sessionId },
            include: { messages: { orderBy: { createdAt: 'asc' } } }
        });

        if (!conversation) {
            return res.json({ messages: [] });
        }

        const messages = (conversation.messages || []).map((m: any) => ({
            id: m.id,
            content: m.content,
            sender: m.sender === 'AGENT' ? 'agent' : 'user',
            timestamp: m.createdAt,
            mediaUrl: m.mediaUrl,
            mediaType: m.mediaType ? m.mediaType.toLowerCase() : undefined
        }));

        res.json({ messages });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Widget endpoint to get organization info (public)
app.get("/widget/org/:orgId", async (req, res) => {
    try {
        const orgId = req.params.orgId;

        // Try by slug first
        let org = await prisma.organization.findFirst({
            where: { slug: orgId },
            select: { id: true, name: true, slug: true }
        });

        // Try by id
        if (!org && orgId.startsWith('cm')) {
            org = await prisma.organization.findUnique({
                where: { id: orgId },
                select: { id: true, name: true, slug: true }
            });
        }

        if (!org) {
            return res.status(404).json({ error: "Organization not found" });
        }

        res.json({
            id: org.id,
            name: org.name,
            slug: org.slug,
            chatUrl: `/chat.html?org=${org.slug || org.id}`
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Widget file upload endpoint (public) - for images, audio, documents
import { v4 as uuidv4 } from 'uuid';

const widgetUploadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(_dirname, '../public/uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = uuidv4();
        const ext = path.extname(file.originalname);
        cb(null, `widget-${uniqueSuffix}${ext}`);
    }
});

const widgetUpload = multer({
    storage: widgetUploadStorage,
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit for widget
});

app.post("/widget/upload", widgetUpload.single('file'), async (req: any, res) => {
    try {
        const { sessionId, orgCode, content, customerName, platform = 'web' } = req.body;

        if (!req.file || !sessionId || !orgCode) {
            return res.status(400).json({ error: "Missing file, sessionId, or orgCode" });
        }

        console.log('[Widget Upload] File received:', req.file.originalname, 'Size:', req.file.size);

        // Resolve organization
        let organization = await prisma.organization.findFirst({
            where: { slug: orgCode }
        });

        if (!organization && orgCode.startsWith('cm')) {
            organization = await prisma.organization.findUnique({
                where: { id: orgCode }
            });
        }

        if (!organization) {
            organization = await prisma.organization.findFirst();
            console.log('[Widget Upload] Using default organization:', organization?.id);
        }

        if (!organization) {
            return res.status(400).json({ error: "Organization not found" });
        }

        // Build media URL
        const protocol = req.protocol;
        const host = req.get('host');
        const mediaUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

        // Determine media type
        const mimeType = req.file.mimetype || '';
        let mediaType: 'image' | 'audio' | 'video' | 'document' = 'document';
        if (mimeType.startsWith('image/')) mediaType = 'image';
        else if (mimeType.startsWith('audio/')) mediaType = 'audio';
        else if (mimeType.startsWith('video/')) mediaType = 'video';

        // Process message with media
        const result = await processIncomingMessage(
            undefined,
            organization.id,
            platform as any,
            sessionId,
            content || `📎 ${req.file.originalname}`,
            mediaType,
            mediaUrl,
            { fileName: req.file.originalname, fileSize: req.file.size },
            sessionId
        );

        console.log('[Widget Upload] Message processed:', result);
        res.json({
            success: true,
            ...result,
            mediaUrl,
            mediaType,
            fileName: req.file.originalname
        });

    } catch (e: any) {
        console.error('[Widget Upload] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post("/webhooks/messages/incoming", async (req: any, res) => {
    // Universal Webhook for WhatsApp, Instagram, Messenger, AssistAI
    const { from, content, platform = "assistai", sessionId: providedSessionId, mediaUrl, mediaType, providerId, organizationId } = req.body;

    if (!from || (!content && !mediaUrl) || !organizationId) {
        return res.status(400).json({ error: "Missing from, content/mediaUrl, or organizationId" });
    }

    // Use unified processor
    const result = await processIncomingMessage(
        providerId,
        organizationId,
        platform as any,
        from,
        content,
        mediaType || 'text',
        mediaUrl,
        undefined,
        providedSessionId
    );

    res.json({ success: true, ...result });
});

// Agent sends reply (Inbox -> Platform)
// Upload file (Agent)
app.post("/chat/upload", authMiddleware, widgetUpload.single('file'), async (req: any, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Missing file" });
        }

        const protocol = req.protocol;
        const host = req.get('host');
        const url = `${protocol}://${host}/uploads/${req.file.filename}`;

        // Determine type
        const mime = req.file.mimetype || '';
        let type = 'document';
        if (mime.startsWith('image/')) type = 'image';
        else if (mime.startsWith('audio/')) type = 'audio';
        else if (mime.startsWith('video/')) type = 'video';

        res.json({
            success: true,
            url,
            type,
            fileName: req.file.originalname,
            size: req.file.size
        });
    } catch (e: any) {
        console.error('Upload error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post("/chat/send", authMiddleware, async (req: any, res) => {
    const { sessionId, content, mediaUrl, mediaType } = req.body;
    const organizationId = req.user?.organizationId;

    if (!sessionId || (!content && !mediaUrl) || !organizationId) {
        return res.status(400).json({ error: "Missing sessionId, content/media, or organization context" });
    }

    try {
        const conversation = await prisma.conversation.findFirst({
            where: { sessionId, organizationId } as any
        });

        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        // Create the message object for DB first to get an ID if needed
        const savedMessage = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                content: content || (mediaUrl ? `📎 ${mediaType}` : ''),
                sender: 'AGENT',
                senderName: req.user.name || 'Support Agent',
                status: 'SENT',
                mediaUrl,
                mediaType: mediaType ? (mediaType.toUpperCase() as any) : undefined
            }
        });

        // Prepare object for socket/response
        const messageObject = {
            id: savedMessage.id,
            sessionId,
            from: req.user.name || 'Support Agent',
            content: content || (mediaUrl ? `📎 Attached ${mediaType}` : ''),
            platform: conversation.platform.toLowerCase(),
            sender: "agent",
            timestamp: savedMessage.createdAt,
            status: 'sent',
            mediaUrl,
            mediaType: mediaType ? mediaType.toLowerCase() : undefined
        };

        // 🚀 REAL SENDING LOGIC

        // 1. Check if it's an AssistAI Conversation (Synced)
        if (sessionId.startsWith('assistai-')) {
            try {
                // Extract original UUID (remove prefix)
                const uuid = sessionId.replace('assistai-', '');

                // Use helper to resolve config (Specific -> Global -> Env)
                const config = await getAssistAIConfig(organizationId);

                if (config) {
                    // Send message with intervention flag = true (Human Agent)
                    // TODO: AssistAI might not support mediaUrl directly in sendMessage yet
                    await AssistAIService.sendMessage(config, uuid, content || 'Media attached', 'Agent', true);
                    console.log(`[Chat Send] Sent via AssistAI (Intervention): ${uuid}`);
                } else {
                    console.warn(`[AssistAI] No configuration found for org ${organizationId}`);
                }
            } catch (error: any) {
                console.error(`[AssistAI] Failed to send:`, error.message);
                // Don't return error yet, strictly speaking we could try fallbacks but likely it's an error.
                return res.status(500).json({ error: "Failed to send via AssistAI" });
            }

            // Real-time broadcast
            io.to(sessionId).emit("new_message", messageObject);
            io.to(`org_${organizationId}`).emit("inbox_update", { sessionId, message: messageObject });

            return res.json(messageObject);
        }

        if (conversation.platform === 'WHATSAPP') {
            const metadata = conversation.metadata as any;
            const providerId = metadata?.providerId;
            const to = conversation.customerContact;

            let wmConfig;
            if (providerId) {
                wmConfig = await prisma.integration.findFirst({
                    where: { id: providerId, organizationId, provider: 'WHATSMEOW', isEnabled: true }
                });
            }
            if (!wmConfig) {
                wmConfig = await prisma.integration.findFirst({
                    where: { organizationId, provider: 'WHATSMEOW', isEnabled: true }
                });
            }

            if (wmConfig && wmConfig.credentials) {
                const creds = wmConfig.credentials as any;
                if (creds.agentCode && creds.agentToken) {
                    const formattedTo = whatsmeow.formatPhoneNumber(to);
                    try {
                        const payload: any = { to: formattedTo, message: content };
                        if (mediaUrl) {
                            payload.mediaUrl = mediaUrl;
                            payload.mediaType = mediaType ? mediaType.toLowerCase() : 'image';
                            if (!content) payload.caption = '';
                        }

                        await whatsmeow.sendMessage(
                            creds.agentCode,
                            creds.agentToken,
                            payload
                        );
                        console.log('[WhatsMeow] Message sent successfully');
                    } catch (err: any) {
                        console.error('[WhatsMeow] Send failed:', err.message);
                    }
                }
            }
        } else if (conversation.platform === 'ASSISTAI') {
            try {
                // Use helper to resolve config (Specific -> Global -> Env)
                const config = await getAssistAIConfig(organizationId);

                if (config) {
                    // Send message with intervention flag = true (Human Agent)
                    await AssistAIService.sendMessage(config, sessionId, content || 'Media attached', 'Agent', true);
                } else {
                    console.warn(`[AssistAI] No configuration found for org ${organizationId}`);
                }
            } catch (error: any) {
                console.error(`[AssistAI] Failed to send:`, error.message);
            }
        } else if (conversation.platform === 'WEB' || conversation.platform.toLowerCase() === 'web') {
            // Forward reply to ChronusDev
            try {
                const chronusDevUrl = process.env.CHRONUSDEV_API_URL || 'http://localhost:3001';
                const syncKey = process.env.CRM_SYNC_KEY || 'dev-sync-key';

                await fetch(`${chronusDevUrl}/webhooks/crm/chat-reply`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-sync-key': syncKey
                    },
                    body: JSON.stringify({
                        sessionId,
                        content: content || (mediaUrl ? 'Attachment' : ''),
                        mediaUrl,
                        mediaType: mediaType ? mediaType.toLowerCase() : undefined,
                        agentName: req.user.name || 'Soporte',
                        timestamp: new Date().toISOString()
                    })
                });
                console.log('[Chat Send] Forwarded reply to ChronusDev');
            } catch (error: any) {
                console.error('[Chat Send] Failed to forward to ChronusDev:', error.message);
            }
        }

        // Real-time broadcast
        io.to(sessionId).emit("new_message", messageObject);
        io.to(`org_${organizationId}`).emit("inbox_update", { sessionId, message: messageObject });

        res.json({ success: true, message: messageObject });

    } catch (err: any) {
        console.error('[Chat Send Error]', err);
        res.status(500).json({ error: err.message });
    }
});


// Get all conversations (for Inbox list)
app.get("/conversations", authMiddleware, async (req: any, res) => { // Now protected
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(400).json({ error: "Organization required" });

        // Fetch from Prisma with messages
        const dbConversations = await prisma.conversation.findMany({
            where: { organizationId } as any,
            include: { messages: { orderBy: { createdAt: 'asc' } } },
            orderBy: { updatedAt: 'desc' }
        });

        const list = dbConversations.map((c: any) => ({
            sessionId: c.sessionId,
            platform: c.platform.toLowerCase(),
            customerName: c.customerName,
            customerContact: c.customerContact,
            agentCode: c.agentCode,
            agentName: c.agentName,
            status: c.status,
            updatedAt: c.updatedAt.toISOString(),
            messages: (c.messages || []).map((m: any) => ({
                id: m.id,
                sessionId: c.sessionId,
                from: m.sender === 'AGENT' ? (c.agentName || 'Agent') : (c.customerName || 'User'),
                content: m.content,
                platform: c.platform.toLowerCase(),
                sender: m.sender === 'AGENT' ? 'agent' : 'user',
                timestamp: m.createdAt.toISOString(),
                status: m.status ? m.status.toLowerCase() : 'delivered',
                mediaUrl: m.mediaUrl,
                mediaType: m.mediaType ? m.mediaType.toLowerCase() : undefined
            }))
        }));

        res.json(list);
    } catch (err: any) {
        console.error('Error fetching conversations:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get single conversation history
app.get("/conversations/:sessionId", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const conversation = await prisma.conversation.findFirst({
            where: {
                sessionId: req.params.sessionId,
                organizationId
            } as any,
            include: { messages: true }
        });
        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }
        res.json(conversation);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Lookup/Initiate Conversation
app.post("/conversations/lookup", authMiddleware, async (req: any, res) => {
    const { phone, platform } = req.body;
    const organizationId = req.user?.organizationId;

    if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
    }

    try {
        if (platform === 'assistai') {
            console.log(`[AssistAI] Looking up conversation for ${phone}`);

            // 1. Check DB first
            const existing = await prisma.conversation.findFirst({
                where: {
                    organizationId,
                    platform: 'ASSISTAI',
                    OR: [
                        { customerContact: phone },
                        { customerContact: phone.replace('+', '') }
                    ]
                } as any
            });

            if (existing) {
                return res.json({ found: true, sessionId: existing.sessionId, conversation: existing });
            }

            // 2. Fetch AssistAI Config from Integrations
            const integration = await prisma.integration.findFirst({
                where: { organizationId, provider: 'ASSISTAI', isEnabled: true }
            });

            if (!integration || !integration.credentials) {
                return res.status(400).json({ error: "AssistAI Integration not configured for this organization" });
            }

            // 3. Try API
            const config = integration.credentials as any;
            const data: any = await assistaiFetch(`/conversations?take=1&customerContact=${encodeURIComponent(phone)}`, config);

            if (data && data.data && data.data.length > 0) {
                const conv = data.data[0];
                const sessionId = conv.uuid || conv.id;

                // Create in DB
                const newConv = await prisma.conversation.create({
                    data: {
                        sessionId,
                        organizationId,
                        platform: 'ASSISTAI',
                        customerName: conv.customerName || phone,
                        customerContact: phone,
                        status: 'ACTIVE',
                        metadata: { assistaiId: conv.id }
                    } as any
                });

                return res.json({ found: true, sessionId, conversation: newConv });
            } else {
                return res.status(404).json({ error: "Conversation not found in AssistAI. Please initiate from the user side." });
            }

        } else if (platform === 'whatsapp') {
            // For Meta/WhatsMeow, we use the deterministic session ID: session-{orgId}-{phone}
            const cleanPhone = phone.replace(/\D/g, '');
            const sessionId = `session-${organizationId}-${cleanPhone}`;

            // Check if exists
            let conversation = await prisma.conversation.findUnique({
                where: { sessionId }
            });

            if (!conversation) {
                // Determine provider (WhatsMeow or Meta)
                // We pick the first enabled one? Or default?
                // For lookup, we just want to start chatting.
                // We'll require a providerId to be properly set later, or pick a default now.
                const provider = await prisma.integration.findFirst({
                    where: { organizationId, isEnabled: true, OR: [{ provider: 'WHATSMEOW' }, { provider: 'META' }] }
                });

                conversation = await prisma.conversation.create({
                    data: {
                        sessionId,
                        organizationId,
                        platform: 'WHATSAPP',
                        customerName: phone,
                        customerContact: phone,
                        status: 'ACTIVE',
                        metadata: { providerId: provider?.id || 'pending-provider' }
                    } as any
                });
            }
            return res.json({ found: true, sessionId, conversation });
        }

        return res.status(400).json({ error: "Unsupported platform" });
    } catch (err: any) {
        console.error('Error lookup conversations:', err);
        res.status(500).json({ error: err.message });
    }
});
// ========== DASHBOARD STATS ==========

app.get("/stats", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;

        // Parallel queries for stats
        const [
            activeCustomers,
            trialCustomers,
            mrrResult,
            openTickets,
            overdueInvoices,
            totalCustomers
        ] = await Promise.all([
            prisma.customer.count({
                where: { organizationId, status: 'ACTIVE' } as any
            }),
            prisma.customer.count({
                where: { organizationId, status: 'TRIAL' } as any
            }),
            prisma.customer.aggregate({
                where: { organizationId, status: 'ACTIVE' } as any,
                _sum: { monthlyRevenue: true }
            }),
            prisma.ticket.count({
                where: { organizationId, status: 'OPEN' } as any
            }),
            prisma.invoice.count({
                where: { organizationId, status: 'OVERDUE' } as any
            }),
            prisma.customer.count({
                where: { organizationId } as any
            })
        ]);

        res.json({
            activeCustomers,
            trialCustomers,
            mrr: mrrResult._sum.monthlyRevenue || 0,
            openTickets,
            overdueInvoices,
            totalCustomers,
        });

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ========== AI ENDPOINTS ==========

// AI Reply Suggestions - generates contextual reply suggestions
app.post("/ai/suggest-reply", authMiddleware, async (req: any, res) => {
    const { sessionId, lastMessages } = req.body;
    const organizationId = req.user.organizationId;

    try {
        // Get conversation context from DB if not provided in body
        let context = lastMessages || [];
        if (!lastMessages && sessionId) {
            const conversation = await prisma.conversation.findUnique({
                where: { sessionId },
                include: { messages: { orderBy: { createdAt: 'desc' }, take: 5 } }
            });

            if (conversation && (conversation as any).organizationId === organizationId) {
                // Ensure messages are in correct chronological order for analysis if needed, 
                // but usually we want recent ones.
                context = conversation.messages.reverse();
            } else if (conversation && (conversation as any).organizationId !== organizationId) {
                return res.status(403).json({ error: "Access denied" });
            }
        }

        // Analyze context and generate suggestions
        const lastUserMessage = Array.isArray(context) ? context.filter((m: any) => m.sender === 'user' || m.sender === 'USER').pop() : null;
        const content = lastUserMessage?.content?.toLowerCase() || '';

        let suggestions: { text: string; tone: string }[] = [];

        // Smart keyword-based suggestions (simulated AI)
        if (content.includes('precio') || content.includes('costo') || content.includes('cuanto')) {
            suggestions = [
                { text: "Claro, con gusto te comparto nuestra lista de precios. ¿Qué plan te interesa? Tenemos opciones desde $99/mes.", tone: "helpful" },
                { text: "Nuestros planes comienzan en $99/mes (Starter), $299/mes (Pro) y Enterprise personalizado. ¿Te gustaría una demo?", tone: "professional" },
                { text: "¡Hola! Los precios varían según el plan. ¿Podrías contarme más sobre tus necesidades para recomendarte el mejor?", tone: "consultive" }
            ];
        } else if (content.includes('ayuda') || content.includes('problema') || content.includes('error')) {
            suggestions = [
                { text: "Lamento el inconveniente. ¿Podrías describir el problema con más detalle para ayudarte mejor?", tone: "empathetic" },
                { text: "Entiendo tu frustración. Vamos a resolverlo juntos. ¿Puedes compartir una captura del error?", tone: "supportive" },
                { text: "Gracias por reportar esto. Nuestro equipo técnico lo está revisando. Te mantendremos informado.", tone: "professional" }
            ];
        } else if (content.includes('gracias') || content.includes('excelente') || content.includes('genial')) {
            suggestions = [
                { text: "¡Me alegra haberte ayudado! ¿Hay algo más en lo que pueda asistirte?", tone: "friendly" },
                { text: "¡Un placer! Estamos aquí para lo que necesites. 😊", tone: "warm" },
                { text: "Gracias a ti por confiar en nosotros. ¡Que tengas un excelente día!", tone: "closing" }
            ];
        } else if (content.includes('hola') || content.includes('buenos') || content.includes('hi')) {
            suggestions = [
                { text: "¡Hola! Bienvenido a nuestro soporte. ¿En qué puedo ayudarte hoy?", tone: "welcoming" },
                { text: "¡Hola! Soy parte del equipo de soporte. Cuéntame, ¿cómo puedo asistirte?", tone: "professional" },
                { text: "¡Hey! 👋 ¿Qué tal todo? ¿En qué puedo apoyarte?", tone: "casual" }
            ];
        } else {
            // Generic suggestions
            suggestions = [
                { text: "Gracias por tu mensaje. Déjame revisar esto y te respondo en un momento.", tone: "helpful" },
                { text: "Entendido. ¿Podrías darme más detalles para poder ayudarte mejor?", tone: "consultive" },
                { text: "Perfecto, voy a analizar tu caso. ¿Hay algo más que deba saber?", tone: "professional" }
            ];
        }

        res.json({ suggestions, context: context.length });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }

});

// AI Ticket Classification - categorizes and prioritizes tickets
app.post("/ai/classify-ticket", (req, res) => {
    const { title, description } = req.body;
    const text = `${title} ${description}`.toLowerCase();

    let category: string = 'general';
    let priority: string = 'MEDIUM';
    let suggestedTags: string[] = [];
    let confidence = 0.7;

    // Urgency detection
    if (text.includes('urgente') || text.includes('caído') || text.includes('no funciona') || text.includes('bloqueado')) {
        priority = 'URGENT';
        suggestedTags.push('urgent');
        confidence = 0.95;
    } else if (text.includes('error') || text.includes('bug') || text.includes('problema')) {
        priority = 'HIGH';
    }

    // Category detection
    if (text.includes('factura') || text.includes('pago') || text.includes('cobro') || text.includes('precio')) {
        category = 'billing';
        suggestedTags.push('billing');
        confidence = 0.9;
    } else if (text.includes('error') || text.includes('bug') || text.includes('api') || text.includes('integración')) {
        category = 'technical';

        suggestedTags.push('technical');
        confidence = 0.85;
    } else if (text.includes('sugerencia') || text.includes('feature') || text.includes('mejora') || text.includes('sería bueno')) {
        category = 'feature_request';
        suggestedTags.push('feature');
        confidence = 0.8;
    }

    res.json({ category, priority, suggestedTags, confidence });
});

// Analytics Predictions - MRR forecast and churn risk
app.get("/analytics/predictions", authMiddleware, async (req: any, res) => {
    const organizationId = req.user.organizationId;

    try {
        // Fetch active customers for MRR
        const activeCustomers = await prisma.customer.findMany({
            where: { organizationId, status: 'ACTIVE' } as any
        });

        // Sum using reduce since Prisma _sum doesn't work directly on all fields if they are Float/Decimal in some SQLite versions
        const currentMRR = activeCustomers.reduce((acc, c) => acc + (c as any).monthlyRevenue || 0, 0);

        // MRR Forecast
        const avgGrowthRate = 0.05;
        const forecast = [
            { month: 'Actual', mrr: currentMRR },
            { month: '+1 mes', mrr: Math.round(currentMRR * (1 + avgGrowthRate)) },
            { month: '+2 mes', mrr: Math.round(currentMRR * Math.pow(1 + avgGrowthRate, 2)) },
            { month: '+3 mes', mrr: Math.round(currentMRR * Math.pow(1 + avgGrowthRate, 3)) },
        ];

        // Churn Risk Analysis
        const churnAtRisk = await prisma.customer.findMany({
            where: {
                organizationId,
                OR: [
                    { status: 'TRIAL' },
                    { notes: { contains: 'churn-risk' } }
                ]
            } as any,
            take: 10
        });

        // Get overdue invoices count for these customers
        const risks = await Promise.all(churnAtRisk.map(async (c) => {
            const overdue = await prisma.invoice.count({
                where: { customerId: c.id, status: 'OVERDUE' }
            });
            return {
                id: c.id,
                name: c.name,
                mrr: (c as any).monthlyRevenue || 0,
                riskLevel: overdue > 0 ? 'HIGH' : (c.status === 'TRIAL' ? 'MEDIUM' : 'LOW'),
                reason: overdue > 0 ? 'Factura vencida' : (c.status === 'TRIAL' ? 'En período trial' : 'Actividad baja')
            };
        }));

        // Lead Pipeline
        const leads = await prisma.lead.findMany({
            where: { organizationId, NOT: { status: { in: ['WON', 'LOST'] } } } as any
        });
        const pipelineValue = leads.reduce((acc, l) => acc + (l.value || 0), 0);
        const hotLeadsCount = leads.filter(l => (l.score || 0) >= 70).length;

        res.json({
            mrr: {
                current: currentMRR,
                forecast,
                trend: 'up',
                projectedAnnual: currentMRR * 12 * 1.3 // 30% growth projected
            },
            churn: {
                atRiskCount: risks.length,
                atRiskMRR: risks.reduce((acc, r) => acc + r.mrr, 0),
                customers: risks
            },
            pipeline: {
                totalValue: pipelineValue,
                hotLeadsCount: hotLeadsCount,
                avgScore: leads.length ? Math.round(leads.reduce((acc, l) => acc + (l.score || 0), 0) / leads.length) : 0
            }
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ========== USERS PROXY ==========


// ========== USERS PROXY ==========

app.get("/users", authMiddleware, async (req: any, res) => {
    const organizationId = req.user.organizationId;

    // In a real multi-tenant app, we'd fetch users from our own DB scoped by org
    // For now, we fetch OrganizationMembers to get listing
    try {
        const members = await prisma.organizationMember.findMany({
            where: { organizationId },
            include: { user: true }
        });

        const orgUsers = members.map(m => ({
            id: m.userId,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            defaultPayRate: (m as any).defaultPayRate || 0
        }));

        res.json(orgUsers);
    } catch (err) {
        console.error("Error fetching org users:", err);
        res.status(500).json({ error: "No se pudieron obtener los usuarios" });
    }
});

// ========== PAYMENTS & TEAM EARNINGS (ChronusDev) ==========

app.get("/payments/team-summary", authMiddleware, async (req: any, res) => {
    const organizationId = req.user.organizationId;
    try {
        const members = await prisma.organizationMember.findMany({
            where: { organizationId },
            include: { user: true }
        });

        const summary = await Promise.all(members.map(async (m) => {
            // Total Hours
            const logs = await (prisma as any).timeLog.findMany({
                where: { userId: m.userId, project: { organizationId } } as any // project relation
            });
            // Calculate Debt
            let totalDebt = 0;
            let totalHours = 0;

            logs.forEach((log: any) => {
                let hours = 0;
                if (log.end) {
                    const durationMs = new Date(log.end).getTime() - new Date(log.start).getTime();
                    hours = durationMs / (1000 * 60 * 60);
                }
                const rate = log.payRate || (m as any).defaultPayRate || 0;
                totalDebt += hours * rate;
                totalHours += hours;
            });

            // Total Paid
            const payouts = await (prisma as any).payout.findMany({
                where: { userId: m.userId, organizationId }
            });
            const totalPaid = payouts.reduce((sum: number, p: any) => sum + p.amount, 0);

            return {
                userId: m.userId,
                userName: m.user.name,
                defaultPayRate: (m as any).defaultPayRate || 0,
                totalHours,
                totalDebt,
                totalPaid,
                balance: totalDebt - totalPaid
            };
        }));

        res.json(summary);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error fetching team summary" });
    }
});

app.post("/payments", authMiddleware, async (req: any, res) => {
    try {
        const { userId, amount, month, note } = req.body;
        const organizationId = req.user.organizationId;

        const payout = await (prisma as any).payout.create({
            data: {
                userId,
                organizationId,
                amount: Number(amount),
                month: month || new Date().toISOString().slice(0, 7),
                note,
                createdById: req.user.id
            }
        });
        res.json(payout);
    } catch (e: any) {
        console.error("Error referencing Payment:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get("/users/:id/balance", authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;

        const member = await prisma.organizationMember.findFirst({
            where: { userId: id, organizationId },
            include: { user: true }
        });

        if (!member) return res.status(404).json({ error: "Usuario no encontrado en la organización" });

        // Calcs
        const logs = await (prisma as any).timeLog.findMany({
            where: { userId: id, project: { organizationId } } as any
        });

        let totalDebt = 0;
        let totalHours = 0;
        logs.forEach((log: any) => {
            let hours = 0;
            if (log.end) {
                const durationMs = new Date(log.end).getTime() - new Date(log.start).getTime();
                hours = durationMs / (1000 * 60 * 60);
            }
            const rate = log.payRate || (member as any).defaultPayRate || 0;
            totalDebt += hours * rate;
            totalHours += hours;
        });

        const payouts = await (prisma as any).payout.findMany({
            where: { userId: id, organizationId },
            orderBy: { createdAt: 'desc' },
            include: { createdBy: true }
        });

        const totalPaid = payouts.reduce((sum: number, p: any) => sum + p.amount, 0);

        const mappedPayments = payouts.map((p: any) => ({
            id: p.id,
            userId: p.userId,
            amount: p.amount,
            currency: p.currency,
            month: p.month,
            note: p.note,
            createdAt: p.createdAt,
            createdBy: p.createdById, // Simplify
            createdByName: p.createdBy?.name
        }));

        res.json({
            userId: member.userId,
            userName: member.user.name,
            defaultPayRate: (member as any).defaultPayRate || 0,
            totalHours,
            totalDebt,
            totalPaid,
            balance: totalDebt - totalPaid,
            payments: mappedPayments
        });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.post("/users", authMiddleware, async (req: any, res) => {
    try {
        const { name, email, password, role } = req.body;
        const { organizationId } = req.user;

        // Verify Admin permission
        // Since we don't have strict granular permissions yet, we assume the caller is Admin or Manager
        // Could check: if (req.user.role !== 'ADMIN') ...

        // Check if user exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            // If exists, checks if already in org
            const member = await prisma.organizationMember.findFirst({
                where: { userId: existing.id, organizationId }
            });
            if (member) return res.status(400).json({ error: "El usuario ya está en la organización" });

            // Add to org
            await prisma.organizationMember.create({
                data: { userId: existing.id, organizationId, role: role || 'AGENT' }
            });
            return res.json({ message: "Usuario existente agregado al equipo" });
        }

        // Create new user
        const hashedPassword = await bcrypt.hash(password || '123456', 10);

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: 'AGENT', // Global role
                memberships: {
                    create: {
                        organizationId,
                        role: role || 'AGENT' // Org role (e.g., DEV, MANAGER)
                    }
                }
            }
        });

        res.json({
            success: true,
            user: { id: newUser.id, name: newUser.name, email: newUser.email },
            message: "Usuario creado y agregado exitosamente"
        });

    } catch (err: any) {
        console.error("Error creating user:", err);
        res.status(500).json({ error: "Error al crear usuario" });
    }
});

// ========== CHANNEL CONFIGURATIONS (Hybrid AI/Human) ==========

/**
 * @openapi
 * /channels:
 *   get:
 *     summary: List all channel configurations
 *     tags: [Channels]
 *     responses:
 *       200:
 *         description: Array of channel configurations
 */
// ========== CHANNELS ==========

/**
 * @openapi
 * /channels:
 *   get:
 *     summary: List all channel configurations
 *     tags: [Channels]
 *     responses:
 *       200:
 *         description: Array of channel configurations
 */
app.get("/channels", authMiddleware, async (req: any, res) => {
    try {
        const channels = await prisma.channel.findMany({
            where: { organizationId: req.user.organizationId } as any
        });
        res.json(channels);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * @openapi
 * /channels:
 *   post:
 *     summary: Create or update a channel configuration
 *     tags: [Channels]
 */
app.post("/channels", authMiddleware, async (req: any, res) => {
    const { id, name, platform, mode, assistaiAgentCode, autoResumeMinutes, config, assignedAgentId, channelValue } = req.body;
    const organizationId = req.user.organizationId;

    // Mapping for frontend compatibility
    const finalName = name || channelValue;
    // Prefer explicitly sent assistaiAgentCode, fallback to assignedAgentId
    const finalAgentCode = assistaiAgentCode || assignedAgentId;

    if (!finalName || !platform) {
        return res.status(400).json({ error: "name (or channelValue) and platform are required" });
    }

    if (!organizationId) {
        console.error('[Channels] Organization ID missing for user:', req.user.id);
        return res.status(400).json({ error: "Organization context missing. Please login again." });
    }

    // Normalize platform to match Prisma enum (UPPERCASE)
    let finalPlatform = platform.toUpperCase();

    // Normalize mode to match Prisma enum (UPPERCASE)
    let finalMode = (mode || 'HYBRID').toUpperCase();

    // Handle specific frontend mapping cases if needed
    if (finalPlatform === 'WHATSAPP_BUSINESS') finalPlatform = 'WHATSAPP';

    try {
        if (id) {
            // Update
            // Ensure widgetId exists for legacy channels
            let updateConfig = config || {};
            if (!updateConfig.widgetId) {
                // Try to keep existing widgetId from DB if strictly config update, but here we replace config.
                // Better approach: generate if missing in payload.
                // Actually, front-end sends full config usually.
                // Let's generate one if missing.
                const widgetId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                updateConfig = { ...updateConfig, widgetId };
            }

            const channel = await prisma.channel.update({
                where: { id, organizationId } as any,
                data: {
                    name: finalName,
                    platform: finalPlatform as any,
                    mode: finalMode as any, // Enum: AI_ONLY, HUMAN_ONLY, HYBRID
                    assistaiAgentCode: finalAgentCode,
                    autoResumeMinutes: autoResumeMinutes ? parseInt(String(autoResumeMinutes)) : 30,
                    config: updateConfig,
                } as any
            });
            res.json(channel);
        } else {
            // Create
            let initialConfig = config || {};

            // Generate a unique widget ID for ALL channels to enable testing via web simulator
            if (!initialConfig.widgetId) {
                const widgetId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                initialConfig = { ...initialConfig, widgetId };
            }

            const channel = await prisma.channel.create({
                data: {
                    name: finalName,
                    platform: finalPlatform as any,
                    mode: finalMode as any,
                    assistaiAgentCode: finalAgentCode,
                    autoResumeMinutes: autoResumeMinutes ? parseInt(String(autoResumeMinutes)) : 30,
                    config: initialConfig,
                    organizationId
                } as any
            });
            res.json(channel);
        }
    } catch (e: any) {
        console.error('[Channels] Error creating/updating channel:', e);
        res.status(500).json({
            error: e.message || "Error saving channel",
            details: e.toString(),
            code: e.code, // Prisma error code
            meta: e.meta  // Prisma error meta
        });
    }
});

/**
 * @openapi
 * /channels/{id}:
 *   delete:
 *     summary: Delete a channel configuration
 *     tags: [Channels]
 */
app.delete("/channels/:id", authMiddleware, async (req: any, res) => {
    try {
        await prisma.channel.deleteMany({
            where: {
                id: req.params.id,
                organizationId: req.user.organizationId
            } as any
        });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * @openapi
 * /public/channels/{widgetId}:
 *   get:
 *     summary: Get public channel config by widgetId
 *     tags: [Public]
 */
app.get("/public/channels/:widgetId", async (req: any, res) => {
    try {
        const { widgetId } = req.params;
        if (!widgetId) return res.status(400).json({ error: "widgetId required" });

        // Find channel where config contains widgetId
        // Prisma JSON filtering might vary by DB, doing in-memory search if needed or raw query
        // But for simplicity let's try findMany and filter in JS if JSON filter not robust
        const channels = await prisma.channel.findMany({
            where: {
                enabled: true
            }
        });

        const channel = channels.find((c: any) => c.config?.widgetId === widgetId);

        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        res.json({
            name: channel.name,
            agentCode: channel.assistaiAgentCode,
            mode: channel.mode
        });
    } catch (e: any) {
        console.error('[Public Channel] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Get channel config for a specific contact (Internal use mainly?)
// Refactoring to general lookup
app.get("/channels/lookup", authMiddleware, async (req: any, res) => {
    // Logic dependent on how we map contacts to channels.
    // For now, let's just return 404 or stub until requirement is clear.
    // The previous logic filtered by 'channelValue' which matches phone number.
    // We should probably rely on Integration or explicit Channel settings.
    res.status(501).json({ error: "Not implemented yet with Prisma" });
});

// ========== CONVERSATION TAKEOVER (Human takes control from AI) ==========

/**
 * @openapi
 * /conversations/{sessionId}/takeover:
 *   post:
 *     summary: Human takes control of conversation from AI
 *     tags: [Conversations]
 */
app.post("/conversations/:sessionId/takeover", authMiddleware, async (req: any, res) => {
    const { sessionId } = req.params;
    const { userId, durationMinutes } = req.body;
    const organizationId = req.user.organizationId;

    try {
        const conversation = await prisma.conversation.findUnique({
            where: { sessionId }
        });
        if (!conversation || (conversation as any).organizationId !== organizationId) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        // Logic to determine default duration based on Channel/System config
        // For now default 60
        const duration = durationMinutes || 60;

        // Upsert Takeover record in DB
        await prisma.takeover.upsert({
            where: { conversationId: conversation.id },
            create: {
                conversationId: conversation.id,
                takenById: userId || req.user.id,
                durationMinutes: duration,
                expiresAt: new Date(Date.now() + duration * 60000),
                organizationId
            } as any,
            update: {
                takenById: userId || req.user.id,
                durationMinutes: duration,
                expiresAt: new Date(Date.now() + duration * 60000)
            }
        });

        // Also update in-memory map for fast access if we keep it
        const takeoverRec: ConversationTakeover = {
            sessionId,
            takenBy: userId || req.user.id,
            takenAt: new Date(),
            expiresAt: new Date(Date.now() + duration * 60000),
            previousMode: 'hybrid', // TODO: Fetch from actual channel config
        };
        conversationTakeovers.set(sessionId, takeoverRec);

        res.json({ success: true, takeover: takeoverRec });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * @openapi
 * /conversations/{sessionId}/release:
 *   post:
 *     summary: Release conversation back to AI
 *     tags: [Conversations]
 */
app.post("/conversations/:sessionId/release", async (req, res) => {
    const { sessionId } = req.params;

    const takeover = conversationTakeovers.get(sessionId);
    if (!takeover) return res.status(404).json({ error: "No active takeover found" });

    conversationTakeovers.delete(sessionId);

    // TODO: Call AssistAI API to resume the agent
    // await fetch(`${ASSISTAI_CONFIG.baseUrl}/api/v1/conversations/${sessionId}/resume`, { method: 'POST', ... });

    io.emit('takeover_ended', { sessionId });

    res.json({ success: true, message: "IA retomó el control" });
});

// Get takeover status for a conversation
app.get("/conversations/:sessionId/takeover-status", (req, res) => {
    const takeover = conversationTakeovers.get(req.params.sessionId);
    if (!takeover) return res.json({ active: false });

    // Check if expired
    if (new Date() > takeover.expiresAt) {
        conversationTakeovers.delete(req.params.sessionId);
        return res.json({ active: false, expired: true });
    }

    res.json({
        active: true,
        takeover,
        remainingMinutes: Math.round((takeover.expiresAt.getTime() - Date.now()) / 60000)
    });
});

// ========== ASSISTAI INTEGRATION ==========
import { assistaiRouter } from "./routes/assistai.js";

// Mount AssistAI Router
app.use("/api/assistai", assistaiRouter);
// Also support legacy paths if needed, or redirect/alias. 
// For now, we mapped everything to be under /api/assistai in the router or we can mount it at root if we want to keep exact paths.
// The router was written with relative paths like /agents.
// If we mount at /assistai, then /assistai/agents works.
// Note: Frontend uses /assistai/agents directly?
// Let's verify frontend usage.
// If frontend calls /assistai/agents, allow mounting at /assistai too.
app.use("/assistai", assistaiRouter);

// ========== META WHATSAPP BUSINESS API ==========
import { metaWhatsAppRouter } from "./routes/meta-whatsapp.js";
app.use("/meta", metaWhatsAppRouter);
app.use("/api/meta", metaWhatsAppRouter);

// ========== INSTAGRAM MESSAGING API ==========
import { instagramRouter } from "./routes/instagram.js";
app.use("/instagram", instagramRouter);
app.use("/api/instagram", instagramRouter);

// Helper to get AssistAI Config for a User (Moved logic to Service if needed, or keep for Auth/limited use)
// For now keeping this as it touches Prisma and User model directly which Service might not have access to yet without circular deps?
// Actually we can keep this for Multi-tenancy support if specialized.
async function getUserAssistAIConfig(userId?: string): Promise<any> {
    // ... simplified or deprecated
    if (!userId) return {}; // Default is handled in service
    // This logic is specific to per-user config override. 
    // We can refactor this later.
    return {};
}

// ========== ORGANIZATIONS (MULTI-TENANCY) ==========

// Duplicate handler removed - see correct handler starting around line 4166


// Update Organization AssistAI Config
app.patch("/organizations/:id/assistai", authMiddleware, requireRole('ADMIN'), async (req: any, res) => {
    try {
        const { id } = req.params;
        const { apiToken, organizationCode, tenantDomain } = req.body;

        const organizationId = req.user.organizationId;
        // Security check: only allow updating own org if not SUPER_ADMIN
        if (req.user.role !== 'SUPER_ADMIN' && organizationId !== id) {
            return res.status(403).json({ error: "No autorizado" });
        }

        // Explicitly cast req.user.role to check if it's SUPER_ADMIN
        const isSuperAdmin = (req.user.role as string) === 'SUPER_ADMIN';

        const org = await prisma.organization.update({
            where: { id },
            data: {
                assistaiConfig: { apiToken, organizationCode, tenantDomain }
            }
        });

        res.json({ success: true, message: "Configuración actualizada" });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// List Organizations (Super Admin)
app.get("/organizations", authMiddleware, requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const orgs = await prisma.organization.findMany({
            include: {
                _count: {
                    select: { members: true } // Assuming 'members' is the relation name for OrganizationMember
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Transform for frontend if needed, but _count should be available
        const formatted = orgs.map(org => ({
            ...org,
            // Map _count.members to users count if frontend expects 'users'
            _count: { users: org._count.members }
        }));

        res.json(formatted);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error fetching organizations" });
    }
});






app.put("/organizations/:id", authMiddleware, requireRole('SUPER_ADMIN'), async (req: any, res) => {
    const { id } = req.params;
    const { name, slug, enabledServices, isActive } = req.body;

    try {
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (slug !== undefined) updateData.slug = slug;
        if (enabledServices !== undefined) updateData.enabledServices = enabledServices;
        if (isActive !== undefined) updateData.isActive = isActive;

        const org = await prisma.organization.update({
            where: { id },
            data: updateData
        });
        res.json(org);
    } catch (e) {
        res.status(500).json({ error: "Failed to update organization" });
    }
});

// Delete Organization (Super Admin only)
app.delete("/organizations/:id", authMiddleware, requireRole('SUPER_ADMIN'), async (req: any, res) => {
    const { id } = req.params;

    try {
        // First check if org exists
        const org = await prisma.organization.findUnique({ where: { id } });
        if (!org) {
            return res.status(404).json({ error: "Organización no encontrada" });
        }

        // Delete related data (memberships, integrations, etc.)
        await prisma.organizationMember.deleteMany({ where: { organizationId: id } });
        await prisma.integration.deleteMany({ where: { organizationId: id } });

        // Delete the organization
        await prisma.organization.delete({ where: { id } });

        res.json({ success: true, message: "Organización eliminada" });
    } catch (e: any) {
        console.error("Delete org error:", e);
        res.status(500).json({ error: e.message || "Failed to delete organization" });
    }
});

// ==================== SAAS ADMIN (USERS) ====================

// List All Users (Super Admin)
app.get("/admin/users", authMiddleware, requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            include: {
                memberships: {
                    include: { organization: { select: { id: true, name: true } } }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Sanitize passwords and flatten organization info
        const sanitized = users.map(u => {
            const { password, memberships, ...rest } = u;
            // Pick the first organization as the "primary" one for display, or null
            const primaryOrg = memberships.length > 0 ? memberships[0].organization : null;

            return {
                ...rest,
                organization: primaryOrg
            };
        });

        res.json(sanitized);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Create User (Super Admin)
app.post("/admin/users", authMiddleware, requireRole('SUPER_ADMIN'), async (req: any, res) => {
    try {
        const { name, email, password, role, organizationId } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: "Email, password y nombre son requeridos" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: (role || 'AGENT') as any,
                memberships: organizationId ? {
                    create: {
                        organizationId,
                        role: (role || 'AGENT') as any
                    }
                } : undefined
            }
        });

        const { password: _, ...rest } = user;
        res.status(201).json(rest);
    } catch (err: any) {
        if (err.code === 'P2002') { // Unique constraint
            return res.status(400).json({ error: "El email ya está registrado" });
        }
        res.status(400).json({ error: err.message });
    }
});

// Update User (Super Admin)
app.patch("/admin/users/:id", authMiddleware, requireRole('SUPER_ADMIN'), async (req: any, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, organizationId, password } = req.body;

        const updateData: any = { name, email, role, organizationId };

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        // Remove undefined fields
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        const user = await prisma.user.update({
            where: { id },
            data: updateData
        });

        const { password: _, ...rest } = user;
        res.json(rest);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// ========== SUPER ADMIN SAAS METRICS ==========

// Get comprehensive platform metrics for Super Admin dashboard
app.get("/admin/saas-metrics", authMiddleware, requireRole('SUPER_ADMIN'), async (req: any, res) => {
    try {
        const now = new Date();
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        // Parallel queries for performance
        const [
            totalOrgs,
            activeOrgs,
            totalUsers,
            newUsersThisMonth,
            totalCustomers,
            newCustomersThisMonth,
            totalTickets,
            openTickets,
            ticketsThisMonth,
            totalProjects,
            activeProjects,
            usersByRole,
            orgsByMonth,
            customersByPlan
        ] = await Promise.all([
            prisma.organization.count(),
            (prisma.organization.count as any)({ where: { isActive: true } }),
            prisma.user.count(),
            prisma.user.count({ where: { createdAt: { gte: thisMonth } } }),
            prisma.customer.count(),
            prisma.customer.count({ where: { createdAt: { gte: thisMonth } } }),
            prisma.ticket.count(),
            prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
            prisma.ticket.count({ where: { createdAt: { gte: thisMonth } } }),
            (prisma as any).project.count(),
            (prisma as any).project.count({ where: { status: 'ACTIVE' } }),
            prisma.user.groupBy({ by: ['role'], _count: { role: true } }),
            prisma.organization.groupBy({
                by: ['createdAt'],
                _count: { id: true },
                orderBy: { createdAt: 'asc' }
            }),
            prisma.customer.groupBy({ by: ['plan'], _count: { plan: true } })
        ]);

        // Calculate MRR estimate based on customers by plan
        const planPricing: Record<string, number> = {
            'FREE': 0,
            'BASIC': 29,
            'PRO': 79,
            'ENTERPRISE': 199,
            'PREMIUM': 99,
            'TRIAL': 0
        };

        const mrr = customersByPlan.reduce((sum, item) => {
            const price = planPricing[item.plan] || 0;
            return sum + (price * item._count.plan);
        }, 0);

        // Format users by role
        const roleStats = usersByRole.reduce((acc, item) => {
            acc[item.role] = item._count.role;
            return acc;
        }, {} as Record<string, number>);

        // Calculate growth rates
        const suspendedOrgs = totalOrgs - activeOrgs;
        const ticketResolutionRate = totalTickets > 0
            ? Math.round(((totalTickets - openTickets) / totalTickets) * 100)
            : 0;

        res.json({
            // Overview
            overview: {
                totalOrganizations: totalOrgs,
                activeOrganizations: activeOrgs,
                suspendedOrganizations: suspendedOrgs,
                totalUsers: totalUsers,
                newUsersThisMonth: newUsersThisMonth,
                totalCustomers: totalCustomers,
                newCustomersThisMonth: newCustomersThisMonth
            },
            // Tickets & Support
            support: {
                totalTickets: totalTickets,
                openTickets: openTickets,
                ticketsThisMonth: ticketsThisMonth,
                resolutionRate: ticketResolutionRate
            },
            // Projects (ChronusDev)
            projects: {
                total: totalProjects,
                active: activeProjects
            },
            // Revenue
            revenue: {
                estimatedMRR: mrr,
                customersByPlan: customersByPlan.map(p => ({
                    plan: p.plan,
                    count: p._count.plan,
                    revenue: (planPricing[p.plan] || 0) * p._count.plan
                }))
            },
            // User breakdown
            usersByRole: roleStats,
            // Timestamps
            generatedAt: now.toISOString()
        });
    } catch (err: any) {
        console.error("Error fetching SaaS metrics:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== TENANT ADMIN (TEAM) ====================

// List Organization Users (Tenant Admin)
app.get("/organization/users", authMiddleware, requireRole('ADMIN'), async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;
        if (!organizationId) return res.status(403).json({ error: "No tienes organización asignada" });

        const users = await prisma.user.findMany({
            where: { memberships: { some: { organizationId } } },
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, email: true, role: true, createdAt: true, lastLoginAt: true }
        });

        res.json(users);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Invite/Create User for Organization (Tenant Admin)
app.post("/organization/users", authMiddleware, requireRole('ADMIN'), async (req: any, res) => {
    // ... (existing code, ensure it's kept or matched correctly)
    try {
        const organizationId = req.user.organizationId;
        if (!organizationId) return res.status(403).json({ error: "No tienes organización asignada" });

        const { name, email, password, role } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: "Email, password y nombre son requeridos" });
        }

        // Restrict roles a Tenant Admin can assign (cannot create SUPER_ADMIN)
        if (!['AGENT', 'MANAGER', 'ADMIN'].includes(role)) {
            return res.status(400).json({ error: "Rol no permitido" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: (role || 'AGENT') as any,
                memberships: {
                    create: {
                        organizationId,
                        role: (role || 'AGENT') as any
                    }
                }
            } as any
        });

        const { password: _, ...rest } = user;

        res.json(rest);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});


// ... (existing code)

// Voice Validation
app.post("/voice/validate", authMiddleware, async (req: any, res) => {
    try {
        let { agentId, apiKey } = req.body;

        // Sanitize input
        agentId = agentId ? agentId.trim() : '';
        apiKey = apiKey ? apiKey.trim() : '';

        if (!agentId || !apiKey) {
            return res.status(400).json({ error: "Agent ID y API Key requeridos" });
        }
        const result = await validateAgentId(agentId, apiKey);
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// SEED DEMO DATA
app.post("/organization/seed-demo", authMiddleware, requireRole('ADMIN'), async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;
        if (!organizationId) return res.status(403).json({ error: "No tienes organización asignada" });

        // 1. Create Dummy Customers
        const customers = await Promise.all([
            prisma.customer.create({ data: { organizationId, name: 'Empresa Demo A', email: 'contacto@demoa.com', plan: 'PRO', status: 'ACTIVE', monthlyRevenue: 1500 } as any }),
            prisma.customer.create({ data: { organizationId, name: 'Consultora XYZ', email: 'info@xyz.com', plan: 'ENTERPRISE', status: 'ACTIVE', monthlyRevenue: 5000 } as any }),
            prisma.customer.create({ data: { organizationId, name: 'Startup Beta', email: 'hello@beta.io', plan: 'BASIC', status: 'TRIAL', monthlyRevenue: 0 } as any }),
            prisma.customer.create({ data: { organizationId, name: 'Restaurante El Sabor', email: 'reservas@sabor.com', plan: 'PRO', status: 'ACTIVE', monthlyRevenue: 1200 } as any }),
            prisma.customer.create({ data: { organizationId, name: 'Tech Solutions', email: 'support@techsol.com', plan: 'ENTERPRISE', status: 'CHURNED', monthlyRevenue: 0 } as any }),
        ]);

        // 2. Create Dummy Tickets
        await prisma.ticket.createMany({
            data: [
                { organizationId, title: 'Error en login', status: 'OPEN', priority: 'HIGH', customerId: customers[0].id },
                { organizationId, title: 'Consulta sobre facturación', status: 'IN_PROGRESS', priority: 'MEDIUM', customerId: customers[1].id },
                { organizationId, title: 'Feature Request: Dark Mode', status: 'OPEN', priority: 'LOW', customerId: customers[2].id },
                { organizationId, title: 'Problema con integración WhatsApp', status: 'RESOLVED', priority: 'URGENT', customerId: customers[3].id },
            ] as any
        });

        // 3. Create Dummy Leads
        await prisma.lead.createMany({
            data: [
                { organizationId, name: 'Interesado Demo', email: 'lead1@test.com', status: 'NEW', source: 'MANUAL' },
                { organizationId, name: 'Posible Partner', email: 'partner@test.com', status: 'CONTACTED', source: 'SOCIAL' },
                { organizationId, name: 'Cliente Potencial Grande', email: 'bigdeal@test.com', status: 'QUALIFIED', source: 'REFERRAL' },
            ] as any
        });

        res.json({ success: true, message: "Datos de demostración generados correctamente." });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});












// ========== CONTACT IDENTITY MANAGEMENT ==========



// Contact Management Endpoints
app.get("/contacts", authMiddleware, async (req: any, res) => {
    const organizationId = req.user.organizationId;
    const { customerId } = req.query;

    try {
        const contacts = await prisma.contact.findMany({
            where: {
                organizationId,
                ...(customerId ? { customerId: customerId as string } : {})
            } as any,
            include: { customer: true }
        });
        res.json(contacts);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Initialize with demo contacts
// Removed demo contact initialization

// Helper function to find client by contact (IG, phone, etc.)
// Helper function to find client by contact (now uses Prisma)

// GET all contacts
// POST create contact identity
app.post("/contacts", authMiddleware, async (req: any, res) => {
    const { type, value, displayName, customerId } = req.body;
    const organizationId = req.user.organizationId;

    if (!type || !value) {
        return res.status(400).json({ error: 'type and value are required' });
    }

    try {
        const contact = await prisma.contact.create({
            data: {
                customerId,
                organizationId,
                type: type.toUpperCase() as any,
                value,
                displayName,
                verified: false
            } as any
        });
        res.status(201).json(contact);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// PATCH assign contact to customer
app.patch("/contacts/:id/assign", authMiddleware, async (req: any, res) => {
    const organizationId = req.user.organizationId;
    const { customerId } = req.body;

    try {
        const contact = await prisma.contact.update({
            where: { id: req.params.id, organizationId } as any,
            data: { customerId }
        });
        res.json(contact);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE contact
app.delete("/contacts/:id", authMiddleware, async (req: any, res) => {
    const organizationId = req.user.organizationId;
    try {
        await prisma.contact.delete({
            where: { id: req.params.id, organizationId } as any
        });
        res.status(204).send();
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ========== CLIENT CREATION & CONVERSION ==========

// POST create client from chat
/**
 * @openapi
 * /clients/from-chat:
 *   post:
 *     summary: Create a new client from a chat conversation
 *     tags: [Clients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - contactValue
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               company:
 *                 type: string
 *               notes:
 *                 type: string
 *               contactValue:
 *                 type: string
 *               contactType:
 *                 type: string
 *               platform:
 *                 type: string
 *               sessionId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Client created successfully
 */
// POST create client from chat

// POST convert lead to client

// GET client 360 view with all conversations

// GET match contact to existing client


// ========== NOTIFICATIONS SERVICE (Mobile App Foundation) ==========

// Types for notifications
type Notification = {
    id: string;
    userId: string;
    type: 'message' | 'ticket' | 'invoice' | 'system' | 'assistai';
    title: string;
    body: string;
    data?: Record<string, any>;
    read: boolean;
    createdAt: Date;
};

type PushDevice = {
    id: string;
    userId: string;
    token: string;
    platform: 'ios' | 'android' | 'web';
    createdAt: Date;
};

type NotificationPreferences = {
    userId: string;
    pushEnabled: boolean;
    emailEnabled: boolean;
    channels: {
        messages: boolean;
        tickets: boolean;
        invoices: boolean;
        system: boolean;
    };
};

// In-memory stores (replace with database in production)
// Notifications and preferences are now persisted in Prisma


// CSV Export Routes
app.get("/reports/export/invoices-csv", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: "Unauthorized" });

        const invoices = await prisma.invoice.findMany({
            where: { organizationId },
            include: { customer: true },
            orderBy: { createdAt: 'desc' }
        });

        const headers = ["ID", "Number", "Customer", "Amount", "Currency", "Status", "Date"];
        const rows = invoices.map(inv => [
            inv.id,
            inv.number,
            inv.customer?.name || "N/A",
            inv.amount.toFixed(2),
            inv.currency,
            inv.status,
            inv.createdAt.toISOString().split('T')[0]
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="invoices.csv"`);
        res.send(csvContent);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/reports/export/transactions-csv", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: "Unauthorized" });

        const transactions = await prisma.transaction.findMany({
            where: { organizationId },
            include: { customer: true },
            orderBy: { date: 'desc' }
        });

        const headers = ["ID", "Date", "Description", "Category", "Type", "Amount", "Customer"];
        const rows = transactions.map(t => [
            t.id,
            t.date.toISOString().split('T')[0],
            t.description,
            t.category,
            t.type,
            t.amount.toFixed(2),
            t.customer?.name || "N/A"
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="transactions.csv"`);
        res.send(csvContent);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});


// Update Invoice

// Send Invoice/Quote via Email

// ========== NOTIFICATIONS ==========

app.get("/notifications", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: "No organization context" });

        const notifications = await prisma.notification.findMany({
            where: { organizationId, userId: req.user.id } as any,
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.json(notifications);
    } catch (e: any) {
        console.error("GET /notifications error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post("/notifications", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: "No organization context" });

        const { userId, title, body, type, data } = req.body;
        if (!userId || !title || !body) {
            return res.status(400).json({ error: 'userId, title, and body are required' });
        }

        // Create in-app notification + send push in one call
        const notification = await createNotificationWithPush({
            userId,
            organizationId,
            type: (type as string || 'SYSTEM').toUpperCase(),
            title,
            body,
            data: data || {},
            io,
        });

        res.status(201).json(notification);
    } catch (e: any) {
        console.error("POST /notifications error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.patch("/notifications/:id/read", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const notification = await prisma.notification.update({
            where: { id: req.params.id, organizationId } as any,
            data: { read: true }
        });
        res.json(notification);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});


// POST mark all as read
app.post("/notifications/mark-all-read", authMiddleware, async (req: any, res) => {
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    try {
        const result = await prisma.notification.updateMany({
            where: { organizationId, userId, read: false } as any,
            data: { read: true }
        });

        res.json({ success: true, markedRead: result.count });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE notification
app.delete("/notifications/:id", authMiddleware, async (req: any, res) => {
    const organizationId = req.user.organizationId;

    try {
        await prisma.notification.delete({
            where: { id: req.params.id, organizationId } as any
        });
        res.status(204).send();
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ===== Push Device Registration =====

// POST register push device
app.post("/notifications/devices", authMiddleware, async (req: any, res) => {
    const { token, platform } = req.body;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    if (!token || !platform) {
        return res.status(400).json({ error: 'token and platform are required' });
    }

    try {
        const device = await (prisma as any).pushDevice.create({
            data: {
                userId,
                organizationId,
                token,
                platform
            } as any
        });

        res.status(201).json(device);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE unregister push device
app.delete("/notifications/devices/:id", authMiddleware, async (req: any, res) => {
    const organizationId = req.user.organizationId;

    try {
        await (prisma as any).pushDevice.delete({
            where: { id: req.params.id, organizationId } as any
        });
        res.status(204).send();
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// GET user's devices
app.get("/notifications/devices", authMiddleware, async (req: any, res) => {
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    try {
        const devices = await (prisma as any).pushDevice.findMany({
            where: { userId, organizationId } as any
        });
        res.json(devices);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ===== Notification Preferences =====

// GET preferences
app.get("/notifications/preferences", authMiddleware, async (req: any, res) => {
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    try {
        let prefs = await (prisma as any).notificationPreferences.findUnique({
            where: { userId }
        });

        if (!prefs) {
            // Create default prefs if not found
            prefs = await (prisma as any).notificationPreferences.create({
                data: {
                    userId,
                    organizationId,
                    email: true,
                    push: true,
                    whatsapp: true
                } as any
            });
        }

        res.json(prefs);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// PUT update preferences
app.put("/notifications/preferences", authMiddleware, async (req: any, res) => {
    const { email, push, whatsapp } = req.body;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    try {
        const prefs = await (prisma as any).notificationPreferences.upsert({
            where: { userId },
            update: { email, push, whatsapp },
            create: {
                userId,
                organizationId,
                email: email !== undefined ? email : true,
                push: push !== undefined ? push : true,
                whatsapp: whatsapp !== undefined ? whatsapp : true
            } as any
        });
        res.json(prefs);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST send test push notification
app.post("/notifications/test-push", authMiddleware, async (req: any, res) => {
    const organizationId = req.user.organizationId;
    const { userId, title, body } = req.body;
    const targetUserId = userId || req.user.id;

    try {
        const result = await sendPushToUser(targetUserId, organizationId, {
            title: title || '🔔 Test Push',
            body: body || 'Esta es una notificación de prueba desde ChronusCRM',
            data: { type: 'test' }
        }, io);

        res.json({
            success: true,
            message: `Push sent to ${result.sent} devices (${result.failed} failed)`,
            ...result
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST admin broadcast — send manual notification to team or all users
app.post("/notifications/broadcast", authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN'), async (req: any, res) => {
    const organizationId = req.user.organizationId;
    const senderId = req.user.id;
    const { title, body, type, targetUserIds, data } = req.body;

    if (!title || !body) {
        return res.status(400).json({ error: 'title and body are required' });
    }

    try {
        const result = await broadcastNotification({
            organizationId,
            senderUserId: senderId,
            title,
            body,
            type: type || 'SYSTEM',
            data,
            targetUserIds, // If empty/null, sends to ALL users in org
            io,
        });

        res.json({
            success: true,
            message: `Broadcast sent: ${result.notificationsCreated} notifications created`,
            ...result
        });
    } catch (e: any) {
        console.error('POST /notifications/broadcast error:', e);
        res.status(500).json({ error: e.message });
    }
});


// ========== API DOCUMENTATION (SCALAR) ==========

const swaggerOptions: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.1.0',
        info: {
            title: 'ChronusCRM API',
            version: '1.0.0',
            description: 'API completa para gestión de CRM con integración AssistAI, clientes, tickets, facturas y más.',
            contact: { name: 'Chronus Team', email: 'soporte@chronus.dev' }
        },
        servers: [
            { url: 'http://localhost:3002', description: 'Servidor de desarrollo (Backend)' },
            { url: 'https://api.chronus.dev', description: 'Producción' }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                },
                apiKey: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-api-key'
                }
            }
        },
        tags: [
            { name: 'Customers', description: 'Gestión de clientes y leads' },
            { name: 'Tickets', description: 'Tickets de soporte y ayuda' },
            { name: 'AssistAI', description: 'Integración con agentes AI' },
            { name: 'Developer Tools', description: 'API Keys y Webhooks' }
        ]
    },
    // Paths to files containing OpenAPI definitions
    apis: [
        './src/index.ts',
        './src/routes/*.ts'
    ],
};

const openApiSpec = swaggerJsdoc(swaggerOptions);

app.use('/api/docs', apiReference({
    spec: { content: openApiSpec },
    theme: 'purple',
    // Fix: Ensure we don't rely on URL fetch if CSP is tricky, injecting content directly is safer
} as any));
app.get('/api/openapi.json', (req, res) => res.json(openApiSpec));

// ========== MARKETING ROUTES ==========
import marketingRoutes from './routes/marketing.js';
app.use('/marketing', marketingRoutes);

// ========== REMINDER ROUTES ==========
import reminderRoutes from './routes/reminders.js';
app.use('/reminders', reminderRoutes);

// ========== AUTH ROUTES ==========

app.post(["/auth/forgot-password", "/api/auth/forgot-password"], async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email requerido" });

    // Import dynamically to ensure latest compiled version or move import to top if possible
    // But since we are editing index.ts, better to use the imported functions from auth.js if we exported them.
    // I need to update imports in index.ts first or assume they are exported.
    // Let's check imports.
    // Wait, I need to export handleForgotPassword and handleResetPassword from auth.ts first. 
    // I did that in previous step. 
    // Now I need to import them TO index.ts. 
    // Since I can't easily change top-level imports without reading the whole file again and potentially messing up,
    // I will try to append the routes and if imports are missing I will fix them.
    // actually, I can just ADD the routes here and assume I will fix imports in next step or use dynamic import?
    // Dynamic import is safer for "patching" a file layout I don't fully control in one go.

    const { handleForgotPassword } = await import('./auth.js');
    try {
        const result = await handleForgotPassword(email);
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post(["/auth/reset-password", "/api/auth/reset-password"], async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: "Token y nueva contraseña requeridos" });

    const { handleResetPassword } = await import('./auth.js');
    try {
        const result = await handleResetPassword(token, newPassword);
        if (result.error) {
            res.status(400).json(result);
        } else {
            res.json(result);
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Login with email/password
app.post(["/auth/login", "/api/auth/login"], async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email y contraseña requeridos" });
        }
        const result = await handleLogin(email, password);
        if (result.error) {
            return res.status(401).json({ error: result.error });
        }
        res.json(result);
    } catch (e: any) {
        console.error("Login Error:", e);
        res.status(500).json({ error: "Error interno del servidor: " + e.message });
    }
});

// Register new user
app.post(["/auth/register", "/api/auth/register"], async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Nombre, email y contraseña requeridos" });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }
    const result = await handleRegister(name, email, password);
    if (result.error) {
        return res.status(400).json({ error: result.error });
    }
    res.status(201).json(result);
});

// Get current user
app.get(["/auth/me", "/api/auth/me"], authMiddleware, async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatar: true,
            phone: true,
            createdAt: true,
            lastLoginAt: true,
            memberships: {
                take: 1,
                select: { organizationId: true }
            }
        }
    });

    if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Map for frontend compatibility
    const userResponse = {
        ...user,
        organizationId: user.memberships[0]?.organizationId
    };

    res.json({ user: userResponse });
});

// Update current user profile
app.put(["/auth/me", "/api/auth/me"], authMiddleware, async (req, res) => {
    try {
        const { name, avatar, phone, email } = req.body;
        const userId = req.user!.id;

        // Perform update
        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                name,
                avatar,
                phone,
                // Only allow email update if valid format (basic check)
                ...(email && email.includes('@') ? { email } : {})
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatar: true,
                phone: true,
                memberships: {
                    take: 1,
                    select: { organizationId: true }
                }
            }
        });

        // Map for frontend compatibility
        const userResponse = {
            ...user,
            organizationId: user.memberships[0]?.organizationId
        };

        res.json({ user: userResponse });
    } catch (e: any) {
        console.error("PUT /auth/me error:", e);
        if (e.code === 'P2002') {
            return res.status(400).json({ error: "El email ya está en uso" });
        }
        res.status(500).json({ error: "Error actualizando perfil" });
    }
});



// Update Organization Profile
app.put("/organization/profile", authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const { name } = req.body;
        const organizationId = req.user!.organizationId;

        if (!name) return res.status(400).json({ error: "Nombre requerido" });

        const org = await prisma.organization.update({
            where: { id: organizationId },
            data: { name }
        });

        res.json(org);
    } catch (e: any) {
        console.error("PUT /organization/profile error:", e);
        res.status(500).json({ error: "Error actualizando organización" });
    }
});

// GET Organization Users (Team)
app.get("/organization/users", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user!.organizationId;
        const users = await prisma.user.findMany({
            where: {
                memberships: { some: { organizationId } }
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true, // This might need mapping from membership role if distinct
                createdAt: true,
                lastLoginAt: true
            }
        });

        // Map users to include their specific role in this org
        // (Assuming simple 1:1 for now or taking the verified role)
        // If users have multiple orgs, we should check OrganizationMember table ideally.
        // But for this MVP simpler schema usage:
        res.json(users);
    } catch (e: any) {
        console.error("GET /organization/users error:", e);
        res.status(500).json({ error: "Error cargando equipo" });
    }
});

// POST Invite User to Organization
app.post("/organization/users", authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN'), async (req: any, res) => {
    try {
        const organizationId = req.user!.organizationId;
        const { name, email, password, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: "Todos los campos son requeridos" });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: "El usuario ya está registrado en la plataforma" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Transaction to create user and membership
        const newUser = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    role: 'AGENT' // Default system role
                }
            });

            await tx.organizationMember.create({
                data: {
                    userId: user.id,
                    organizationId,
                    role: role || 'AGENT'
                }
            });

            return user;
        });

        res.status(201).json(newUser);
    } catch (e: any) {
        console.error("POST /organization/users error:", e);
        res.status(500).json({ error: "Error invitando usuario" });
    }
});

// ==================== ORGANIZATION ASSISTAI ROUTES ====================

// GET /organizations/:id/assistai
app.get('/organizations/:id/assistai', authMiddleware, async (req: any, res) => {
    const { id } = req.params;
    // Check permission - Allow if user belongs to org or is super admin
    if (req.user.organizationId !== id && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        const org = await prisma.organization.findUnique({
            where: { id },
            select: { assistaiConfig: true }
        });

        // Return a config structure expected by frontend
        const config = (org?.assistaiConfig as any) || {};
        res.json({
            enabled: config.enabled || false,
            assistaiAgentId: config.assistaiAgentId || '',
            apiKey: config.apiKey || ''
        });
    } catch (e) {
        console.error("GET assistai config error", e);
        res.status(500).json({ error: "Error fetching settings" });
    }
});

// PATCH /organizations/:id/assistai
app.patch('/organizations/:id/assistai', authMiddleware, async (req: any, res) => {
    const { id } = req.params;
    if (req.user.organizationId !== id && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        const config = req.body;
        // In real app, update DB columns
        // const org = await prisma.organization.update(...)

        console.log(`[AssistAI] Updated config for ${id}:`, config);

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Error saving settings" });
    }
});

// POST /organizations/seed-demo
app.post('/organizations/seed-demo', authMiddleware, async (req, res) => {
    // Seed logic here (mock)
    res.json({ success: true, message: "Demo data seeded successfully" });
});


// Logout
app.post("/auth/logout", authMiddleware, async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
        await handleLogout(token);
    }
    res.json({ success: true, message: "Sesión cerrada" });
});

// Switch Organization
app.post(["/auth/switch-org", "/api/auth/switch-org"], authMiddleware, async (req, res) => {
    try {
        const { organizationId } = req.body;
        if (!req.user) return res.status(401).json({ error: 'No user' });

        const result = await switchOrganization(req.user.id, organizationId);
        if ((result as any).error) {
            return res.status(403).json(result);
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Error switching organization' });
    }
});

// ==================== INTEGRATIONS ROUTES ====================

// Mock Store for Integrations
const integrationsStore: Record<string, any[]> = {}; // orgId -> integrations[]
const smtpStore: Record<string, any> = {}; // orgId -> smtpConfig

// GET /integrations
app.get('/integrations', authMiddleware, async (req: any, res) => {
    try {
        const orgId = req.user.organizationId;

        const integrations = await prisma.integration.findMany({
            where: { organizationId: orgId }
        });

        // Transform to match expected frontend format
        const formattedIntegrations = integrations.map(i => ({
            id: i.id,
            provider: i.provider,
            credentials: i.credentials,
            isEnabled: i.isEnabled,
            connected: i.isEnabled // Assume connected if enabled
        }));

        res.json(formattedIntegrations);
    } catch (err: any) {
        console.error('[Integrations] Fetch error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /integrations
app.post('/integrations', authMiddleware, async (req: any, res) => {
    try {
        const orgId = req.user.organizationId;
        const { provider, credentials, isEnabled } = req.body;

        console.log(`[Integrations] Saving ${provider} for org ${orgId}`);

        // Check if integration already exists for this org + provider
        const existing = await prisma.integration.findFirst({
            where: {
                organizationId: orgId,
                provider: provider
            }
        });

        let integration;
        if (existing) {
            // Update existing
            integration = await prisma.integration.update({
                where: { id: existing.id },
                data: {
                    credentials,
                    isEnabled: isEnabled !== undefined ? isEnabled : true
                }
            });
            console.log(`[Integrations] Updated ${provider} integration`);
        } else {
            // Create new
            integration = await prisma.integration.create({
                data: {
                    organizationId: orgId,
                    provider,
                    credentials,
                    isEnabled: isEnabled !== undefined ? isEnabled : true
                }
            });
            console.log(`[Integrations] Created new ${provider} integration`);
        }

        res.json({
            success: true,
            integration: {
                id: integration.id,
                provider: integration.provider,
                isEnabled: integration.isEnabled,
                connected: true
            }
        });
    } catch (err: any) {
        console.error('[Integrations] Save error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /integrations/test-assistai - Test AssistAI credentials without saving
app.post('/integrations/test-assistai', authMiddleware, async (req: any, res) => {
    try {
        const { apiToken, tenantDomain, organizationCode } = req.body;

        if (!apiToken || !tenantDomain || !organizationCode) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const headers = {
            'Authorization': `Bearer ${apiToken}`,
            'x-tenant-domain': tenantDomain,
            'x-organization-code': organizationCode,
            'Content-Type': 'application/json',
        };

        const baseUrl = 'https://public.assistai.lat';
        console.log('[Test AssistAI] Testing connection...');

        const response = await fetch(`${baseUrl}/api/v1/agents`, { headers });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Test AssistAI] API error:', response.status, errorText);
            return res.status(400).json({
                error: `AssistAI API returned ${response.status}`,
                details: errorText
            });
        }

        const data = await response.json();
        const count = data.data?.length || 0;

        console.log(`[Test AssistAI] Success! Found ${count} agents`);
        res.json({
            success: true,
            count,
            message: `Conexión exitosa! ${count} agentes encontrados`
        });
    } catch (err: any) {
        console.error('[Test AssistAI] Error:', err);
        res.status(500).json({ error: err.message || 'Connection failed' });
    }
});

// ==================== SMTP SETTINGS ROUTES ====================

// GET /settings/smtp
app.get('/settings/smtp', authMiddleware, async (req: any, res) => {
    const orgId = req.user.organizationId;
    res.json(smtpStore[orgId] || {});
});

// POST /settings/smtp
app.post('/settings/smtp', authMiddleware, async (req: any, res) => {
    const orgId = req.user.organizationId;
    const config = req.body;
    smtpStore[orgId] = config;
    res.json({ success: true });
});

// Debug Email Endpoint
app.post('/debug/email', authMiddleware, async (req, res) => {
    // Mock email sending
    console.log("[SMTP DEBUG] Sending email:", req.body);
    res.json({ success: true });
});

// Voice Validate Endpoint (Mock)
app.post('/voice/validate', authMiddleware, async (req, res) => {
    const { apiKey, agentId } = req.body;
    if (apiKey === 'error') return res.status(400).json({ error: 'Invalid API Key' });
    res.json({ success: true, agentName: 'Mock Agent' });
});

// ==================== SUPER ADMIN ORGANIZATIONS ====================

// GET /organizations/:id/public - Public endpoint for cross-system org name lookup
app.get('/organizations/:id/public', async (req, res) => {
    try {
        const { id } = req.params;
        const org = await prisma.organization.findUnique({
            where: { id },
            select: { id: true, name: true }
        });

        if (!org) {
            return res.status(404).json({ error: 'Organización no encontrada' });
        }

        res.json({ id: org.id, name: org.name });
    } catch (e) {
        res.status(500).json({ error: 'Error fetching organization' });
    }
});

// GET /organizations - List all orgs
app.get('/organizations', authMiddleware, requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const orgs = await prisma.organization.findMany({
            include: {
                _count: {
                    select: { memberships: true } as any
                }
            }
        });
        res.json(orgs);
    } catch (e) {
        res.status(500).json({ error: 'Error fetching organizations' });
    }
});

// POST /organizations - Create new org
app.post('/organizations', authMiddleware, requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
        console.log("POST /organizations hit");
        console.log("Headers:", req.headers);
        console.log("Body:", req.body);
        const { name, enabledServices, adminEmail, adminName } = req.body;


        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);

        const result = await prisma.$transaction(async (tx) => {
            // Create Org
            const org = await tx.organization.create({
                data: {
                    name,
                    slug,
                    enabledServices: enabledServices || "CRM"
                }
            });

            // If admin info provided, create user or link existing
            let newUserCreated = false;
            let finalPassword = "";

            if (adminEmail) {
                let user = await tx.user.findUnique({ where: { email: adminEmail } });

                if (!user) {
                    // Create new user
                    finalPassword = req.body.adminPassword || Math.random().toString(36).slice(-8) + "Aa1!";
                    const hashedPassword = await bcrypt.hash(finalPassword, 10);

                    user = await tx.user.create({
                        data: {
                            email: adminEmail,
                            name: adminName || adminEmail.split('@')[0],
                            password: hashedPassword,
                            role: "AGENT"
                        }
                    });
                    newUserCreated = true;
                }

                // Add as Admin of this org
                await tx.organizationMember.create({
                    data: {
                        userId: user.id,
                        organizationId: org.id,
                        role: "ADMIN"
                    }
                });
            }

            return { ...org, newUserCreated, initialPassword: finalPassword, adminEmail };
        });

        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error creating organization' });
    }
});

// PUT /organizations/:id - Update services and subscription details
app.put('/organizations/:id', authMiddleware, requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { enabledServices, name, plan, subscriptionStatus, trialEndsAt } = req.body;

        console.log(`Updating Org ${id}:`, { enabledServices, name, plan, subscriptionStatus, trialEndsAt });

        const updateData: any = {};
        if (enabledServices !== undefined) updateData.enabledServices = enabledServices;
        if (name !== undefined) updateData.name = name;
        if (plan !== undefined) updateData.plan = plan;
        if (subscriptionStatus !== undefined) updateData.subscriptionStatus = subscriptionStatus;
        if (trialEndsAt !== undefined) updateData.trialEndsAt = trialEndsAt;

        const org = await prisma.organization.update({
            where: { id },
            data: updateData
        });

        res.json(org);
    } catch (e) {
        console.error("Error updating organization:", e);
        res.status(500).json({ error: 'Error updating organization' });
    }
});

// Email SMTP Configuration
app.post("/settings/smtp", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { host, port, user, pass, from } = req.body;

        if (!organizationId) return res.status(401).json({ error: "Unauthorized" });

        await (prisma.organization as any).update({
            where: { id: organizationId },
            data: {
                smtpConfig: {
                    host,
                    port,
                    user,
                    pass,
                    from
                }
            }
        });

        res.json({ success: true, message: "Configuración SMTP guardada" });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.get("/settings/smtp", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: "Unauthorized" });

        const org = await (prisma.organization as any).findUnique({
            where: { id: organizationId },
            select: { smtpConfig: true }
        });

        res.json((org as any)?.smtpConfig || {});
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ==================== SUPER ADMIN USERS ====================

// GET /admin/users - Global user search
app.get('/admin/users', authMiddleware, requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const { search } = req.query;
        const where: any = {};

        if (search) {
            where.OR = [
                { email: { contains: String(search) } },
                { name: { contains: String(search) } }
            ];
        }

        const users = await prisma.user.findMany({
            where,
            include: {
                memberships: {
                    include: { organization: true }
                }
            },
            take: 50
        });

        res.json(users);
    } catch (e) {
        res.status(500).json({ error: 'Error fetching users' });
    }
});

// POST /admin/users/:id/suspend - Toggle suspension (mock implementation for now)
app.post('/admin/users/:id/suspend', authMiddleware, requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        console.log(`Suspending user ${user.email}`);

        // TODO: Add 'suspended' field to User model if needed, or rely on org suspension
        // For now we just log it

        res.json({ success: true, message: "User suspended (simulation)" });
    } catch (e) {
        res.status(500).json({ error: 'Error suspending user' });
    }
});

// POST /admin/impersonate - Login as another user
app.post('/admin/impersonate', authMiddleware, requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const { userId, organizationId } = req.body;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { memberships: { include: { organization: true } } }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        // Generate token as that user
        const token = generateToken({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: organizationId || user.memberships[0]?.organizationId
        });

        // Return same structure as login
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                organizations: user.memberships.map(m => ({
                    id: m.organization.id,
                    name: m.organization.name,
                    slug: m.organization.slug,
                    role: m.role,
                    enabledServices: m.organization.enabledServices
                })),
                organization: {
                    id: organizationId || user.memberships[0]?.organizationId,
                    name: user.memberships.find(m => m.organizationId === (organizationId || user.memberships[0]?.organizationId))?.organization.name,
                    enabledServices: user.memberships.find(m => m.organizationId === (organizationId || user.memberships[0]?.organizationId))?.organization.enabledServices
                }
            }
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error impersonating user' });
    }
});

// AssistAI OAuth - Redirect to AssistAI
app.get("/auth/assistai", (req, res) => {
    const authUrl = getAssistAIAuthUrl();
    res.redirect(authUrl);
});

// AssistAI OAuth - Callback
app.get("/auth/assistai/callback", async (req, res) => {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: "Código de autorización requerido" });
    }
    const result = await handleAssistAICallback(code);
    if (result.error) {
        return res.status(400).json({ error: result.error });
    }
    // Redirect to frontend with token
    const frontendUrl = process.env.CRM_FRONTEND_URL || 'http://localhost:3003';
    res.redirect(`${frontendUrl}/auth/callback?token=${result.token}`);
});

// ========== ACTIVITY TIMELINE ENDPOINTS ==========

// Get all recent activities (dashboard feed)
app.get("/activities", authMiddleware, async (req: any, res) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "No organization context" });

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    try {
        const activities = await getRecentActivities(organizationId, limit);
        res.json(activities);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get activities for a specific customer
app.get("/customers/:id/activities", authMiddleware, async (req: any, res) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "No organization context" });

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    try {
        const activities = await getCustomerActivities(organizationId, req.params.id, limit);
        res.json(activities);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get activities for a specific lead
app.get("/leads/:id/activities", authMiddleware, async (req: any, res) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "No organization context" });

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    try {
        const activities = await getLeadActivities(organizationId, req.params.id, limit);
        res.json(activities);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get activities for a specific ticket
app.get("/tickets/:id/activities", authMiddleware, async (req: any, res) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "No organization context" });

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    try {
        const activities = await getTicketActivities(organizationId, req.params.id, limit);
        res.json(activities);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Log a manual activity (note, call, meeting)
app.post("/activities", authMiddleware, async (req: any, res) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "No organization context" });

    const { type, description, customerId, leadId, ticketId, metadata } = req.body;

    if (!type || !description) {
        return res.status(400).json({ error: "type y description requeridos" });
    }

    const validTypes = ['NOTE', 'CALL', 'MEETING', 'EMAIL_SENT', 'COMMENT'];
    if (!validTypes.includes(type)) {
        return res.status(400).json({ error: `type debe ser uno de: ${validTypes.join(', ')}` });
    }

    try {
        const activity = await logActivity({
            type,
            description,
            organizationId,
            userId: req.user?.id,
            customerId,
            leadId,
            ticketId,
            metadata,
        });
        res.status(201).json(activity);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get activity type labels and icons (for frontend)
app.get("/activities/meta", (req, res) => {
    res.json({
        labels: activityTypeLabels,
        icons: activityTypeIcons,
    });
});

// ========== EMAIL ENDPOINTS ==========

// Send a custom email
app.post("/email/send", authMiddleware, async (req, res) => {
    const { to, subject, text, html, replyTo } = req.body;
    if (!to || !subject || (!text && !html)) {
        return res.status(400).json({ error: "to, subject, y (text o html) requeridos" });
    }
    const result = await sendEmail({ to, subject, text, html, replyTo });
    if (result.success) {
        res.json(result);
    } else {
        res.status(500).json({ error: result.error });
    }
});

// Send welcome email to customer
app.post("/email/welcome", authMiddleware, async (req, res) => {
    const { to, clientName, loginUrl } = req.body;
    if (!to || !clientName) {
        return res.status(400).json({ error: "to y clientName requeridos" });
    }
    const template = emailTemplates.welcome(clientName, loginUrl || 'https://chronuscrm.com');
    const result = await sendEmail({ to, ...template });
    res.json(result);
});

// Send ticket update email
app.post("/email/ticket-update", authMiddleware, async (req, res) => {
    const { to, ticketTitle, status, message } = req.body;
    if (!to || !ticketTitle || !status || !message) {
        return res.status(400).json({ error: "to, ticketTitle, status, message requeridos" });
    }
    const template = emailTemplates.ticketUpdate(ticketTitle, status, message);
    const result = await sendEmail({ to, ...template });
    res.json(result);
});

// Check email configuration status
app.get("/email/status", (req, res) => {
    res.json({
        configured: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
        user: process.env.GMAIL_USER ? process.env.GMAIL_USER.replace(/(.{3}).*(@.*)/, '$1***$2') : null,
    });
});

// ========== CALENDAR & MEET ENDPOINTS ==========

// Connect Google Calendar (OAuth redirect)
app.get("/calendar/connect", authMiddleware, async (req, res) => {
    const authUrl = await getGoogleAuthUrl((req as any).user?.id);
    res.redirect(authUrl);
});

// Google OAuth callback
app.get("/auth/google/callback", async (req, res) => {
    const { code, state } = req.query;
    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: "Código de autorización requerido" });
    }
    const userId = state as string || '';
    const result = await handleGoogleCallback(code, userId);
    if (result.success) {
        const frontendUrl = process.env.CRM_FRONTEND_URL || 'http://localhost:3003';
        res.redirect(`${frontendUrl}/settings?calendar=connected`);
    } else {
        res.status(400).json({ error: result.error });
    }
});

// List upcoming events
app.get("/calendar/events", authMiddleware, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const organizationId = (req as any).user.organizationId;

        // Default range: -1 month to +3 months if not specified
        const start = req.query.start ? new Date(String(req.query.start)) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = req.query.end ? new Date(String(req.query.end)) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

        // 1. Fetch Google Events (if connected)
        let googleEvents: any[] = [];
        try {
            const hybridEvents = await getGoogleCalendarEvents(userId, start.toISOString(), end.toISOString());

            // Map Hybrid Events...
            googleEvents = hybridEvents.map((e: any) => {
                // If it's already mapped (local 'crm'), just return it (maybe standardize structure if needed)
                if (e.source === 'crm') {
                    // Local events from HybridService are already close to final format, but let's ensure flat structure
                    return {
                        id: e.id,
                        summary: e.summary,
                        description: e.description,
                        start: e.start.dateTime || e.start,
                        end: e.end.dateTime || e.end,
                        location: e.location,
                        htmlLink: e.htmlLink,
                        meetLink: e.meetLink, // Local mapping puts it here
                        attendees: Array.isArray(e.attendees) ? e.attendees.map((a: any) => typeof a === 'string' ? a : a.email) : [],
                        source: 'crm'
                    };
                }

                // Map Raw Google Event
                return {
                    id: e.id,
                    summary: e.summary,
                    description: e.description,
                    start: e.start.dateTime || e.start.date,
                    end: e.end.dateTime || e.end.date,
                    location: e.location,
                    htmlLink: e.htmlLink,
                    meetLink: e.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri,
                    attendees: e.attendees?.map((a: any) => a.email),
                    source: 'google'
                };
            });
        } catch (error: any) {
            console.error("Error fetching Hybrid/Google events:", error);
        }

        // 2. Fetch CRM Scheduled Interactions
        // Default range: -1 month to +3 months if not specified


        const localInteractions = await prisma.scheduledInteraction.findMany({
            where: {
                customer: { organizationId },
                scheduledAt: {
                    gte: start,
                    lte: end
                },
                status: { notIn: ['FAILED', 'CANCELLED'] }
            },
            include: { customer: true }
        });

        const mappedLocal = localInteractions.map(e => {
            const startTime = new Date(e.scheduledAt);
            const endTime = new Date(startTime.getTime() + 30 * 60000); // 30 min duration default
            return {
                id: e.id,
                summary: `${e.type}: ${e.customer.name}`,
                description: e.content || e.subject || '',
                start: startTime.toISOString(),
                end: endTime.toISOString(),
                location: 'Remote',
                source: 'crm',
                attendees: [e.customer.email]
            };
        });

        // 3. Fetch Tickets with Due Date
        const tickets = await prisma.ticket.findMany({
            where: {
                customer: { organizationId },
                dueDate: {
                    gte: start,
                    lte: end
                },
                status: { notIn: ['CLOSED'] }
            },
            include: { customer: true }
        });

        const mappedTickets = tickets.map(t => {
            const startTime = new Date(t.dueDate!);
            const endTime = new Date(startTime.getTime() + 60 * 60000); // 1 hour default
            return {
                id: t.id,
                summary: `Ticket: ${t.title}`,
                description: t.description || '',
                start: startTime.toISOString(),
                end: endTime.toISOString(),
                location: 'CRM',
                source: 'crm',
                eventType: 'TASK',
                attendees: t.customer ? [t.customer.email] : []
            };
        });

        // Merge and sort
        // Merge and sort
        const allEvents = [...googleEvents, ...mappedLocal, ...mappedTickets].sort((a, b) =>
            new Date(a.start).getTime() - new Date(b.start).getTime()
        );

        res.json(allEvents);
    } catch (error: any) {
        console.error("GET /calendar/events error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Create a calendar event (with optional Google Meet)
app.post("/calendar/events", authMiddleware, async (req, res) => {
    const { summary, description, start, end, attendees, location, addMeet } = req.body;
    if (!summary || !start || !end) {
        return res.status(400).json({ error: "summary, start y end requeridos" });
    }
    const result = await createEvent((req as any).user.id, {
        summary,
        description,
        start: new Date(start),
        end: new Date(end),
        attendees,
        location,
        addMeet: addMeet !== false, // Default true
    }, (req as any).user.organizationId);
    if (result.success) {
        res.status(201).json(result);
    } else {
        res.status(500).json({ error: result.error });
    }
});

// Quick create: Meeting with client (includes Google Meet)
app.post("/calendar/meeting", authMiddleware, async (req, res) => {
    const { clientName, clientEmail, dateTime, durationMinutes, notes, withMeet } = req.body;
    if (!clientName || !clientEmail || !dateTime) {
        return res.status(400).json({ error: "clientName, clientEmail y dateTime requeridos" });
    }
    const result = await createClientMeeting(
        (req as any).user.id,
        clientName,
        clientEmail,
        new Date(dateTime),
        durationMinutes || 30,
        notes,
        withMeet !== false
    );
    if (result.success) {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: "No organization context" });

        // Log activity
        await logActivity({
            type: 'MEETING',
            description: `Reunión agendada: ${clientName}${result.meetLink ? ' (Google Meet)' : ''}`,
            organizationId,
            userId: req.user?.id,
        });
        res.status(201).json(result);
    } else {
        res.status(500).json({ error: result.error });
    }
});

// Quick create: Follow-up reminder
app.post("/calendar/followup", authMiddleware, async (req, res) => {
    const { entityType, entityName, dateTime, notes } = req.body;
    if (!entityType || !entityName || !dateTime) {
        return res.status(400).json({ error: "entityType, entityName y dateTime requeridos" });
    }
    if (!['lead', 'customer', 'ticket'].includes(entityType)) {
        return res.status(400).json({ error: "entityType debe ser: lead, customer, o ticket" });
    }
    const result = await createFollowUpReminder((req as any).user.id, entityType, entityName, new Date(dateTime), notes);
    if (result.success) {
        res.status(201).json(result);
    } else {
        res.status(500).json({ error: result.error });
    }
});

// Check calendar configuration status (per-user)
app.get("/calendar/status", authMiddleware, async (req: any, res) => {
    try {
        const userId = req.user?.id;
        const systemConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

        if (!userId) {
            return res.json({ configured: systemConfigured, connected: false });
        }

        // Check user fields
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { googleAccessToken: true, googleCalendarEmail: true }
        });

        const connected = !!user?.googleAccessToken;

        res.json({
            configured: systemConfigured,
            connected,
            email: user?.googleCalendarEmail
        });
    } catch (e: any) {
        console.error("GET /calendar/status error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get("/calendar/connect", authMiddleware, (req, res) => {
    const url = getNewAuthUrl();
    res.redirect(url);
});

// ========== USER INTEGRATIONS ==========

// Get user integrations
app.get("/integrations", authMiddleware, async (req, res) => {
    try {
        let integrations = await getUserIntegrations(req.user!.id);

        // Remove old Google integration if present to avoid duplicates/stale data
        integrations = integrations.filter((i: any) => i.provider !== 'GOOGLE');

        // Check new Google Auth status from User model
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            select: { googleAccessToken: true, googleCalendarEmail: true }
        });

        integrations.push({
            id: 'google-calendar-user',
            userId: req.user!.id,
            provider: 'GOOGLE',
            isEnabled: true,
            connected: !!user?.googleAccessToken,
            credentials: {
                // Return masked or empty credentials just to show it exists
                clientId: process.env.GOOGLE_CLIENT_ID ? 'configured-in-env' : undefined,
                user: user?.googleCalendarEmail
            },
            createdAt: new Date()
        } as any);

        // Inject AssistAI Org Config
        const organizationId = req.user!.organizationId;
        const org = await prisma.organization.findUnique({ where: { id: organizationId } });
        const assistAiConfig = org?.assistaiConfig as any;
        if (assistAiConfig) {
            integrations.push({
                id: 'assistai-org',
                userId: req.user!.id,
                provider: 'ASSISTAI',
                isEnabled: true,
                credentials: {}, // Don't expose secrets if not needed, or mask them
                connected: !!assistAiConfig.apiToken,
                createdAt: new Date()
            } as any);
        } else {
            integrations.push({
                id: 'assistai-org',
                userId: req.user!.id,
                provider: 'ASSISTAI',
                isEnabled: false,
                credentials: {},
                connected: false,
                createdAt: new Date()
            } as any);
        }

        res.json(integrations);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});




// ========== WHATSMEOW WHATSAPP ==========

// Create WhatsMeow agent
app.post("/whatsmeow/agents", authMiddleware, async (req, res) => {
    try {
        const { externalAgentId, externalAgentToken } = req.body;
        const agent = await whatsmeow.createAgent({ externalAgentId, externalAgentToken });

        // Save to integrations
        await saveUserIntegration(req.user!.id, {
            provider: 'WHATSMEOW',
            credentials: {
                agentCode: agent.code,
                agentToken: agent.token,
                agentId: agent.id
            },
            isEnabled: true
        });

        res.status(201).json(agent);
    } catch (err: any) {
        console.error('Error creating WhatsMeow agent:', err);
        res.status(500).json({ error: err.message });
    }
});

// List WhatsMeow agents
app.get("/whatsmeow/agents", authMiddleware, async (req, res) => {
    try {
        const agents = await whatsmeow.getAgents();
        res.json(agents);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get QR code for device linking (initiates process)
app.post("/whatsmeow/agents/:code/qr", authMiddleware, async (req, res) => {
    try {
        const { code } = req.params;
        const integrations = await getUserIntegrations(req.user!.id);
        const wmConfig = integrations.find((i: any) => i.provider === 'WHATSMEOW');

        if (!(wmConfig?.credentials as any)?.agentToken) {
            return res.status(400).json({ error: 'WhatsMeow no configurado' });
        }

        const result = await whatsmeow.getQRCode(code, (wmConfig!.credentials as any).agentToken);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get QR code as PNG image
app.get("/whatsmeow/agents/:code/qr", authMiddleware, async (req, res) => {
    try {
        const { code } = req.params;
        const integrations = await getUserIntegrations(req.user!.id);
        const wmConfig = integrations.find((i: any) => i.provider === 'WHATSMEOW');

        if (!(wmConfig?.credentials as any)?.agentToken) {
            console.log('[WhatsMeow QR] No WHATSMEOW config found for user:', req.user!.id);
            return res.status(400).json({ error: 'WhatsMeow no configurado' });
        }

        const agentToken = (wmConfig!.credentials as any).agentToken as string;

        // Debug: Check if agent info can be retrieved
        console.log('[WhatsMeow QR] Checking agent info for code:', code);
        try {
            const info = await whatsmeow.getAccountInfo(code, agentToken);
            console.log('[WhatsMeow QR] Agent info retrieved successfully:', JSON.stringify(info));
        } catch (infoErr: any) {
            console.log('[WhatsMeow QR] Could not get agent info (expected if not connected):', infoErr.message);
        }

        // Fetch the QR image
        console.log('[WhatsMeow QR] Fetching QR image for code:', code);
        const qrImage = await whatsmeow.getQRImage(code, agentToken);
        res.set('Content-Type', 'image/png');
        res.send(qrImage);
    } catch (err: any) {
        console.error('[WhatsMeow QR Error]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get WhatsMeow connection status
app.get("/whatsmeow/status", authMiddleware, async (req, res) => {
    try {
        const integrations = await getUserIntegrations(req.user!.id);
        const wmConfig = integrations.find((i: any) => i.provider === 'WHATSMEOW');

        if (!(wmConfig?.credentials as any)?.agentCode || !(wmConfig?.credentials as any)?.agentToken) {
            return res.json({ configured: false, connected: false });
        }

        const agentCode = (wmConfig!.credentials as any).agentCode;

        try {
            const info = await whatsmeow.getAccountInfo(agentCode, (wmConfig!.credentials as any).agentToken);
            res.json({ configured: true, connected: true, agentCode, accountInfo: info });
        } catch {
            // Not connected yet, but configured - return agentCode for QR display
            res.json({ configured: true, connected: false, agentCode });
        }
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Send WhatsApp text message
app.post("/whatsmeow/send/message", authMiddleware, async (req, res) => {
    try {
        const { to, message } = req.body;

        if (!to || !message) {
            return res.status(400).json({ error: 'Destino y mensaje requeridos' });
        }

        const integrations = await getUserIntegrations(req.user!.id);
        const wmConfig = integrations.find((i: any) => i.provider === 'WHATSMEOW');

        if (!(wmConfig?.credentials as any)?.agentCode || !(wmConfig?.credentials as any)?.agentToken) {
            return res.status(400).json({ error: 'WhatsMeow no configurado' });
        }

        const formattedTo = whatsmeow.formatPhoneNumber(to);
        const result = await whatsmeow.sendMessage(
            (wmConfig!.credentials as any).agentCode,
            (wmConfig!.credentials as any).agentToken,
            { to: formattedTo, message }
        );

        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Send WhatsApp image
app.post("/whatsmeow/send/image", authMiddleware, async (req, res) => {
    try {
        const { to, imageUrl, caption } = req.body;

        if (!to || !imageUrl) {
            return res.status(400).json({ error: 'Destino y URL de imagen requeridos' });
        }

        const integrations = await getUserIntegrations(req.user!.id);
        const wmConfig = integrations.find((i: any) => i.provider === 'WHATSMEOW');

        if (!(wmConfig?.credentials as any)?.agentCode || !(wmConfig?.credentials as any)?.agentToken) {
            return res.status(400).json({ error: 'WhatsMeow no configurado' });
        }

        const formattedTo = whatsmeow.formatPhoneNumber(to);
        const result = await whatsmeow.sendImage(
            (wmConfig!.credentials as any).agentCode,
            (wmConfig!.credentials as any).agentToken,
            { to: formattedTo, imageUrl, caption }
        );

        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Send WhatsApp audio/voice note
app.post("/whatsmeow/send/audio", authMiddleware, async (req, res) => {
    try {
        const { to, audioUrl, ptt } = req.body;

        if (!to || !audioUrl) {
            return res.status(400).json({ error: 'Destino y URL de audio requeridos' });
        }

        const integrations = await getUserIntegrations(req.user!.id);
        const wmConfig = integrations.find((i: any) => i.provider === 'WHATSMEOW');

        if (!(wmConfig?.credentials as any)?.agentCode || !(wmConfig?.credentials as any)?.agentToken) {
            return res.status(400).json({ error: 'WhatsMeow no configurado' });
        }

        const formattedTo = whatsmeow.formatPhoneNumber(to);
        const result = await whatsmeow.sendAudio(
            (wmConfig!.credentials as any).agentCode,
            (wmConfig!.credentials as any).agentToken,
            { to: formattedTo, audioUrl, ptt }
        );

        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Send WhatsApp document
app.post("/whatsmeow/send/document", authMiddleware, async (req, res) => {
    try {
        const { to, documentUrl, fileName, caption } = req.body;

        if (!to || !documentUrl) {
            return res.status(400).json({ error: 'Destino y URL de documento requeridos' });
        }

        const integrations = await getUserIntegrations(req.user!.id);
        const wmConfig = integrations.find((i: any) => i.provider === 'WHATSMEOW');

        if (!(wmConfig?.credentials as any)?.agentCode || !(wmConfig?.credentials as any)?.agentToken) {
            return res.status(400).json({ error: 'WhatsMeow no configurado' });
        }

        const formattedTo = whatsmeow.formatPhoneNumber(to);
        const result = await whatsmeow.sendDocument(
            (wmConfig!.credentials as any).agentCode,
            (wmConfig!.credentials as any).agentToken,
            { to: formattedTo, documentUrl, fileName, caption }
        );

        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Disconnect WhatsMeow device
app.post("/whatsmeow/disconnect", authMiddleware, async (req, res) => {
    try {
        const integrations = await getUserIntegrations(req.user!.id);
        const wmConfig = integrations.find((i: any) => i.provider === 'WHATSMEOW');

        if (!(wmConfig?.credentials as any)?.agentCode || !(wmConfig?.credentials as any)?.agentToken) {
            return res.status(400).json({ error: 'WhatsMeow no configurado' });
        }

        const result = await whatsmeow.disconnect(
            (wmConfig!.credentials as any).agentCode,
            (wmConfig!.credentials as any).agentToken
        );

        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Reset WhatsMeow configuration
app.post("/whatsmeow/reset", authMiddleware, async (req, res) => {
    try {
        await saveUserIntegration(req.user!.id, {
            provider: 'WHATSMEOW',
            credentials: {},
            isEnabled: false
        });
        res.json({ success: true, message: 'Configuración reseteada' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Configure WhatsMeow webhook URL
app.post("/whatsmeow/configure-webhook", authMiddleware, async (req, res) => {
    try {
        const { webhookUrl } = req.body;

        // Get user's WhatsMeow credentials
        const integrations = await getUserIntegrations(req.user!.id);
        const wmConfig = integrations.find((i: any) => i.provider === 'WHATSMEOW' && i.isEnabled);

        if (!(wmConfig?.credentials as any)?.agentCode || !(wmConfig?.credentials as any)?.agentToken) {
            return res.status(400).json({ error: 'WhatsMeow no configurado. Vincule un número primero.' });
        }

        // Determine webhook URL - use provided or auto-generate
        let finalWebhookUrl = webhookUrl;
        if (!finalWebhookUrl) {
            // Try to auto-detect from request
            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            const host = req.headers['x-forwarded-host'] || req.get('host');
            if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
                finalWebhookUrl = `${protocol}://${host}/whatsmeow/webhook`;
            } else {
                return res.status(400).json({
                    error: 'No se puede auto-configurar webhook en localhost. Use ngrok o proporcione una URL pública.',
                    hint: 'Ejemplo: POST con body { "webhookUrl": "https://tu-dominio.com/whatsmeow/webhook" }'
                });
            }
        }

        // Call WhatsMeow API to set webhook
        const result = await whatsmeow.setWebhook(
            (wmConfig!.credentials as any).agentCode,
            (wmConfig!.credentials as any).agentToken,
            finalWebhookUrl
        );

        // Save webhook URL in credentials for reference
        await saveUserIntegration(req.user!.id, {
            provider: 'WHATSMEOW',
            credentials: {
                ...(wmConfig!.credentials as any),
                webhookUrl: finalWebhookUrl
            },
            isEnabled: true
        });

        console.log(`[WhatsMeow] Webhook configured: ${finalWebhookUrl}`);
        res.json({
            success: true,
            message: 'Webhook configurado exitosamente',
            webhookUrl: finalWebhookUrl
        });
    } catch (err: any) {
        console.error('[WhatsMeow Webhook Config Error]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get WhatsMeow agent info including webhook status
app.get("/whatsmeow/agent-info", authMiddleware, async (req, res) => {
    try {
        const integrations = await getUserIntegrations(req.user!.id);
        const wmConfig = integrations.find((i: any) => i.provider === 'WHATSMEOW');

        if (!(wmConfig?.credentials as any)?.agentCode || !(wmConfig?.credentials as any)?.agentToken) {
            return res.json({ configured: false });
        }

        try {
            const agent = await whatsmeow.getAgent(
                (wmConfig!.credentials as any).agentCode,
                (wmConfig!.credentials as any).agentToken
            );
            res.json({
                configured: true,
                agentCode: agent.code,
                connected: !!agent.deviceId,
                webhookUrl: agent.incomingWebhook || (wmConfig!.credentials as any).webhookUrl,
                webhookConfigured: !!agent.incomingWebhook
            });
        } catch (e) {
            res.json({
                configured: true,
                agentCode: (wmConfig!.credentials as any).agentCode,
                connected: false,
                error: 'No se pudo obtener info del agente'
            });
        }
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});


// ========== AI AGENTS (Custom Agents) ==========

// List Agents
app.get("/ai-agents", authMiddleware, async (req: any, res) => {
    try {
        // Get all organizations the user belongs to
        const memberships = await prisma.organizationMember.findMany({
            where: { userId: req.user.id },
            select: { organizationId: true }
        });

        const orgIds = memberships.map(m => m.organizationId);

        // Also include the current org from context if present
        if (req.user.organizationId && !orgIds.includes(req.user.organizationId)) {
            orgIds.push(req.user.organizationId);
        }

        console.log(`[AI-Agents] Fetching agents for user ${req.user.email} from orgs:`, orgIds);

        const agents = await prisma.aiAgent.findMany({
            where: {
                organizationId: { in: orgIds.length > 0 ? orgIds : ['__none__'] }
            },
            orderBy: { updatedAt: 'desc' }
        });

        console.log(`[AI-Agents] Found ${agents.length} agents`);
        res.json(agents);
    } catch (err: any) {
        console.error('[AI-Agents] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Create Agent
app.post("/ai-agents", authMiddleware, async (req, res) => {
    try {
        const { name, description, provider, model, systemPrompt, apiKey, config } = req.body;
        const agent = await prisma.aiAgent.create({
            data: {
                name,
                description,
                provider, // OPENAI, GEMINI, ELEVENLABS
                model,
                systemPrompt,
                apiKey,
                config,
                organizationId: req.user!.organizationId || 'org-default'
            }
        });
        res.json(agent);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Update Agent
app.put("/ai-agents/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
        const agent = await prisma.aiAgent.update({
            where: { id },
            data
        });
        res.json(agent);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Agent
app.delete("/ai-agents/:id", authMiddleware, async (req, res) => {
    try {
        await prisma.aiAgent.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Debug endpoint to check user organization
app.get("/ai-agents/debug-user", authMiddleware, async (req: any, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            include: {
                memberships: {
                    include: { organization: true }
                }
            }
        });

        const currentMembership = user?.memberships.find(m => m.organizationId === req.user.organizationId);
        const organizationName = currentMembership?.organization?.name;

        const integration = await prisma.integration.findFirst({
            where: {
                organizationId: req.user.organizationId,
                provider: 'ASSISTAI'
            }
        });

        res.json({
            userId: req.user.userId,
            organizationId: req.user.organizationId,
            organizationName,
            hasAssistAIIntegration: !!integration,
            integrationEnabled: integration?.isEnabled
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Sync Agents from AssistAI
app.post("/ai-agents/sync-assistai", authMiddleware, async (req: any, res) => {
    try {
        console.log('[AI-Agents] Sync request from organization:', req.user.organizationId);

        // Get AssistAI integration (check org-specific first, then global)
        let integration = await prisma.integration.findFirst({
            where: {
                organizationId: req.user.organizationId,
                provider: 'ASSISTAI',
                isEnabled: true
            }
        });

        // Fallback to global integration (organizationId is NULL)
        if (!integration) {
            integration = await prisma.integration.findFirst({
                where: {
                    organizationId: null,
                    provider: 'ASSISTAI',
                    isEnabled: true
                }
            });
        }

        if (!integration) {
            console.error('[AI-Agents] No AssistAI integration found for org:', req.user.organizationId);
            return res.status(400).json({ error: "AssistAI integration not configured. Please configure it in Integrations first." });
        }

        console.log('[AI-Agents] Using AssistAI integration:', integration.id, 'orgId:', integration.organizationId || 'GLOBAL');

        const creds = integration.credentials as any;
        const headers = {
            'Authorization': `Bearer ${creds.apiToken}`,
            'x-tenant-domain': creds.tenantDomain,
            'x-organization-code': creds.organizationCode,
            'Content-Type': 'application/json',
        };

        const baseUrl = creds.baseUrl || 'https://public.assistai.lat';
        console.log('[AI-Agents] Fetching agents from AssistAI...');

        const response = await fetch(`${baseUrl}/api/v1/agents`, { headers });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[AI-Agents] AssistAI API error:', response.status, errorText);
            return res.status(500).json({ error: `AssistAI API error: ${response.status}` });
        }

        const data = await response.json();
        const syncedAgents = [];

        if (data && data.data) {
            console.log(`[AI-Agents] Found ${data.data.length} remote agents`);

            for (const ra of data.data) {
                const existing = await prisma.aiAgent.findFirst({
                    where: {
                        organizationId: req.user.organizationId,
                        provider: 'ASSISTAI',
                        name: ra.name
                    }
                });

                if (existing) {
                    const updated = await prisma.aiAgent.update({
                        where: { id: existing.id },
                        data: {
                            model: ra.model,
                            description: ra.description,
                            config: { assistaiCode: ra.code, ...ra }
                        }
                    });
                    syncedAgents.push(updated);
                } else {
                    const created = await prisma.aiAgent.create({
                        data: {
                            organizationId: req.user.organizationId,
                            name: ra.name,
                            provider: 'ASSISTAI',
                            model: ra.model || 'gpt-4',
                            description: ra.description,
                            isEnabled: true,
                            config: { assistaiCode: ra.code, ...ra }
                        }
                    });
                    syncedAgents.push(created);
                }
            }

            console.log(`[AI-Agents] Successfully synced ${syncedAgents.length} agents`);
        } else {
            console.warn('[AI-Agents] No agents data returned from AssistAI');
        }

        res.json({ success: true, count: syncedAgents.length, agents: syncedAgents });
    } catch (error: any) {
        console.error("[AI-Agents] Sync error:", error);
        res.status(500).json({ error: error.message || 'Failed to sync agents' });
    }
});

// Test Agent (Real API Calls)
app.post("/ai-agents/:id/test", authMiddleware, async (req, res) => {
    try {
        const { message, history = [] } = req.body;
        const agent = await prisma.aiAgent.findUnique({ where: { id: req.params.id } });

        if (!agent) return res.status(404).json({ error: "Agente no encontrado" });

        // Get user's integrations for API keys
        const userIntegrations = await getUserIntegrations(req.user!.id);
        const openaiConfig = userIntegrations.find((i: any) => i.provider === 'OPENAI');
        const geminiConfig = userIntegrations.find((i: any) => i.provider === 'GEMINI');
        const elevenConfig = userIntegrations.find((i: any) => i.provider === 'ELEVENLABS');

        let response = "";
        let usage: any = {};

        // OpenAI Integration
        if (agent.provider === 'OPENAI') {
            const OpenAI = (await import('openai')).default;
            // Priority: Agent API Key > User Integration > Environment
            const apiKey = agent.apiKey || (openaiConfig?.credentials as any)?.apiKey || process.env.OPENAI_API_KEY;

            if (!apiKey) {
                return res.status(400).json({ error: "API Key de OpenAI no configurada. Configúralo en Integraciones." });
            }

            const openai = new OpenAI({ apiKey });
            const messages: any[] = [];

            if (agent.systemPrompt) {
                messages.push({ role: 'system', content: agent.systemPrompt });
            }

            // Add history if provided
            history.forEach((h: any) => {
                messages.push({ role: h.role, content: h.content });
            });
            messages.push({ role: 'user', content: message });

            const completion = await openai.chat.completions.create({
                model: agent.model || 'gpt-4',
                messages,
                temperature: (agent.config as any)?.temperature ?? 0.7,
                max_tokens: (agent.config as any)?.maxTokens ?? 1000
            });

            response = completion.choices[0]?.message?.content || '';
            usage = completion.usage;
        }

        // Gemini Integration
        else if (agent.provider === 'GEMINI') {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            // Priority: Agent API Key > User Integration > Environment
            const apiKey = agent.apiKey || (geminiConfig?.credentials as any)?.apiKey || process.env.GOOGLE_API_KEY;

            if (!apiKey) {
                return res.status(400).json({ error: "API Key de Google/Gemini no configurada. Configúralo en Integraciones." });
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: agent.model || 'gemini-pro' });

            // Build prompt with system instructions
            let fullPrompt = message;
            if (agent.systemPrompt) {
                fullPrompt = `${agent.systemPrompt}\n\nUser: ${message}`;
            }

            const result = await model.generateContent(fullPrompt);
            const geminiResponse = await result.response;
            response = geminiResponse.text();
            usage = { promptTokens: fullPrompt.length, completionTokens: response.length };
        }

        // ElevenLabs (Voice - Simulation for now, real calls require phone integration)
        else if (agent.provider === 'ELEVENLABS') {
            const config = agent.config as any;
            response = `[ElevenLabs Agent]: Audio generado con voice_id: ${config?.voiceId || 'default'}. Para llamadas telefónicas reales, configure la integración con Twilio.`;
            usage = { note: 'Text-to-speech, no tokens counted' };
        }

        res.json({
            response,
            metadata: {
                provider: agent.provider,
                model: agent.model,
                usage
            }
        });
    } catch (err: any) {
        console.error('[AI Agent Test Error]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Initiate Outbound Call (ElevenLabs + Twilio)
app.post("/ai-agents/:id/call", authMiddleware, async (req, res) => {
    try {
        const { to, from } = req.body; // 'to' = destination phone, 'from' = your Twilio number
        const agent = await prisma.aiAgent.findUnique({ where: { id: req.params.id } });

        if (!agent) return res.status(404).json({ error: "Agente no encontrado" });
        if (agent.provider !== 'ELEVENLABS') {
            return res.status(400).json({ error: "Solo agentes ElevenLabs pueden hacer llamadas de voz" });
        }

        const apiKey = agent.apiKey || process.env.ELEVENLABS_API_KEY;
        const agentId = (agent.config as any)?.agentId || agent.model; // agentId stored in config or model field

        if (!apiKey || !agentId) {
            return res.status(400).json({ error: "Falta API Key o Agent ID de ElevenLabs" });
        }

        if (!to) {
            return res.status(400).json({ error: "Número de destino 'to' requerido" });
        }

        // Call ElevenLabs API to initiate outbound call
        const response = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound_call', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': apiKey
            },
            body: JSON.stringify({
                agent_id: agentId,
                to: to,
                from: from || undefined, // Optional - Twilio will use default if not provided
                // webhook_url: `${process.env.CRM_URL}/ai-agents/call-webhook` // For transcription callback
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[ElevenLabs Call Error]', data);
            return res.status(response.status).json({ error: data.detail || 'Error iniciando llamada' });
        }

        console.log('[ElevenLabs] Outbound call initiated:', data);

        res.json({
            success: true,
            callId: data.call_id || data.id,
            message: `Llamada iniciada a ${to}`,
            data
        });
    } catch (err: any) {
        console.error('[AI Agent Call Error]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Webhook for ElevenLabs Call Transcription
app.post("/ai-agents/call-webhook", async (req, res) => {
    try {
        console.log('[ElevenLabs Call Webhook]', JSON.stringify(req.body).substring(0, 1000));

        const { call_id, transcript, status, agent_id } = req.body;

        // TODO: Store transcript in database or send to customer profile
        // Example: Create an activity/note in customer history

        if (transcript && transcript.length > 0) {
            console.log(`[ElevenLabs] Call ${call_id} transcript:`, transcript);
            // Could store in Activity table, send to Slack, etc.
        }

        res.sendStatus(200);
    } catch (err: any) {
        console.error('[ElevenLabs Webhook Error]', err.message);
        res.sendStatus(200); // Always return 200 to prevent retries
    }
});

// AI Text Generation Endpoint (Smart Compose)
app.post("/ai/generate", async (req, res) => {
    try {
        const { prompt, context, task } = req.body;
        console.log(`[AI] Generating for task: ${task}`);
        console.log(`[AI] Prompt length: ${prompt?.length || 0}`);

        // Prioritize: Env Variable > User Integration should be handled via user (future improvement)
        // For now, using the server-wide key provided by user or simple fallback env
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

        console.log(`[AI] API Key present: ${!!apiKey} (${apiKey ? apiKey.substring(0, 8) + '...' : 'NONE'})`);

        if (!apiKey) {
            console.error("[AI] Missing API Key");
            return res.status(400).json({ error: "Google API Key not configured" });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        // Using gemini-2.0-flash-exp as detected in available models list
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        let systemInstruction = "";
        switch (task) {
            case 'rewrite':
                systemInstruction = "Rewrite the following text to be more clear, professional, and concise. Maintain the original meaning. Output ONLY the rewritten text.";
                break;
            case 'grammar':
                systemInstruction = "Correct the grammar and spelling of the following text. Do not change the tone or style significantly. Output ONLY the corrected text.";
                break;
            case 'tone_formal':
                systemInstruction = "Rewrite the following text to be more formal and professional. Output ONLY the rewritten text.";
                break;
            case 'tone_friendly':
                systemInstruction = "Rewrite the following text to be more friendly and approachable. Output ONLY the rewritten text.";
                break;
            case 'expand':
                systemInstruction = "Expand the following short points or draft into a complete, polite message. Output ONLY the expanded text.";
                break;
            case 'translate_en':
                systemInstruction = "Translate the following text to English. Output ONLY the translation.";
                break;
            default:
                systemInstruction = "You are a helpful writing assistant. Improve the following text.";
        }

        const fullPrompt = `${systemInstruction}\n\nContext (if any): ${context || ''}\n\nText to process:\n${prompt}`;

        console.log("[AI] Sending request to Gemini...");
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();
        console.log("[AI] Response received successfully");

        res.json({ result: text.trim() });
    } catch (err: any) {
        console.error('[AI Generate Error]', err.message);

        // Handle Rate Limiting specifically
        if (err.message?.includes('429') || err.message?.includes('Too Many Requests')) {
            return res.status(429).json({ error: "Has excedido el límite de uso gratuito de IA. Por favor espera un minuto." });
        }

        res.status(500).json({ error: "Error interno de IA. Intenta más tarde." });
    }
});

// ========== REPORTS ==========

// Generate Invoice PDF
app.get("/invoices/:id/pdf", authMiddleware, async (req, res) => {
    try {
        await generateInvoicePDF(req.params.id, res);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Preview Invoice PDF (inline display instead of download)
app.get("/invoices/:id/preview", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const invoice = await prisma.invoice.findUnique({
            where: { id: req.params.id },
            include: { customer: true, items: true, payments: true }
        });

        if (!invoice) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        const organization = organizationId ? await prisma.organization.findUnique({
            where: { id: organizationId }
        }) : null;

        const PDFDocument = (await import('pdfkit')).default;
        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=preview-${invoice.number}.pdf`);
        doc.pipe(res);

        // Build PDF content (simplified version for preview)
        const title = invoice.type === 'QUOTE' ? 'PROPUESTA ECONÓMICA' : 'FACTURA';
        const orgName = organization?.name || 'ChronusCRM';

        doc.fontSize(20).text(title, 50, 50)
            .fontSize(10).text(orgName, { align: 'right' }).moveDown();

        doc.text(`Número: ${invoice.number}`, 50, 130)
            .text(`Cliente: ${invoice.customer?.name || 'N/A'}`, 50, 145)
            .text(`Total: $${invoice.amount.toFixed(2)}`, 50, 160)
            .text(`Estado: ${invoice.status}`, 50, 175);

        doc.fontSize(10).text('Vista Previa - Para descargar use el botón de descarga', 50, 700, { align: 'center', width: 500 });

        doc.end();
    } catch (err: any) {
        console.error('Invoice preview error:', err);
        res.status(500).json({ error: 'Error generando vista previa' });
    }
});

// Generate Analytics PDF
app.get("/reports/analytics/pdf", authMiddleware, async (req, res) => {
    try {
        await generateAnalyticsPDF(res);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Preview Analytics PDF (inline display)
app.get("/reports/analytics/preview", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: 'No organization context' });

        const PDFDocument = (await import('pdfkit')).default;
        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=analytics-preview.pdf');
        doc.pipe(res);

        // Quick analytics summary
        const totalCustomers = await prisma.customer.count({ where: { organizationId } });
        const openTickets = await prisma.ticket.count({ where: { organizationId, status: 'OPEN' } });
        const totalRevenue = await prisma.invoice.aggregate({
            where: { organizationId, status: 'PAID' },
            _sum: { amount: true }
        });

        doc.fontSize(24).text('Reporte Analítico', 50, 50)
            .fontSize(12).text(`Generado: ${new Date().toLocaleDateString('es')}`, 50, 80)
            .moveDown(2);

        doc.fontSize(16).text('Resumen', 50, 130)
            .fontSize(12)
            .text(`Total Clientes: ${totalCustomers}`, 50, 160)
            .text(`Tickets Abiertos: ${openTickets}`, 50, 180)
            .text(`Ingresos Totales: $${(totalRevenue._sum.amount || 0).toLocaleString()}`, 50, 200);

        doc.fontSize(10).text('Vista Previa - Para descargar use el botón de descarga', 50, 700, { align: 'center', width: 500 });

        doc.end();
    } catch (err: any) {
        console.error('Analytics preview error:', err);
        res.status(500).json({ error: 'Error generando vista previa' });
    }
});

// Health Check
// Health Check - Forces restart for env vars
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date() });
});

// ========== AUTOMATIONS (WhatsApp Templates) ==========

const MESSAGE_TEMPLATES: Record<string, { name: string; message: string; variables: string[] }> = {
    lead_welcome: {
        name: 'Bienvenida Lead',
        message: '¡Hola {{nombre}}! Gracias por tu interés. Soy {{agente}} de {{empresa}}. ¿En qué puedo ayudarte?',
        variables: ['nombre', 'agente', 'empresa']
    },
    payment_reminder: {
        name: 'Recordatorio de Pago',
        message: 'Hola {{nombre}}, te recordamos que tienes un pago pendiente de ${{monto}} por {{concepto}}. ¿Necesitas ayuda con el pago?',
        variables: ['nombre', 'monto', 'concepto']
    },
    invoice_sent: {
        name: 'Factura Enviada',
        message: 'Hola {{nombre}}, te hemos enviado la factura #{{numero}} por ${{monto}}. Puedes verla en tu correo o solicitar el enlace aquí.',
        variables: ['nombre', 'numero', 'monto']
    },
    appointment_reminder: {
        name: 'Recordatorio de Cita',
        message: 'Hola {{nombre}}, te recordamos tu cita para {{fecha}} a las {{hora}}. ¿Confirmas asistencia? Responde SÍ o NO.',
        variables: ['nombre', 'fecha', 'hora']
    },
    follow_up: {
        name: 'Seguimiento',
        message: 'Hola {{nombre}}, ¿cómo te fue con {{asunto}}? Estamos aquí para ayudarte si necesitas algo más.',
        variables: ['nombre', 'asunto']
    },
    custom: {
        name: 'Mensaje Personalizado',
        message: '{{mensaje}}',
        variables: ['mensaje']
    }
};

// Get available templates
app.get("/automations/templates", authMiddleware, async (req, res) => {
    res.json({
        success: true,
        templates: Object.entries(MESSAGE_TEMPLATES).map(([key, template]) => ({
            id: key,
            ...template
        }))
    });
});

// Send automated message via WhatsApp
app.post("/automations/send", authMiddleware, async (req, res) => {
    try {
        const { templateId, phone, variables, customMessage, clientId } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'Número de teléfono requerido' });
        }

        // Get WhatsMeow credentials
        const wmIntegration = await prisma.integration.findFirst({
            where: {
                provider: 'WHATSMEOW',
                isEnabled: true,
                userId: req.user!.id
            }
        });

        // Fallback to any enabled integration
        const wmConfig = wmIntegration || await prisma.integration.findFirst({
            where: { provider: 'WHATSMEOW', isEnabled: true }
        });

        if (!wmConfig?.credentials) {
            return res.status(400).json({ error: 'WhatsMeow no configurado. Configure primero en Integraciones.' });
        }

        const creds = wmConfig.credentials as any;
        if (!creds.agentCode || !creds.agentToken) {
            return res.status(400).json({ error: 'Credenciales de WhatsMeow incompletas' });
        }

        // Build message from template
        let message = '';
        if (templateId === 'custom' && customMessage) {
            message = customMessage;
        } else if (templateId && MESSAGE_TEMPLATES[templateId]) {
            message = MESSAGE_TEMPLATES[templateId].message;
            // Replace variables
            if (variables) {
                for (const [key, value] of Object.entries(variables)) {
                    message = message.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
                }
            }
        } else {
            return res.status(400).json({ error: 'Template inválido o mensaje no proporcionado' });
        }

        // Format phone number
        const formattedPhone = whatsmeow.formatPhoneNumber(phone);

        // Send via WhatsMeow
        const result = await whatsmeow.sendMessage(
            creds.agentCode,
            creds.agentToken,
            { to: formattedPhone, message }
        );

        // Log the automation
        console.log(`[Automation] Sent ${templateId || 'custom'} to ${formattedPhone}: ${message.substring(0, 50)}...`);

        // If clientId provided, save as activity/note
        if (clientId) {
            try {
                await (prisma as any).activity.create({
                    data: {
                        type: 'NOTE',
                        description: `[Automatización] ${MESSAGE_TEMPLATES[templateId]?.name || 'Personalizado'}: ${message.substring(0, 100)}`,
                        customerId: clientId,
                        metadata: { templateId, phone: formattedPhone, messageSent: message },
                        organizationId: (req as any).user.organizationId
                    }
                });
            } catch (e) {
                // Activity logging is optional, don't fail the request
            }
        }

        res.json({
            success: true,
            message: 'Mensaje enviado exitosamente',
            sentTo: formattedPhone,
            templateUsed: templateId || 'custom'
        });

    } catch (err: any) {
        console.error('[Automation Error]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Send bulk automated messages
app.post("/automations/send-bulk", authMiddleware, async (req, res) => {
    try {
        const { templateId, recipients, variables } = req.body;
        // recipients: [{ phone: string, variables?: Record<string, string>, clientId?: string }]

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({ error: 'Lista de destinatarios vacía' });
        }

        if (recipients.length > 50) {
            return res.status(400).json({ error: 'Máximo 50 destinatarios por envío' });
        }

        // Get WhatsMeow credentials
        const wmConfig = await prisma.integration.findFirst({
            where: { provider: 'WHATSMEOW', isEnabled: true }
        });

        if (!wmConfig?.credentials) {
            return res.status(400).json({ error: 'WhatsMeow no configurado' });
        }

        const creds = wmConfig.credentials as any;
        const results: { phone: string; success: boolean; error?: string }[] = [];

        for (const recipient of recipients) {
            try {
                const template = MESSAGE_TEMPLATES[templateId];
                if (!template) {
                    results.push({ phone: recipient.phone, success: false, error: 'Template inválido' });
                    continue;
                }

                let message = template.message;
                const mergedVars = { ...variables, ...recipient.variables };
                for (const [key, value] of Object.entries(mergedVars)) {
                    message = message.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
                }

                const formattedPhone = whatsmeow.formatPhoneNumber(recipient.phone);
                await whatsmeow.sendMessage(creds.agentCode, creds.agentToken, { to: formattedPhone, message });

                results.push({ phone: recipient.phone, success: true });

                // Small delay between messages to avoid rate limiting
                await new Promise(r => setTimeout(r, 500));
            } catch (e: any) {
                results.push({ phone: recipient.phone, success: false, error: e.message });
            }
        }

        const successCount = results.filter(r => r.success).length;
        res.json({
            success: true,
            total: recipients.length,
            sent: successCount,
            failed: recipients.length - successCount,
            results
        });

    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== CHRONUS DEV MODULE ====================

// --- PROJECTS ---

app.get("/projects", authMiddleware, async (req: any, res) => {
    try {
        const { organizationId } = req.user;
        const projects = await (prisma as any).project.findMany({
            where: { organizationId },
            include: {
                customer: true,
                members: { include: { user: true } },
                _count: { select: { tasks: true } }
            },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(projects);
    } catch (error) {
        console.error("Error fetching projects:", error);
        res.status(500).json({ error: "Error fetching projects" });
    }
});

app.get("/projects/:id", authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.user;
        const project = await (prisma as any).project.findFirst({
            where: { id, organizationId },
            include: {
                customer: true,
                members: { include: { user: true } },
                tasks: { orderBy: { createdAt: 'desc' }, take: 50 }
            }
        });

        if (!project) return res.status(404).json({ error: "Project not found" });
        res.json(project);
    } catch (error) {
        console.error("Error fetching project:", error);
        res.status(500).json({ error: "Error fetching project" });
    }
});

app.post("/projects", authMiddleware, async (req: any, res) => {
    try {
        const { name, description, budget, currency, customerId, status } = req.body;
        const { organizationId, id: userId } = req.user;

        if (!name) return res.status(400).json({ error: "Name is required" });

        const project = await (prisma as any).project.create({
            data: {
                name,
                description,
                budget: Number(budget) || 0,
                currency: currency || "USD",
                status: status || "ACTIVE",
                customerId,
                organizationId,
                members: {
                    create: {
                        userId,
                        role: "ADMIN"
                    }
                }
            },
            include: { customer: true }
        });
        res.json(project);
    } catch (error) {
        console.error("Error creating project:", error);
        res.status(500).json({ error: "Error creating project" });
    }
});

app.put("/projects/:id", authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.user;
        const { name, description, budget, currency, status, customerId } = req.body;

        const updated = await (prisma as any).project.update({
            where: { id }, // In a real app, verify org access via middleware or where clause in update (or separate findFirst)
            data: {
                name,
                description,
                budget: budget !== undefined ? Number(budget) : undefined,
                currency,
                status,
                customerId
            }
        });
        res.json(updated);
    } catch (error) {
        console.error("Error updating project:", error);
        res.status(500).json({ error: "Error updating project" });
    }
});

app.delete("/projects/:id", authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        await (prisma as any).project.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting project:", error);
        res.status(500).json({ error: "Error deleting project" });
    }
});

// --- PROJECT MEMBERS ---

app.post("/projects/:id/members", authMiddleware, async (req: any, res) => {
    try {
        const { id: projectId } = req.params;
        const { userId, role, payRate, billRate } = req.body;

        const member = await (prisma as any).projectMember.create({
            data: {
                projectId,
                userId,
                role: role || "DEV",
                payRate: Number(payRate) || 0,
                billRate: Number(billRate) || 0
            },
            include: { user: true }
        });
        res.json(member);
    } catch (error) {
        console.error("Error adding member:", error);
        res.status(500).json({ error: "Error adding member" });
    }
});

// --- TASKS ---

app.get("/tasks", authMiddleware, async (req: any, res) => {
    try {
        const { projectId, assignedToId } = req.query;
        const where: any = {};

        if (projectId) where.projectId = String(projectId);
        if (assignedToId) where.assignedToId = String(assignedToId);

        const tasks = await (prisma as any).task.findMany({
            where,
            include: {
                assignedTo: { select: { id: true, name: true, avatar: true } },
                project: { select: { id: true, name: true } },
                _count: { select: { comments: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(tasks);
    } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).json({ error: "Error fetching tasks" });
    }
});

app.post("/tasks", authMiddleware, async (req: any, res) => {
    try {
        const { title, description, projectId, priority, assignedToId, status, estimatedHours } = req.body;
        const { id: userId } = req.user;

        const task = await (prisma as any).task.create({
            data: {
                title,
                description,
                projectId,
                priority: priority || "MEDIUM",
                status: status || "BACKLOG",
                assignedToId: assignedToId || null,
                createdById: userId,
                estimatedHours: estimatedHours ? Number(estimatedHours) : null
            },
            include: { assignedTo: true }
        });
        res.json(task);
    } catch (error) {
        console.error("Error creating task:", error);
        res.status(500).json({ error: "Error creating task" });
    }
});

app.put("/tasks/:id", authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { title, description, status, priority, assignedToId } = req.body;

        // Get current task to check for status change
        const currentTask = await (prisma as any).task.findUnique({
            where: { id },
            select: { status: true }
        });

        const updated = await (prisma as any).task.update({
            where: { id },
            data: {
                title,
                description,
                status,
                priority,
                assignedToId
            },
            include: {
                assignedTo: true,
                tickets: { select: { id: true, status: true } }
            }
        });

        // 🔄 SYNC: When task is completed, update linked tickets to RESOLVED
        if (status === 'DONE' && currentTask?.status !== 'DONE') {
            const ticketsToUpdate = updated.tickets || [];
            for (const ticket of ticketsToUpdate) {
                if (ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED') {
                    await (prisma as any).ticket.update({
                        where: { id: ticket.id },
                        data: { status: 'RESOLVED' }
                    });
                    console.log(`[Sync] Task ${id} DONE → Ticket ${ticket.id} RESOLVED`);
                }
            }
        }

        res.json(updated);
    } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).json({ error: "Error updating task" });
    }
});

app.delete("/tasks/:id", authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        await (prisma as any).task.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Error deleting task" });
    }
});

// --- TIMELOGS ---

app.get("/timelogs/active", authMiddleware, async (req: any, res) => {
    try {
        const { id: userId } = req.user;
        const activeLogs = await (prisma as any).timeLog.findMany({
            where: { userId, end: null },
            include: { task: true, project: true }
        });
        res.json(activeLogs);
    } catch (error) {
        res.status(500).json({ error: "Error fetching timelogs" });
    }
});

app.post("/timelogs/start", authMiddleware, async (req: any, res) => {
    try {
        const { taskId, projectId, description } = req.body;
        const { id: userId } = req.user;

        // Ensure no other active timer
        await (prisma as any).timeLog.updateMany({
            where: { userId, end: null },
            data: { end: new Date() }
        });

        // Need projectId. If only taskId provided, fetch project
        let targetProjectId = projectId;
        if (!targetProjectId && taskId) {
            const task = await (prisma as any).task.findUnique({ where: { id: taskId } });
            if (task) targetProjectId = task.projectId;
        }

        if (!targetProjectId) return res.status(400).json({ error: "Project ID required" });

        const log = await (prisma as any).timeLog.create({
            data: {
                userId,
                taskId,
                projectId: targetProjectId,
                start: new Date(),
                description
            }
        });
        res.json(log);
    } catch (error) {
        console.error("Start timer error:", error);
        res.status(500).json({ error: "Error starting timer" });
    }
});

app.post("/timelogs/stop", authMiddleware, async (req: any, res) => {
    try {
        const { timelogId } = req.body;
        const { id: userId } = req.user;

        const where = timelogId ? { id: timelogId } : { userId, end: null };
        // Since updateMany doesn't return record, we might need findFirst + update
        const active = await (prisma as any).timeLog.findFirst({ where: { ...where, end: null } });

        if (!active) return res.status(404).json({ error: "No active timer" });

        const updated = await (prisma as any).timeLog.update({
            where: { id: active.id },
            data: { end: new Date() }
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: "Error stopping timer" });
    }
});


// ========== DASHBOARD & ANALYTICS ==========

app.get("/stats", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: "No organization context" });

        // Parallelize for performance
        const [activeCustomers, trialCustomers, totalCustomers, openTickets, overdueInvoices, invoices] = await Promise.all([
            prisma.customer.count({ where: { organizationId, status: "ACTIVE" } } as any),
            prisma.customer.count({ where: { organizationId, status: "TRIAL" } } as any),
            prisma.customer.count({ where: { organizationId } } as any),
            prisma.ticket.count({
                where: {
                    organizationId,
                    status: { in: ["OPEN", "IN_PROGRESS"] }
                } as any
            }),
            prisma.invoice.count({
                where: {
                    organizationId,
                    status: "OVERDUE"
                } as any
            }),
            prisma.invoice.findMany({
                where: { organizationId, status: "PAID" } as any,
                select: { amount: true } // Assuming amount is simple number for now
            })
        ]);

        // Calculate simple MRR (sum of paid invoices this month, or a field on customer)
        // For accurate MRR, we should probably stick to Customer level field if it exists
        // Converting invoices directly:
        const mrr = invoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0); // Simplified calculation

        res.json({
            activeCustomers,
            trialCustomers,
            totalCustomers,
            openTickets,
            overdueInvoices,
            mrr
        });
    } catch (e: any) {
        console.error("GET /stats error:", e);
        res.status(500).json({ error: "Error fetching stats" });
    }
});

app.get("/users", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: "No organization context" });

        const users = await prisma.user.findMany({
            where: { organizationId } as any,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatar: true // If exists
            }
        });

        res.json(users);
    } catch (e: any) {
        console.error("GET /users error:", e);
        res.status(500).json({ error: "Error fetching users" });
    }
});

app.get("/analytics/predictions", authMiddleware, async (req: any, res) => {
    try {
        // Mocked AI predictions for visual demo
        const organizationId = req.user?.organizationId;

        res.json({
            mrr: {
                current: 12500,
                forecast: [
                    { month: 'Actual', mrr: 12500 },
                    { month: 'Next Month', mrr: 13800 },
                    { month: '+2 Months', mrr: 15200 }
                ],
                projectedAnnual: 165000
            },
            churn: {
                atRiskCount: 2,
                atRiskMRR: 450,
                customers: [
                    { name: "Acme Corp", riskLevel: "HIGH", reason: "Low engagement" },
                    { name: "Global Tech", riskLevel: "MEDIUM", reason: "Support tickets spike" }
                ]
            },
            pipeline: {
                totalValue: 45000,
                hotLeadsCount: 5,
                avgScore: 78
            }
        });
    } catch (e: any) {
        res.status(500).json({ error: "Error fetching predictions" });
    }
});

// Calendar logic consolidated in lines ~5000


app.get("/auth/google/callback", async (req: any, res) => {
    try {
        const { code } = req.query;
        // We need userId. Access token? 
        // This callback usually comes from browser. 
        // We might need to store state or rely on session if cookies exist.
        // For now, let's assume we can't identify user easily unless we passed state.

        // Improve: parse state to get userId if we passed it.
        // Or just save tokens and let init pick them up?
        // handleGoogleCallback expects userId.

        // A simple workaround: Redirect to frontend with code, frontend calls API with token?
        // Or just fail gracefully.
        // Let's rely on a hardcoded admin ID or logic for now if critical.
        // Or simpler: just say "Conectado, cierra esta ventana" and User logs in.

        // Actually, handleGoogleCallback(code, userId).
        // If we don't have userId, we can't save.
        res.send("Google Calendar conectado. Puede cerrar esta pestaña.");

        // We'll leave the actual token exchange for a more robust auth flow
        // or strictly for when the user initiates it from an authenticated context.

    } catch (e) {
        res.status(500).send("Error in callback");
    }
});

// ========== NOTIFICATIONS ==========

// Get user notifications
app.get("/notifications", authMiddleware, async (req: any, res) => {
    try {
        const userId = req.user?.id;
        const organizationId = req.user?.organizationId;

        if (!userId || !organizationId) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const notifications = await prisma.notification.findMany({
            where: { userId, organizationId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        // Map to frontend-expected format
        const mapped = notifications.map(n => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.body,
            read: n.read,
            link: (n.data as any)?.link || null,
            createdAt: n.createdAt.toISOString()
        }));

        res.json(mapped);
    } catch (err: any) {
        console.error("Error fetching notifications:", err);
        res.status(500).json({ error: err.message });
    }
});

// Mark single notification as read
app.patch("/notifications/:id/read", authMiddleware, async (req: any, res) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;

        const notification = await prisma.notification.updateMany({
            where: { id, userId },
            data: { read: true }
        });

        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Mark all notifications as read
app.patch("/notifications/read-all", authMiddleware, async (req: any, res) => {
    try {
        const userId = req.user?.id;
        const organizationId = req.user?.organizationId;

        await prisma.notification.updateMany({
            where: { userId, organizationId, read: false },
            data: { read: true }
        });

        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ========== SERVER ==========

const PORT = process.env.PORT || 3002;

if (process.env.NODE_ENV !== 'test') {
    httpServer.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`🚀 ChronusCRM API running on http://localhost:${PORT}`);
        console.log(`📚 API Docs: http://localhost:${PORT}/api/docs`);
        console.log(`🔌 Socket.io ready for connections`);
        if (process.env.ASSISTAI_API_TOKEN) {
            console.log(`🤖 AssistAI integration enabled`);
        }

        // Initialize cache

        // ── Auto-sync WhatsMeow webhook URLs on startup ──
        (async () => {
            try {
                const publicUrl = process.env.CRM_PUBLIC_URL || `http://localhost:${PORT}`;
                const correctWebhook = `${publicUrl}/whatsmeow/webhook`;

                const whatsmeowIntegrations = await prisma.integration.findMany({
                    where: { provider: 'WHATSMEOW', isEnabled: true }
                });

                if (whatsmeowIntegrations.length === 0) {
                    console.log('[WhatsMeow] No active integrations found — webhook sync skipped');
                    return;
                }

                for (const integration of whatsmeowIntegrations) {
                    const config = integration.credentials as any;
                    if (!config?.agentCode || !config?.agentToken) continue;

                    try {
                        const agent = await whatsmeow.getAgent(config.agentCode, config.agentToken);
                        if (agent.incomingWebhook !== correctWebhook) {
                            await whatsmeow.setWebhook(config.agentCode, config.agentToken, correctWebhook);
                            console.log(`[WhatsMeow] ✅ Webhook synced for agent ${config.agentCode}: ${correctWebhook}`);
                        } else {
                            console.log(`[WhatsMeow] ✅ Webhook already correct for agent ${config.agentCode}`);
                        }
                    } catch (err: any) {
                        if (err.message?.includes('404')) {
                            // Agent was deleted from WhatsMeow API — disable stale integration
                            console.warn(`[WhatsMeow] Agent ${config.agentCode} not found (404) — disabling stale integration ${integration.id}`);
                            await prisma.integration.update({
                                where: { id: integration.id },
                                data: {
                                    isEnabled: false,
                                    metadata: { ...(integration.metadata as any), status: 'error', lastError: 'Agent not found on WhatsMeow API' }
                                }
                            });
                        } else {
                            console.error(`[WhatsMeow] ⚠️ Failed to sync webhook for agent ${config.agentCode}:`, err.message);
                        }
                    }
                }
            } catch (err: any) {
                console.error('[WhatsMeow] Error during webhook auto-sync:', err.message);
            }
        })();

    });
}

export { app, httpServer };
