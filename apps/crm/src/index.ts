import 'dotenv/config';
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import { apiReference } from '@scalar/express-api-reference';
import { customers, tickets, invoices, communications, transactions, leads, tags, loadAssistAICache, saveAssistAICache, channelConfigs, conversationTakeovers, type AssistAICache, type ChannelConfig, type ConversationTakeover, conversations, initConversations, saveOrganizationConfig, getOrganizationConfig } from "./data.js";
import type { Customer, Ticket, Invoice, Communication, TicketStatus, Transaction, Lead, Tag, ChatMessage, Conversation, ContactIdentity, ContactType } from "./types.js";
import { authMiddleware, optionalAuth, requireRole, handleLogin, handleRegister, handleLogout, getAssistAIAuthUrl, handleAssistAICallback } from "./auth.js";
import { prisma } from "./db.js";
import { logActivity, getCustomerActivities, getLeadActivities, getTicketActivities, getRecentActivities, activityTypeLabels, activityTypeIcons } from "./activity.js";
import { sendEmail, verifyEmailConnection, emailTemplates } from "./email.js";
import { getGoogleAuthUrl, handleGoogleCallback, createEvent, listEvents, createClientMeeting, createFollowUpReminder } from "./calendar.js";
import { getUserIntegrations, saveUserIntegration } from "./integrations.js";
import { generateInvoicePDF, generateAnalyticsPDF } from "./reports.js";
import { AssistAIService, assistaiFetch } from "./services/assistai.js";
import bcrypt from "bcryptjs";
import { validateAgentId } from "./voice.js";
import * as whatsmeow from "./whatsmeow.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fix: Define ASSISTAI_CONFIG global fallback
const ASSISTAI_CONFIG = {
    baseUrl: process.env.ASSISTAI_API_URL || 'https://public.assistai.lat',
    apiToken: process.env.ASSISTAI_API_TOKEN,
    tenantDomain: process.env.ASSISTAI_TENANT_DOMAIN,
    organizationCode: process.env.ASSISTAI_ORG_CODE
};

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Global Rate Limiter (relaxed for development)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Higher limit for development
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: "Demasiadas solicitudes, por favor intente más tarde." }
});

// Apply granular limits to Auth routes
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'production' ? 10 : 50, // Higher limit for development
    message: { error: "Demasiados intentos de inicio de sesión, intente más tarde." }
});

app.use(limiter);
app.use("/auth/login", authLimiter);





// Cached agents from AssistAI
let cachedAgents: any[] = [];

// Load cached data on startup
function initializeFromCache() {
    const cache = loadAssistAICache();
    if (cache.agents.length > 0) {
        cachedAgents = cache.agents;
    }
    if (cache.conversations.length > 0) {
        for (const conv of cache.conversations) {
            // Restore Date objects
            conv.createdAt = new Date(conv.createdAt);
            conv.updatedAt = new Date(conv.updatedAt);
            conv.messages = conv.messages.map((m: any) => ({
                ...m,
                timestamp: new Date(m.timestamp)
            }));
            conversations.set(conv.sessionId, conv);
        }
        console.log(`📂 Restored ${conversations.size} conversations from cache`);
    }
    if (cache.lastSync) {
        console.log(`⏰ Last sync: ${cache.lastSync}`);
    }
}

// Initialize on startup
initializeFromCache();

// Seed demo conversation (if not from cache)
if (!conversations.has("demo-session-1")) {
    conversations.set("demo-session-1", {
        sessionId: "demo-session-1",
        platform: "whatsapp",
        customerName: "Cliente Demo",
        customerContact: "+15550001234",
        messages: [
            { id: "msg-001", sessionId: "demo-session-1", from: "+15550001234", content: "Hola, necesito ayuda", platform: "whatsapp", sender: "user", timestamp: new Date() }
        ],
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
    });
}

// Socket.io Connection Logic
io.on("connection", (socket) => {
    console.log("🔌 Client connected:", socket.id);

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

app.get("/customers", (req, res) => {
    const { status, plan, search } = req.query;
    let filtered = customers;

    if (status) filtered = filtered.filter(c => c.status === status);
    if (plan) filtered = filtered.filter(c => c.plan === plan);
    if (search) {
        const q = String(search).toLowerCase();
        filtered = filtered.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.company?.toLowerCase().includes(q)
        );
    }

    // Enriquecer con stats
    const enriched = filtered.map(c => ({
        ...c,
        openTickets: tickets.filter(t => t.customerId === c.id && t.status !== "CLOSED").length,
        pendingInvoices: invoices.filter(i => i.customerId === c.id && ["SENT", "OVERDUE"].includes(i.status)).length,
    }));

    res.json(enriched);
});

app.get("/customers/:id", (req, res) => {
    const customer = customers.find(c => c.id === req.params.id);
    if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });

    const customerTickets = tickets.filter(t => t.customerId === customer.id);
    const customerInvoices = invoices.filter(i => i.customerId === customer.id);
    const customerComms = communications.filter(c => c.customerId === customer.id);

    res.json({
        ...customer,
        tickets: customerTickets,
        invoices: customerInvoices,
        communications: customerComms.slice(-20), // Últimas 20
    });
});

app.post("/customers", (req, res) => {
    const { name, email, phone, company, plan = "FREE" } = req.body;
    if (!name || !email) return res.status(400).json({ error: "name y email requeridos" });

    const customer: Customer = {
        id: `cust-${Date.now()}`,
        name,
        email,
        phone,
        company,
        plan,
        status: "TRIAL",
        monthlyRevenue: 0,
        currency: "USD",
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    customers.push(customer);

    // Sync with ChronusDev
    (async () => {
        const CHRONUSDEV_URL = process.env.CHRONUSDEV_API_URL || "http://127.0.0.1:3001";
        try {
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
                    contactName: customer.name, // Default to same name
                }),
            });
            if (response.ok) {
                const client = await response.json();
                customer.chronusDevClientId = client.id;

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
                        customer.chronusDevDefaultProjectId = project.id;
                    }
                } catch (projErr) {
                    console.error("Error creating auto-project:", projErr);
                }
            }
        } catch (err) {
            console.error("Error syncing customer to ChronusDev:", err);
        }
    })();

    // Emit socket event for real-time notification
    io.emit('client_created', { client: customer, source: 'manual' });
    io.emit('notification', {
        id: `notif-${Date.now()}`,
        userId: 'all',
        type: 'client',
        title: '🎉 Nuevo Cliente',
        body: `${customer.name} ha sido registrado como cliente`,
        data: { clientId: customer.id },
        read: false,
        createdAt: new Date()
    });

    res.json(customer);
});

app.put("/customers/:id", (req, res) => {
    const customer = customers.find(c => c.id === req.params.id);
    if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });

    const { name, email, phone, company, plan, status, tags, notes } = req.body;
    if (name) customer.name = name;
    if (email) customer.email = email;
    if (phone !== undefined) customer.phone = phone;
    if (company !== undefined) customer.company = company;
    if (plan) customer.plan = plan;
    if (status) customer.status = status;
    if (tags) customer.tags = tags;
    if (notes !== undefined) customer.notes = notes;
    customer.updatedAt = new Date();

    // Sync Update with ChronusDev
    if (customer.chronusDevClientId) {
        (async () => {
            const CHRONUSDEV_URL = process.env.CHRONUSDEV_API_URL || "http://127.0.0.1:3001";
            try {
                await fetch(`${CHRONUSDEV_URL}/clients/${customer.chronusDevClientId}`, {
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
            } catch (err) {
                console.error("Error syncing update to ChronusDev:", err);
            }
        })();
    }

    res.json(customer);
});

// DELETE customer
app.delete("/customers/:id", (req, res) => {
    const index = customers.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Cliente no encontrado" });

    const customer = customers[index];
    customers.splice(index, 1);

    // Cleanup related data
    const ticketIds = tickets.filter(t => t.customerId === customer.id).map(t => t.id);
    ticketIds.forEach(id => {
        const idx = tickets.findIndex(t => t.id === id);
        if (idx !== -1) tickets.splice(idx, 1);
    });

    res.json({ success: true, message: "Cliente eliminado" });
});

// ========== CLIENTS ALIAS (Frontend uses /clients, backend uses /customers) ==========

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
app.get("/clients", (req, res) => {
    // Map customers to client format expected by frontend
    const clientsData = customers.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        contactName: c.name,
        phone: c.phone,
        notes: c.notes
    }));
    res.json(clientsData);
});

app.get("/clients/:id", (req, res) => {
    const customer = customers.find(c => c.id === req.params.id);
    if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        contactName: customer.name,
        phone: customer.phone,
        notes: customer.notes
    });
});

/**
 * @openapi
 * /clients:
 *   post:
 *     summary: Create a new client
 *     tags: [Clients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               contactName: { type: string }
 *               phone: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Client created
 */
app.post("/clients", (req, res) => {
    const { name, email, contactName, phone, notes } = req.body;
    if (!name) return res.status(400).json({ error: "name requerido" });

    const customer: Customer = {
        id: `cust-${Date.now()}`,
        name,
        email: email || '',
        phone,
        company: contactName,
        plan: "FREE",
        status: "ACTIVE",
        monthlyRevenue: 0,
        currency: "USD",
        tags: [],
        notes,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    customers.push(customer);

    res.json({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        contactName: customer.company,
        phone: customer.phone,
        notes: customer.notes
    });
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
app.put("/clients/:id", (req, res) => {
    const customer = customers.find(c => c.id === req.params.id);
    if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });

    const { name, email, contactName, phone, notes } = req.body;
    if (name) customer.name = name;
    if (email !== undefined) customer.email = email;
    if (contactName !== undefined) customer.company = contactName;
    if (phone !== undefined) customer.phone = phone;
    if (notes !== undefined) customer.notes = notes;
    customer.updatedAt = new Date();

    res.json({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        contactName: customer.company,
        phone: customer.phone,
        notes: customer.notes
    });
});

/**
 * @openapi
 * /clients/{id}:
 *   delete:
 *     summary: Delete a client
 *     tags: [Clients]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Client deleted
 */
app.delete("/clients/:id", (req, res) => {
    const index = customers.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Cliente no encontrado" });
    customers.splice(index, 1);
    res.json({ success: true });
});

/**
 * @openapi
 * /clients/{id}/contacts:
 *   post:
 *     summary: Add a contact identity to an existing client
 *     tags: [Clients]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, value]
 *             properties:
 *               type: { type: string, enum: [whatsapp, instagram, phone, email] }
 *               value: { type: string }
 *     responses:
 *       200:
 *         description: Contact added to client
 */
app.post("/clients/:id/contacts", (req, res) => {
    const customer = customers.find(c => c.id === req.params.id);
    if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });

    const { type, value } = req.body;
    if (!type || !value) return res.status(400).json({ error: "type y value requeridos" });

    // Create contact identity
    const contactId = `contact-${Date.now()}`;
    const contact: ContactIdentity = {
        id: contactId,
        clientId: customer.id,
        type: type as 'whatsapp' | 'instagram' | 'phone' | 'email',
        value,
        displayName: customer.name,
        verified: true,
        createdAt: new Date()
    };

    contactIdentities.set(contactId, contact);

    // Add contact ID to customer
    if (!customer.contactIds) customer.contactIds = [];
    customer.contactIds.push(contactId);

    res.json({
        success: true,
        client: {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            contactIds: customer.contactIds
        },
        contact
    });
});

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

        // SPECIAL HANDLING FOR ASSISTAI:
        // Also update the Organization config if this is an admin saving AssistAI creds,
        // so that the rest of the system (which uses org config) works correctly.
        if (provider === 'ASSISTAI' && req.user.organizationId) {
            try {
                // Determine if we should update org config.
                // If the user provided these specific fields in credentials:
                if (credentials.apiToken && credentials.organizationCode && credentials.tenantDomain) {
                    await prisma.organization.update({
                        where: { id: req.user.organizationId },
                        data: {
                            assistaiConfig: {
                                apiToken: credentials.apiToken,
                                organizationCode: credentials.organizationCode,
                                tenantDomain: credentials.tenantDomain
                            }
                        }
                    });
                    console.log(`[Integrations] Synced AssistAI config to Organization ${req.user.organizationId}`);
                }
            } catch (orgErr) {
                console.error("[Integrations] Failed to sync to Organization config:", orgErr);
                // Don't fail the request, just log it. The user integration is already saved.
            }
        }

        res.json({ success: true, integration });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ========== VOICE (ELEVENLABS + TWILIO) ==========

import { initiateOutboundCall, handleElevenLabsTranscript } from './voice.js';
import { initScheduler } from './scheduler.js';

// Initialize the scheduler for pending calls
initScheduler();

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

// ========== END VOICE ==========

// Manual Sync Endpoint
app.post("/customers/:id/sync", async (req, res) => {
    const customer = customers.find(c => c.id === req.params.id);
    if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });

    const CHRONUSDEV_URL = process.env.CHRONUSDEV_API_URL || "http://127.0.0.1:3001";

    try {
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
            customer.chronusDevClientId = client.id;

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
                    customer.chronusDevDefaultProjectId = project.id;
                }
            } catch (projErr) {
                console.error("Error creating auto-project:", projErr);
            }
        }
        res.json({ success: true, customer });
    } catch (err: any) {
        console.error("Sync error:", err);
        res.status(500).json({ error: err.message || "Error syncing with ChronusDev" });
    }
});

// Create Task in ChronusDev for Customer
app.post("/customers/:id/chronus-task", async (req, res) => {
    const customer = customers.find(c => c.id === req.params.id);
    if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });

    const { title, description } = req.body;
    const CHRONUSDEV_URL = process.env.CHRONUSDEV_API_URL || "http://127.0.0.1:3001";

    try {
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

// ========== TICKETS ==========

app.get("/tickets", (req, res) => {
    const { status, customerId } = req.query;
    let filtered = tickets;

    if (status) filtered = filtered.filter(t => t.status === status);
    if (customerId) filtered = filtered.filter(t => t.customerId === customerId);

    // Enriquecer con nombre del cliente
    const enriched = filtered.map(t => ({
        ...t,
        customer: customers.find(c => c.id === t.customerId),
    }));

    res.json(enriched);
});

app.post("/tickets", async (req, res) => {
    const { customerId, title, description, priority = "MEDIUM" } = req.body;
    if (!customerId || !title) return res.status(400).json({ error: "customerId y title requeridos" });

    const ticket: Ticket = {
        id: `tkt-${Date.now()}`,
        customerId,
        title,
        description: description || "",
        status: "OPEN",
        priority,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    tickets.push(ticket);

    // Auto-sync with ChronusDev
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        const CHRONUSDEV_URL = process.env.CHRONUSDEV_API_URL || "http://127.0.0.1:3001";
        const AUTH_HEADER = { "Authorization": `Bearer ${process.env.CHRONUSDEV_TOKEN || "token-admin-123"}` };

        try {
            // Step 1: Ensure customer exists in ChronusDev
            if (!customer.chronusDevClientId) {
                console.log(`[Sync] Creating client in ChronusDev: ${customer.name}`);
                const clientRes = await fetch(`${CHRONUSDEV_URL}/clients`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...AUTH_HEADER },
                    body: JSON.stringify({
                        name: customer.name,
                        email: customer.email,
                        phone: customer.phone,
                        contactName: customer.name,
                    }),
                });
                if (clientRes.ok) {
                    const client = await clientRes.json();
                    customer.chronusDevClientId = client.id;
                    console.log(`[Sync] Client created: ${client.id}`);
                } else {
                    console.error(`[Sync] Failed to create client: ${clientRes.status}`);
                }
            }

            // Step 2: Ensure project exists for this customer
            if (customer.chronusDevClientId && !customer.chronusDevDefaultProjectId) {
                console.log(`[Sync] Creating support project for: ${customer.name}`);
                const projectRes = await fetch(`${CHRONUSDEV_URL}/projects`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...AUTH_HEADER },
                    body: JSON.stringify({
                        name: `Soporte ${customer.name}`,
                        description: `Proyecto de soporte para ${customer.name}`,
                        clientId: customer.chronusDevClientId,
                        budget: 0,
                        currency: "USD",
                        status: "ACTIVE",
                    }),
                });
                if (projectRes.ok) {
                    const project = await projectRes.json();
                    customer.chronusDevDefaultProjectId = project.id;
                    console.log(`[Sync] Project created: ${project.id}`);
                } else {
                    console.error(`[Sync] Failed to create project: ${projectRes.status}`);
                }
            }

            // Step 3: Create task in ChronusDev
            if (customer.chronusDevDefaultProjectId) {
                console.log(`[Sync] Creating task for ticket: ${ticket.id}`);
                const taskRes = await fetch(`${CHRONUSDEV_URL}/tasks`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...AUTH_HEADER },
                    body: JSON.stringify({
                        projectId: customer.chronusDevDefaultProjectId,
                        title: `[CRM] ${ticket.title}`,
                        description: `Cliente: ${customer.name}\nTicket ID: ${ticket.id}\n\n${ticket.description}`,
                        priority: ticket.priority,
                        status: "BACKLOG",
                    }),
                });

                if (taskRes.ok) {
                    const task = await taskRes.json();
                    ticket.chronusDevTaskId = task.id;
                    ticket.chronusDevProjectId = customer.chronusDevDefaultProjectId;
                    ticket.status = "IN_PROGRESS";
                    ticket.updatedAt = new Date();
                    console.log(`[Sync] Task created: ${task.id}`);
                } else {
                    console.error(`[Sync] Failed to create task: ${taskRes.status}`);
                }
            }
        } catch (err) {
            console.error("[Sync] Error syncing with ChronusDev:", err);
        }
    }

    res.json(ticket);
});

app.put("/tickets/:id", (req, res) => {
    const ticket = tickets.find(t => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket no encontrado" });

    const { status, priority, assignedTo, chronusDevTaskId, chronusDevProjectId } = req.body;
    if (status) {
        ticket.status = status as TicketStatus;
        if (status === "RESOLVED") ticket.resolvedAt = new Date();
    }
    if (priority) ticket.priority = priority;
    if (assignedTo) ticket.assignedTo = assignedTo;
    if (chronusDevTaskId) ticket.chronusDevTaskId = chronusDevTaskId;
    if (chronusDevProjectId) ticket.chronusDevProjectId = chronusDevProjectId;
    ticket.updatedAt = new Date();

    res.json(ticket);
});

// 🔥 AI AGENT ENDPOINT: Simple webhook for AI to create tickets
app.post("/api/ai/tickets", async (req, res) => {
    // Basic Auth Check (API Key)
    const apiKey = req.headers['x-api-key'];
    // In a real scenario, we'd check against a DB or Env Var.
    // For now, accept 'chronus-ai-key' or if internal
    if (apiKey !== 'chronus-ai-key' && process.env.NODE_ENV === 'production') {
        // Allow pass in dev for easier testing if needed, or enforce.
    }

    const { title, description, customerEmail, priority = "MEDIUM" } = req.body;

    if (!title || !customerEmail) {
        return res.status(400).json({ error: "title y customerEmail requeridos" });
    }

    try {
        // 1. Find or Create Customer
        let customer = customers.find(c => c.email === customerEmail);
        if (!customer) {
            customer = {
                id: `cust-${Date.now()}`,
                name: customerEmail.split('@')[0], // Fallback name
                email: customerEmail,
                phone: "",
                plan: "BASIC",
                status: "ACTIVE",
                monthlyRevenue: 0,
                currency: "USD",
                tags: ["AI-CREATED"],
                createdAt: new Date(),
                updatedAt: new Date(),
                tickets: [],
                invoices: [],
                communications: []
            };
            customers.push(customer);
            // Trigger sync (step 1 of logic below)
            // But we can rely on the sync logic inside ticket creation if we reuse it?
            // Actually, let's reuse the ticket creation logic by calling it internally or copy-paste the sync part?
            // Best is to call the logic. 
        }

        // 2. Create Ticket
        const ticket: Ticket = {
            id: `tkt-${Date.now()}`,
            customerId: customer.id,
            title: `[AI] ${title}`,
            description: description || "Creado por Agente AI",
            status: "OPEN",
            priority,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        tickets.push(ticket);

        // 3. Trigger ChronusDev Sync (Manual invocation of the logic)
        // We reuse the logic from POST /tickets
        const CHRONUSDEV_URL = process.env.CHRONUSDEV_API_URL || "http://127.0.0.1:3001";
        const AUTH_HEADER = { "Authorization": `Bearer ${process.env.CHRONUSDEV_TOKEN || "token-admin-123"}` };

        // Ensure Sync
        if (!customer.chronusDevClientId) {
            const clientRes = await fetch(`${CHRONUSDEV_URL}/clients`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...AUTH_HEADER },
                body: JSON.stringify({ name: customer.name, email: customer.email }),
            });
            if (clientRes.ok) {
                const client = await clientRes.json();
                customer.chronusDevClientId = client.id;
            }
        }

        if (customer.chronusDevClientId && !customer.chronusDevDefaultProjectId) {
            const projectRes = await fetch(`${CHRONUSDEV_URL}/projects`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...AUTH_HEADER },
                body: JSON.stringify({
                    name: `Soporte ${customer.name}`,
                    description: `Proyecto de soporte para ${customer.name}`,
                    clientId: customer.chronusDevClientId,
                    budget: 0,
                    currency: "USD",
                    status: "ACTIVE",
                }),
            });
            if (projectRes.ok) {
                const project = await projectRes.json();
                customer.chronusDevDefaultProjectId = project.id;
            }
        }

        if (customer.chronusDevDefaultProjectId) {
            const taskRes = await fetch(`${CHRONUSDEV_URL}/tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...AUTH_HEADER },
                body: JSON.stringify({
                    projectId: customer.chronusDevDefaultProjectId,
                    title: `[CRM-AI] ${ticket.title}`,
                    description: `Ticket ID: ${ticket.id}\n\n${ticket.description}`,
                    priority: ticket.priority,
                    status: "BACKLOG",
                }),
            });
            if (taskRes.ok) {
                const task = await taskRes.json();
                ticket.chronusDevTaskId = task.id;
                ticket.chronusDevProjectId = customer.chronusDevDefaultProjectId;
                ticket.status = "IN_PROGRESS";
            }
        }

        res.json({ success: true, ticket });

    } catch (err: any) {
        console.error("AI Ticket Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 🔥 INTEGRACIÓN: Enviar ticket a ChronusDev como tarea
app.post("/tickets/:id/send-to-chronusdev", async (req, res) => {
    const ticket = tickets.find(t => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket no encontrado" });

    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: "projectId requerido" });

    const customer = customers.find(c => c.id === ticket.customerId);

    // Crear tarea en ChronusDev
    const CHRONUSDEV_URL = process.env.CHRONUSDEV_API_URL || "http://127.0.0.1:3001";

    try {
        const response = await fetch(`${CHRONUSDEV_URL}/tasks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Usar token del admin para crear tareas
                "Authorization": `Bearer ${process.env.CHRONUSDEV_TOKEN || "token-admin-123"}`,
            },
            body: JSON.stringify({
                projectId,
                title: `[CRM] ${ticket.title}`,
                description: `Cliente: ${customer?.name || "Desconocido"}\n\n${ticket.description}`,
                priority: ticket.priority,
                status: "TODO",
            }),
        });

        if (!response.ok) {
            throw new Error("Error creando tarea en ChronusDev");
        }

        const task = await response.json();

        // Actualizar ticket con referencia
        ticket.chronusDevTaskId = task.id;
        ticket.chronusDevProjectId = projectId;
        ticket.status = "IN_PROGRESS";
        ticket.updatedAt = new Date();

        res.json({ ticket, chronusDevTask: task });
    } catch (err: any) {
        res.status(500).json({ error: err.message || "Error conectando con ChronusDev" });
    }
});

// ========== INVOICES ==========

app.get("/invoices", (req, res) => {
    const { status, customerId } = req.query;
    let filtered = invoices;

    if (status) filtered = filtered.filter(i => i.status === status);
    if (customerId) filtered = filtered.filter(i => i.customerId === customerId);

    const enriched = filtered.map(i => ({
        ...i,
        customer: customers.find(c => c.id === i.customerId),
    }));

    res.json(enriched);
});

app.post("/invoices", (req, res) => {
    const { customerId, amount, currency = "USD", dueDate, items } = req.body;
    if (!customerId || !amount) return res.status(400).json({ error: "customerId y amount requeridos" });

    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`;

    const invoice: Invoice = {
        id: `inv-${Date.now()}`,
        customerId,
        number: invoiceNumber,
        amount: Number(amount),
        currency,
        status: "DRAFT",
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
        items: items || [{ description: "Servicio", quantity: 1, unitPrice: amount, total: amount }],
        createdAt: new Date(),
    };

    invoices.push(invoice);
    res.json(invoice);
});

app.put("/invoices/:id", (req, res) => {
    const invoice = invoices.find(i => i.id === req.params.id);
    if (!invoice) return res.status(404).json({ error: "Factura no encontrada" });

    const { status, paidAt } = req.body;
    if (status) invoice.status = status;
    if (status === 'PAID') invoice.paidAt = paidAt ? new Date(paidAt) : new Date();

    res.json(invoice);
});

// ========== COMMUNICATIONS ==========

app.get("/communications", (req, res) => {
    const { customerId, type } = req.query;
    let filtered = communications;

    if (customerId) filtered = filtered.filter(c => c.customerId === customerId);
    if (type) filtered = filtered.filter(c => c.type === type);

    res.json(filtered);
});

app.post("/communications", (req, res) => {
    const { customerId, type, direction, subject, content } = req.body;
    if (!customerId || !type || !content) {
        return res.status(400).json({ error: "customerId, type y content requeridos" });
    }

    const comm: Communication = {
        id: `comm-${Date.now()}`,
        customerId,
        type,
        direction: direction || "OUTBOUND",
        subject,
        content,
        createdAt: new Date(),
    };
    communications.push(comm);
    res.json(comm);
});


// ========== TRANSACTIONS ==========

app.get("/transactions", (req, res) => {
    const { customerId, type, category } = req.query;
    let filtered = transactions;

    if (customerId) filtered = filtered.filter(t => t.customerId === customerId);
    if (type) filtered = filtered.filter(t => t.type === type);
    if (category) filtered = filtered.filter(t => t.category === category);

    // Sort by date desc
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(filtered);
});

app.post("/transactions", (req, res) => {
    const { customerId, date, amount, type, category, description, status = "COMPLETED" } = req.body;

    if (!amount || !type || !description) {
        return res.status(400).json({ error: "Faltan campos requeridos (amount, type, description)" });
    }

    const transaction: Transaction = {
        id: `txn-${Date.now()}`,
        customerId,
        date: new Date(date || Date.now()),
        amount: Number(amount),
        type,
        category,
        description,
        status,
        createdAt: new Date(),
    };

    transactions.push(transaction);
    res.json(transaction);
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

app.get("/leads", (req, res) => {
    const { status, tag } = req.query;
    let filtered = leads;
    if (status) filtered = filtered.filter(l => l.status === status);
    if (tag) filtered = filtered.filter(l => l.tags?.includes(tag as string));
    // Sort by score (high first), then by recent
    filtered.sort((a, b) => (b.score || 0) - (a.score || 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(filtered);
});

app.post("/leads", (req, res) => {
    const { name, email, company, value, status = "NEW", notes, source = "MANUAL", tags: leadTags } = req.body;
    if (!name || !email) return res.status(400).json({ error: "name y email requeridos" });

    const lead: Lead = {
        id: `lead-${Date.now()}`,
        name,
        email,
        company,
        value: Number(value) || 0,
        status,
        notes,
        source,
        tags: leadTags || [],
        score: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    // Auto-calculate score
    lead.score = calculateLeadScore(lead);
    leads.push(lead);

    // Emit socket event for real-time notification
    io.emit('lead_created', { lead, source: 'manual' });
    io.emit('notification', {
        id: `notif-${Date.now()}`,
        userId: 'all',
        type: 'lead',
        title: '📥 Nuevo Lead',
        body: `${lead.name} agregado manualmente`,
        data: { leadId: lead.id },
        read: false,
        createdAt: new Date()
    });

    res.json(lead);
});

// ... imports
import { checkLeadAutomations } from './automations.js';

app.put("/leads/:id", authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { status, ...data } = req.body;

        const lead = await prisma.lead.update({
            where: { id },
            data: { status, ...data }
        });

        // Trigger Automations if status changed
        if (status) {
            checkLeadAutomations(id, status as any).catch(err => console.error(err));
        }

        res.json(lead);
    } catch (err: any) {
        if (err.code === 'P2025') {
            return res.status(404).json({ error: "Lead no encontrado" });
        }
        res.status(500).json({ error: err.message });
    }
});


// ========== TAGS ==========

app.get("/tags", (req, res) => {
    const { category } = req.query;
    let filtered = tags;
    if (category) filtered = tags.filter(t => t.category === category);
    res.json(filtered);
});

app.post("/tags", (req, res) => {
    const { name, color, category = 'general' } = req.body;
    if (!name || !color) return res.status(400).json({ error: "name y color requeridos" });

    const tag: Tag = {
        id: `tag-${Date.now()}`,
        name,
        color,
        category,
        createdAt: new Date(),
    };
    tags.push(tag);
    res.json(tag);
});

app.delete("/tags/:id", (req, res) => {
    const index = tags.findIndex(t => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Tag no encontrado" });
    tags.splice(index, 1);
    res.json({ success: true });
});


// ========== WHATSAPP PROVIDERS (Dual Integration) ==========

import { whatsappProviders } from "./data.js";
import type { WhatsAppProvider, WhatsAppMessage } from "./types.js";

// Get all WhatsApp providers
app.get("/whatsapp/providers", async (req, res) => {
    try {
        // Fetch specific WhatsApp providers from DB
        // We look for integrations with provider 'WHATSMEOW' or 'META' (or 'WHATSAPP' generally)
        const integrations = await prisma.integration.findMany({
            where: {
                OR: [
                    { provider: 'WHATSMEOW' },
                    { provider: 'META' },
                    { provider: 'WHATSAPP' } // Future proofing
                ]
            }
        });

        // If none exist, we might want to return defaults or empty list
        // For the UI to render configuration cards, we can return "virtual" providers if DB is empty
        // or just expect the UI to handle creation. 
        // To match current UI expectations which expects a list of "slots" to configure:

        let providers: WhatsAppProvider[] = integrations.map(i => ({
            id: i.id,
            name: i.metadata?.name || (i.provider === 'META' ? 'WhatsApp Business (Meta)' : 'WhatsApp (WhatsMeow)'),
            type: i.provider === 'META' ? 'meta' : 'whatsmeow',
            enabled: i.isEnabled,
            config: i.credentials as any,
            status: (i.metadata?.status as any) || 'disconnected',
            lastError: i.metadata?.lastError,
            connectedAt: i.metadata?.connectedAt ? new Date(i.metadata.connectedAt) : undefined,
            createdAt: i.createdAt
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
app.post("/whatsapp/providers", async (req, res) => {
    // Defines a new provider or updates existing one based on finding it in DB
    // Actually the frontend calls PUT /:id usually, but let's handle creation if needed.
    // For this migration, we will mostly rely on PUT /:id with the special IDs
    res.status(501).json({ error: "Use PUT /whatsapp/providers/:id to configure" });
});

app.put("/whatsapp/providers/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { name, enabled, config, status } = req.body;
    // We expect `type` to be passed or we infer it? 
    // If ID is 'placeholder-whatsmeow', we create a new record.

    try {
        let integration;

        if (id.startsWith('placeholder-')) {
            // Create new
            const type = id.includes('meta') ? 'META' : 'WHATSMEOW';
            integration = await prisma.integration.create({
                data: {
                    userId: (req as any).user.id,
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
            // Update existing
            integration = await prisma.integration.findUnique({ where: { id } });
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
app.post("/whatsapp/providers/:id/test", async (req, res) => {
    const { id } = req.params;

    try {
        const integration = await prisma.integration.findUnique({ where: { id } });
        if (!integration) return res.status(404).json({ error: "Provider no encontrado" });

        const config = integration.credentials as any;

        if (integration.provider === 'WHATSMEOW') {
            // Test WhatsMeow connection
            const apiUrl = config.apiUrl;
            if (!apiUrl) throw new Error('API URL no configurada');

            // TODO: Real API call when available
            // const response = await fetch(`${apiUrl}/status`, ...);

            // Update status
            await prisma.integration.update({
                where: { id },
                data: { metadata: { ...(integration.metadata as any), status: 'connected', connectedAt: new Date() } }
            });

            res.json({ success: true, message: 'Conexión WhatsMeow simulada exitosa' });

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
            // can't update placeholder
            try {
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
app.get("/whatsapp/providers/:id/qr", async (req, res) => {
    const { id } = req.params;
    const integration = await prisma.integration.findUnique({ where: { id } });

    if (!integration) return res.status(404).json({ error: "Provider no encontrado" });
    if (integration.provider !== 'WHATSMEOW') {
        return res.status(400).json({ error: "QR solo disponible para WhatsMeow" });
    }

    try {
        const config = integration.credentials as any;

        if (!config?.agentCode || !config?.agentToken) {
            throw new Error('Agente no configurado o credenciales faltantes');
        }

        // Update status to connecting
        await prisma.integration.update({
            where: { id },
            data: { metadata: { ...(integration.metadata as any), status: 'connecting' } }
        });

        console.log(`[WhatsMeow] Fetching QR for agent ${config.agentCode}`);

        // Fetch Real QR Image
        const qrResponse = await whatsmeow.getQRImage(config.agentCode, config.agentToken);

        let base64Image;
        if (Buffer.isBuffer(qrResponse)) {
            base64Image = `data:image/png;base64,${qrResponse.toString('base64')}`;
        } else {
            // Check if it's a JSON response with a 'qr' field
            const responseData = qrResponse as any;

            if (responseData.status === 'connected') {
                // Already connected!
                await prisma.integration.update({
                    where: { id },
                    data: { metadata: { ...(integration.metadata as any), status: 'connected', connectedAt: new Date(), lastError: null as any } }
                });
                return res.json({ status: 'connected', message: 'Dispositivo ya vinculado' });
            }

            if (responseData.qr) {
                // If it's already a data URI or just base64, use it. 
                // Assuming standard Base64 if no prefix
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
            expiresIn: 60,
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
        // Return 400 or 503 instead of crash, or a specific status json
        // If external API is down, maybe 503
        res.status(502).json({ error: 'Error comunicando con servicio WhatsApp: ' + err.message });
    }
});

// Confirm QR scan was successful
app.post("/whatsapp/providers/:id/qr/confirm", async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.integration.update({
            where: { id },
            data: { metadata: { status: 'connected', connectedAt: new Date(), lastError: null as any } }
        });

        // Emit socket event
        const integration = await prisma.integration.findUnique({ where: { id } });
        io.emit('whatsapp_connected', { providerId: id, name: (integration?.metadata as any)?.name });

        res.json({ success: true, message: 'WhatsApp vinculado exitosamente' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Disconnect/Logout
app.post("/whatsapp/providers/:id/disconnect", async (req, res) => {
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
            const agentCode = config.agentCode;
            const agentToken = config.agentToken;

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

        } else if (provider.type === 'meta') {
            // Enviar via Meta Business API
            const response = await fetch(
                `https://graph.facebook.com/v18.0/${provider.config.phoneNumberId}/messages`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${provider.config.accessToken}`
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
    platform: 'whatsapp' | 'instagram' | 'messenger' | 'assistai',
    from: string,
    content: string,
    mediaType: 'text' | 'image' | 'audio' | 'video' | 'document' = 'text',
    mediaUrl?: string,
    metadata?: any,
    explicitSessionId?: string
) {
    // Generate or resolve Session ID
    // For WhatsApp, session ID is typically the phone number. For AssistAI/others, use explicit UUID if provided
    const sessionId = explicitSessionId || `session-${from.replace(/\D/g, '')}`;

    const newMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        from,
        content: content || '',
        platform,
        sender: "user",
        mediaUrl,
        mediaType: mediaType === 'text' ? undefined : mediaType,
        timestamp: new Date(),
        metadata,
        status: 'delivered' // Initialize status for incoming messages
    };

    // ... continues ... 

    // Find or create conversation in DB
    let conversation = await prisma.conversation.findUnique({
        where: { sessionId }
    });

    if (!conversation) {
        let customerName = from;
        // Try to match with existing client
        if (!explicitSessionId) {
            const customer = await prisma.customer.findFirst({
                where: { OR: [{ phone: from }, { email: from }] }
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
                agentCode: metadata?.agentCode
            }
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
    // ...

    // conversation.messages.push(newMessage); // No longer needed for DB logic
    // conversation.updatedAt = new Date();

    // Check for "Human Takeover" or "AI Paused" status
    const takeover = conversationTakeovers.get(sessionId);
    const isHumanControl = takeover && new Date(takeover.expiresAt) > new Date();

    // If NO human control, we could trigger AI auto-response here
    // (Future implementation: call AssistAI if mode is 'hybrid' and 'ai-only')

    // Real-time broadcast to room and general inbox
    io.to(sessionId).emit("new_message", newMessage);
    io.emit("inbox_update", { sessionId, message: newMessage });
    console.log(`[Inbox] New message from ${from} (${platform}): ${content}`);

    return { sessionId, messageId: newMessage.id };
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

                    // Get provider info relative to this webhook
                    // Typically we'd look up which provider has this phoneNumberId
                    const phoneNumberId = value.metadata?.phone_number_id;

                    // Find integration with this phoneNumberId in credentials
                    // Since credentials is JSON, we fetch all META integrations and filter in memory (or use Raw query if needed)
                    // For now, simple in-memory filter of all meta integrations
                    const metaIntegrations = await prisma.integration.findMany({ where: { provider: 'META' } });
                    const provider = metaIntegrations.find(p => (p.credentials as any)?.phoneNumberId === phoneNumberId);
                    const providerId = provider?.id || 'meta-business'; // Fallback

                    for (const msg of messages) {
                        const from = msg.from;
                        const type = msg.type;
                        let content = '';
                        let mediaUrl = undefined;

                        if (type === 'text') {
                            content = msg.text?.body || '';
                        } else if (type === 'image') {
                            content = msg.image?.caption || '[Imagen]';
                            // Note: Meta media URLs require auth to download, so might need processing
                            // For now we just pass the ID or raw link
                            mediaUrl = msg.image?.id;
                        } else {
                            content = `[${type.toUpperCase()}]`;
                        }

                        // Process message into Inbox
                        await processIncomingMessage(
                            providerId,
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

app.post("/webhooks/leads/incoming", (req, res) => {
    // Expected Payload: { "name": "...", "email": "...", "company": "...", "notes": "..." }
    const { name, email, company, notes } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: "Payload invalido. Requiere name y email." });
    }

    const lead: Lead = {
        id: `lead-wh-${Date.now()}`,
        name,
        email,
        company,
        source: "WEBHOOK",
        status: "NEW", // Webhook leads start as NEW
        value: 0, // Default value, can be enriched later
        notes: notes ? `[Webhook] ${notes}` : "[Webhook] Lead entrante",
        customFields: req.body.customFields || {}, // Support custom fields from webhook
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    leads.push(lead);
    console.log(`[Webhook] Lead creado: ${lead.id} (${lead.email})`);


    // Emit socket event
    io.emit('lead_created', { lead, source: 'webhook' });
    io.emit('notification', {
        id: `notif-${Date.now()}`,
        userId: 'all',
        type: 'lead',
        title: '📥 Nuevo Lead',
        body: `${lead.name} (${lead.email}) ingresó via webhook`,
        data: { leadId: lead.id },
        read: false,
        createdAt: new Date()
    });

    res.json({ success: true, id: lead.id, message: "Lead creado exitosamente" });
});

// Webhook for external client creation
app.post("/webhooks/clients/incoming", (req, res) => {
    const { name, email, phone, company, plan = "FREE", source = "webhook", customFields } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: "Payload invalido. Requiere name y email." });
    }

    const customer: Customer = {
        id: `cust-wh-${Date.now()}`,
        name,
        email,
        phone,
        company,
        plan,
        status: "TRIAL",
        monthlyRevenue: 0,
        currency: "USD",
        tags: [],
        notes: `[Webhook] Source: ${source}`,
        customFields: customFields || {},
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    customers.push(customer);
    console.log(`[Webhook] Cliente creado: ${customer.id} (${customer.email})`);

    // Emit socket events
    io.emit('client_created', { client: customer, source: 'webhook' });
    io.emit('notification', {
        id: `notif-${Date.now()}`,
        userId: 'all',
        type: 'client',
        title: '🎉 Nuevo Cliente (Webhook)',
        body: `${customer.name} registrado desde ${source}`,
        data: { clientId: customer.id },
        read: false,
        createdAt: new Date()
    });

    res.json({ success: true, id: customer.id, message: "Cliente creado exitosamente" });
});

// WhatsMeow Webhook Receiver
// Payload format from Bernardo's n8n integration
app.post("/whatsmeow/webhook", async (req, res) => {
    const payload = req.body;
    import('fs').then(fs => fs.appendFileSync('webhook_payloads.log', `[${new Date().toISOString()}] ${JSON.stringify(payload)}\n`));
    console.log('[WhatsMeow Webhook] Recibido:', JSON.stringify(payload).substring(0, 800));

    try {
        // Bernardo's format: payload has body object with message data
        const data = payload.body || payload;

        // Extract agent info from headers (if available via payload.headers)
        const agentCode = payload.headers?.['x-agent-code'] || req.headers['x-agent-code'];
        const agentToken = payload.headers?.['x-agent-token'] || req.headers['x-agent-token'];

        // Extract sender info - format: "584124330943@s.whatsapp.net"
        const fromRaw = data.from || '';
        const toRaw = data.to || '';

        // Check if it's a group message
        const isGroup = data.is_group === true || fromRaw.includes('@g.us');

        // Allow self messages for testing (sync from phone) but mark sender
        const isSelfMessage = data.is_self_message === true || data.is_owner_sender === true;

        if (!fromRaw || isGroup) {
            console.log('[WhatsMeow] Ignorando mensaje (group/empty/filtered)');
            return res.sendStatus(200);
        }

        // Clean phone number - remove @s.whatsapp.net suffix
        const from = fromRaw.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
        const pushName = data.pushname || data.pushName || '';

        // Extract message content based on type
        let content = '';
        let mediaUrl: string | undefined = undefined;
        let mediaType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' = 'text';
        const messageType = data.type || 'text';

        switch (messageType) {
            case 'text':
            case 'extended_text':
                content = data.message || data.text || '';
                break;
            case 'image':
                content = data.caption || '[Imagen recibida]';
                mediaType = 'image';
                mediaUrl = data.image_url || data.media_url;
                break;
            case 'audio':
            case 'ptt': // Push to talk (voice note)
                content = '[Audio recibido]';
                mediaType = 'audio';
                mediaUrl = data.audio_url || data.media_url;
                break;
            case 'video':
                content = data.caption || '[Video recibido]';
                mediaType = 'video' as any;
                mediaUrl = data.video_url || data.media_url;
                break;
            case 'document':
                content = data.filename || data.caption || '[Documento recibido]';
                mediaType = 'document' as any;
                mediaUrl = data.document_url || data.media_url;
                break;
            case 'sticker':
                content = '[Sticker recibido]';
                mediaType = 'sticker' as any;
                mediaUrl = data.sticker_url || data.media_url;
                break;
            default:
                content = data.message || data.text || `[${messageType}]`;
        }

        if (from && content) {
            console.log(`[WhatsMeow] Procesando ${messageType} de ${from} (${pushName}): ${content.substring(0, 100)}`);

            await processIncomingMessage(
                'whatsmeow',
                'whatsapp',
                from,
                content,
                mediaType as any,
                mediaUrl,
                {
                    pushName,
                    messageId: data.message_id || data.id,
                    timestamp: data.timestamp,
                    conversationId: data.conversationId,
                    agentCode: agentCode,
                    isSelf: isSelfMessage
                }
            );
        }
    } catch (e: any) {
        console.error('[WhatsMeow Webhook Error]', e.message, e.stack);
    }

    res.sendStatus(200);
});

app.post("/webhooks/messages/incoming", async (req, res) => {
    // Universal Webhook for WhatsApp, Instagram, Messenger, AssistAI
    const { from, content, platform = "assistai", sessionId: providedSessionId, mediaUrl, mediaType, providerId } = req.body;

    if (!from || (!content && !mediaUrl)) {
        return res.status(400).json({ error: "Missing from or content/mediaUrl" });
    }

    // Use unified processor
    const result = await processIncomingMessage(
        providerId,
        platform as any,
        from,
        content,
        mediaType,
        mediaUrl,
        undefined,
        providedSessionId
    );

    res.json({ success: true, ...result });
});

// Agent sends reply (Inbox -> Platform)
app.post("/chat/send", async (req, res) => {
    const { sessionId, content } = req.body;

    if (!sessionId || !content) {
        return res.status(400).json({ error: "Missing sessionId or content" });
    }

    let conversation = conversations.get(sessionId);

    // Fallback: Check DB if not in memory
    if (!conversation) {
        try {
            const dbConv = await prisma.conversation.findUnique({
                where: { sessionId },
                include: { messages: true }
            });

            if (dbConv) {
                // Restore to memory
                conversation = {
                    sessionId: dbConv.sessionId,
                    platform: dbConv.platform.toLowerCase() as any,
                    customerName: dbConv.customerName || 'Unknown',
                    customerContact: dbConv.customerContact,
                    agentCode: dbConv.agentCode || undefined,
                    agentName: dbConv.agentName || undefined,
                    status: dbConv.status.toLowerCase() as any,
                    createdAt: dbConv.createdAt,
                    updatedAt: dbConv.updatedAt,
                    messages: dbConv.messages.map(m => ({
                        id: m.id,
                        sessionId: dbConv.sessionId,
                        from: m.sender === 'USER' ? (dbConv.customerName || 'User') : 'Agent',
                        content: m.content,
                        platform: dbConv.platform.toLowerCase() as any,
                        sender: m.sender === 'USER' ? 'user' : 'agent',
                        timestamp: m.createdAt,
                        status: m.status?.toLowerCase() as any,
                        mediaUrl: m.mediaUrl || undefined
                    })),
                    metadata: dbConv.metadata
                };
                conversations.set(sessionId, conversation);
                console.log(`[Chat Send] Restored conversation ${sessionId} from DB`);
            }
        } catch (err) {
            console.error('[Chat Send] Error restoring conversation:', err);
        }
    }

    if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
    }

    // Create the message object first
    const newMessage: ChatMessage = {
        id: `msg-agent-${Date.now()}`,
        sessionId,
        from: "Support Agent",
        content,
        platform: conversation.platform,
        sender: "agent",
        timestamp: new Date(),
        status: 'sending'
    };

    try {
        // 🚀 REAL SENDING LOGIC
        if (conversation.platform === 'whatsapp') {
            const providerId = conversation.metadata?.providerId;
            const to = conversation.customerContact; // Phone number

            let wmConfig;
            if (providerId) {
                const integration = await prisma.integration.findUnique({ where: { id: providerId } });
                if (integration && integration.isEnabled && integration.provider === 'WHATSMEOW') wmConfig = integration;
            }
            if (!wmConfig) {
                wmConfig = await prisma.integration.findFirst({ where: { provider: 'WHATSMEOW', isEnabled: true } });
            }

            if (!wmConfig) {
                console.warn('[Chat Send] No active WhatsMeow provider found');
                newMessage.status = 'failed';
            } else {
                // Send via WhatsMeow
                console.log(`[WhatsMeow] Sending to ${to}: ${content}`);

                if (wmConfig?.credentials) {
                    const creds = wmConfig.credentials as any;
                    if (creds.agentCode && creds.agentToken) {
                        const formattedTo = whatsmeow.formatPhoneNumber(to);
                        try {
                            const result = await whatsmeow.sendMessage(
                                creds.agentCode,
                                creds.agentToken,
                                { to: formattedTo, message: content }
                            );
                            newMessage.status = 'sent';
                            console.log('[WhatsMeow] Message sent successfully:', result);
                        } catch (err: any) {
                            console.error('[WhatsMeow] Send failed:', err.message);
                            newMessage.status = 'failed';
                        }
                    } else {
                        console.warn('[WhatsMeow] Missing agentCode or agentToken in credentials');
                        newMessage.status = 'failed';
                    }
                }
            }
        } else if (conversation.platform === 'assistai') {
            // Send via AssistAI Service
            try {
                // Get config for organization (default for now)
                const orgConfig = getOrganizationConfig('org-default');
                // Construct required config
                const config = {
                    baseUrl: process.env.ASSISTAI_API_URL || 'https://public.assistai.lat',
                    apiToken: orgConfig?.apiToken || process.env.ASSISTAI_API_TOKEN || '',
                    tenantDomain: orgConfig?.tenantDomain || process.env.ASSISTAI_TENANT_DOMAIN || '',
                    organizationCode: orgConfig?.organizationCode || process.env.ASSISTAI_ORG_CODE || ''
                };

                await AssistAIService.sendMessage(config, sessionId, content, 'User');
                console.log(`[AssistAI] Sent via Unified Send to ${sessionId}`);
                newMessage.status = 'sent';
            } catch (error: any) {
                console.error(`[AssistAI] Failed to send:`, error.message);
                newMessage.status = 'failed';
            }
        }

        // Save to memory
        conversation.messages.push(newMessage);
        conversation.updatedAt = new Date();

        // Real-time broadcast to user widget and inbox
        io.to(sessionId).emit("new_message", newMessage);
        io.emit("inbox_update", { sessionId, message: newMessage });

        res.json({ success: true, message: newMessage });

    } catch (err: any) {
        console.error('[Chat Send Error]', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all conversations (for Inbox list)
app.get("/conversations", authMiddleware, async (req: any, res) => { // Now protected
    try {
        // Fetch from Prisma with messages
        const dbConversations = await prisma.conversation.findMany({
            include: { messages: { orderBy: { createdAt: 'asc' } } },
            orderBy: { updatedAt: 'desc' }
        });

        const list = dbConversations.map(c => ({
            sessionId: c.sessionId,
            platform: c.platform.toLowerCase(),
            customerName: c.customerName,
            customerContact: c.customerContact,
            agentCode: c.agentCode,
            agentName: c.agentName,
            status: c.status,
            updatedAt: c.createdAt.toISOString(), // or updatedAt if available
            messages: c.messages.map(m => ({
                id: m.id,
                sessionId: c.sessionId,
                from: m.sender === 'AGENT' ? (c.agentName || 'Agent') : (c.customerName || 'User'),
                content: m.content,
                platform: c.platform.toLowerCase(),
                sender: m.sender === 'AGENT' ? 'agent' : 'user',
                timestamp: m.createdAt.toISOString(),
                status: 'delivered' // default
            }))
        }));

        res.json(list);
    } catch (err: any) {
        console.error('Error fetching conversations:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get single conversation history
app.get("/conversations/:sessionId", (req, res) => {
    const conversation = conversations.get(req.params.sessionId);
    if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
    }
    res.json(conversation);
});

// Lookup/Initiate Conversation
app.post("/conversations/lookup", async (req, res) => {
    const { phone, platform } = req.body;

    if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
    }

    try {
        if (platform === 'assistai') {
            console.log(`[AssistAI] Looking up conversation for ${phone}`);

            // 1. Check local cache (Fastest) for INSTANT open
            const localMatch = Array.from(conversations.values()).find(c =>
                c.platform === 'assistai' &&
                (c.customerContact === phone || c.customerContact === phone.replace('+', ''))
            );

            if (localMatch) {
                console.log(`[AssistAI] Found in local cache: ${localMatch.sessionId}`);
                return res.json({ found: true, sessionId: localMatch.sessionId, conversation: localMatch });
            }

            // 2. Try API with Timeout Promise Race
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout searching AssistAI')), 5000));
            const data: any = await Promise.race([
                assistaiFetch(`/conversations?take=1&customerContact=${encodeURIComponent(phone)}`, ASSISTAI_CONFIG as any),
                timeout
            ]);

            if (data && data.data && data.data.length > 0) {
                const conv = data.data[0];
                const sessionId = conv.uuid || conv.id; // Fallback

                // Ensure it exists in local map
                let localConv = conversations.get(sessionId);
                if (!localConv) {
                    // Create local stub
                    localConv = {
                        sessionId,
                        platform: 'assistai',
                        customerName: conv.customerName || phone,
                        customerContact: phone,
                        messages: [], // We don't fetch history here yet (Inbox will handle sync)
                        status: 'active',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        metadata: { assistaiId: conv.id }
                    };
                    conversations.set(sessionId, localConv);
                }

                return res.json({ found: true, sessionId, conversation: localConv });
            } else {
                return res.status(404).json({ error: "Conversation not found in AssistAI. Please initiate from the user side." });
            }
        } else if (platform === 'whatsapp') {
            // For Meta/WhatsMeow, we just generate the session ID deterministically
            const sessionId = `session-${phone.replace(/\D/g, '')}`;
            // Check if exists
            let localConv = conversations.get(sessionId);
            if (!localConv) {
                localConv = {
                    sessionId,
                    platform: 'whatsapp',
                    customerName: phone,
                    customerContact: phone,
                    messages: [],
                    status: 'active',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    metadata: { providerId: 'whatsmeow-main' } // Default to whatsmeow for new chats?
                };
                conversations.set(sessionId, localConv);
            }
            return res.json({ found: true, sessionId, conversation: localConv });
        }

        return res.status(400).json({ error: "Unsupported platform or missing logic" });

    } catch (err: any) {
        console.error('[Lookup Error]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ========== DASHBOARD STATS ==========

app.get("/stats", (req, res) => {
    const activeCustomers = customers.filter(c => c.status === "ACTIVE").length;
    const trialCustomers = customers.filter(c => c.status === "TRIAL").length;
    const mrr = customers.filter(c => c.status === "ACTIVE").reduce((acc, c) => acc + c.monthlyRevenue, 0);
    const openTickets = tickets.filter(t => t.status === "OPEN").length;
    const overdueInvoices = invoices.filter(i => i.status === "OVERDUE").length;

    res.json({
        activeCustomers,
        trialCustomers,
        mrr,
        openTickets,
        overdueInvoices,
        totalCustomers: customers.length,
    });
});

// ========== AI ENDPOINTS ==========

// AI Reply Suggestions - generates contextual reply suggestions
app.post("/ai/suggest-reply", (req, res) => {
    const { sessionId, lastMessages } = req.body;

    // Get conversation context
    const conversation = conversations.get(sessionId);
    const context = lastMessages || conversation?.messages.slice(-5) || [];

    // Analyze context and generate suggestions
    const lastUserMessage = context.filter((m: any) => m.sender === 'user').pop();
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
app.get("/analytics/predictions", (req, res) => {
    const activeCustomers = customers.filter(c => c.status === 'ACTIVE');
    const currentMRR = activeCustomers.reduce((acc, c) => acc + c.monthlyRevenue, 0);

    // MRR Forecast (simple projection)
    const avgGrowthRate = 0.05; // 5% monthly growth estimate
    const forecast = [
        { month: 'Actual', mrr: currentMRR },
        { month: '+1 mes', mrr: Math.round(currentMRR * (1 + avgGrowthRate)) },
        { month: '+2 mes', mrr: Math.round(currentMRR * Math.pow(1 + avgGrowthRate, 2)) },
        { month: '+3 mes', mrr: Math.round(currentMRR * Math.pow(1 + avgGrowthRate, 3)) },
    ];

    // Churn Risk Analysis
    const churnRiskCustomers = customers.filter(c => {
        // Risk factors: TRIAL status, no recent activity, overdue invoices
        const hasOverdueInvoice = invoices.some(i => i.customerId === c.id && i.status === 'OVERDUE');
        const isTrial = c.status === 'TRIAL';
        const hasChurnTag = c.tags?.includes('churn-risk');
        return hasOverdueInvoice || isTrial || hasChurnTag;
    }).map(c => ({
        id: c.id,
        name: c.name,
        mrr: c.monthlyRevenue,
        riskLevel: invoices.some(i => i.customerId === c.id && i.status === 'OVERDUE') ? 'HIGH' :
            c.status === 'TRIAL' ? 'MEDIUM' : 'LOW',
        reason: invoices.some(i => i.customerId === c.id && i.status === 'OVERDUE') ? 'Factura vencida' :
            c.status === 'TRIAL' ? 'En período trial' : 'Actividad baja'
    }));

    // Lead Pipeline Forecast
    const pipelineValue = leads.filter(l => !['WON', 'LOST'].includes(l.status)).reduce((acc, l) => acc + l.value, 0);
    const hotLeads = leads.filter(l => (l.score || 0) >= 70);

    res.json({
        mrr: {
            current: currentMRR,
            forecast,
            trend: avgGrowthRate > 0 ? 'up' : 'down',
            projectedAnnual: currentMRR * 12 * (1 + avgGrowthRate * 6)
        },
        churn: {
            atRiskCount: churnRiskCustomers.length,
            atRiskMRR: churnRiskCustomers.reduce((acc, c) => acc + c.mrr, 0),
            customers: churnRiskCustomers.slice(0, 5)
        },
        pipeline: {
            totalValue: pipelineValue,
            hotLeadsCount: hotLeads.length,
            avgScore: leads.length ? Math.round(leads.reduce((acc, l) => acc + (l.score || 0), 0) / leads.length) : 0
        }
    });
});

// ========== USERS PROXY ==========


app.get("/users", async (req, res) => {
    const CHRONUSDEV_URL = process.env.CHRONUSDEV_API_URL || "http://127.0.0.1:3001";

    // Fallback users when ChronusDev is unavailable
    const fallbackUsers = [
        { id: 'user-1', name: 'Admin CRM', email: 'admin@chronus.dev', role: 'admin' },
        { id: 'user-2', name: 'Soporte', email: 'soporte@chronus.dev', role: 'support' },
        { id: 'user-3', name: 'Ventas', email: 'ventas@chronus.dev', role: 'sales' }
    ];

    try {
        const response = await fetch(`${CHRONUSDEV_URL}/users`, {
            headers: {
                "Authorization": `Bearer ${process.env.CHRONUSDEV_TOKEN || "token-admin-123"}`,
            },
        });
        if (!response.ok) throw new Error("Error fetching users");
        const users = await response.json();
        res.json(users);
    } catch (err) {
        console.warn("ChronusDev unavailable, returning fallback users");
        res.json(fallbackUsers);
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
app.get("/channels", (req, res) => {
    res.json(channelConfigs);
});

/**
 * @openapi
 * /channels:
 *   post:
 *     summary: Create or update a channel configuration
 *     tags: [Channels]
 */
app.post("/channels", (req, res) => {
    const { id, channelValue, platform, mode, assignedAgentId, assignedAgentName, humanTakeoverDuration, autoResumeAI } = req.body;

    if (!channelValue || !platform || !mode) {
        return res.status(400).json({ error: "channelValue, platform, and mode are required" });
    }

    // Check if channel already exists
    const existingIndex = channelConfigs.findIndex(c => c.channelValue === channelValue);

    const config: ChannelConfig = {
        id: id || `channel-${Date.now()}`,
        channelValue,
        platform,
        mode,
        assignedAgentId,
        assignedAgentName,
        humanTakeoverDuration: humanTakeoverDuration || 60,
        autoResumeAI: autoResumeAI !== false,
        createdAt: existingIndex >= 0 ? channelConfigs[existingIndex].createdAt : new Date(),
        updatedAt: new Date(),
    };

    if (existingIndex >= 0) {
        channelConfigs[existingIndex] = config;
    } else {
        channelConfigs.push(config);
    }

    res.json(config);
});

/**
 * @openapi
 * /channels/{id}:
 *   delete:
 *     summary: Delete a channel configuration
 *     tags: [Channels]
 */
app.delete("/channels/:id", (req, res) => {
    const index = channelConfigs.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Channel not found" });
    channelConfigs.splice(index, 1);
    res.json({ success: true });
});

// Get channel config for a specific contact
app.get("/channels/by-contact/:contact", (req, res) => {
    const config = channelConfigs.find(c => c.channelValue === req.params.contact);
    if (!config) return res.json({ mode: 'human-only' }); // Default to human if not configured
    res.json(config);
});

// ========== CONVERSATION TAKEOVER (Human takes control from AI) ==========

/**
 * @openapi
 * /conversations/{sessionId}/takeover:
 *   post:
 *     summary: Human takes control of conversation from AI
 *     tags: [Conversations]
 */
app.post("/conversations/:sessionId/takeover", async (req, res) => {
    const { sessionId } = req.params;
    const { userId, durationMinutes } = req.body;

    const conversation = conversations.get(sessionId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    // Find channel config
    const channelConfig = channelConfigs.find(c => c.channelValue === conversation.customerContact);

    // Create takeover record
    const takeover: ConversationTakeover = {
        sessionId,
        takenBy: userId || 'admin',
        takenAt: new Date(),
        expiresAt: new Date(Date.now() + (durationMinutes || channelConfig?.humanTakeoverDuration || 60) * 60000),
        previousMode: channelConfig?.mode === 'ai-only' ? 'ai-only' : 'hybrid',
    };

    conversationTakeovers.set(sessionId, takeover);

    // TODO: Call AssistAI API to pause the agent
    // await fetch(`${ASSISTAI_CONFIG.baseUrl}/api/v1/conversations/${sessionId}/pause`, { method: 'POST', ... });

    io.emit('takeover_started', { sessionId, takeover });

    res.json({
        success: true,
        takeover,
        message: `Humano tomó control por ${durationMinutes || channelConfig?.humanTakeoverDuration || 60} minutos`
    });
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

// Create Organization (Super Admin)
app.post("/organizations", authMiddleware, requireRole('SUPER_ADMIN'), async (req: any, res) => {
    try {
        const { name, slug } = req.body;
        if (!name || !slug) return res.status(400).json({ error: "Name and slug required" });

        const org = await prisma.organization.create({
            data: { name, slug }
        });

        res.status(201).json(org);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Update Organization AssistAI Config
app.patch("/organizations/:id/assistai", authMiddleware, requireRole('ADMIN'), async (req: any, res) => {
    try {
        const { id } = req.params;
        const { apiToken, organizationCode, tenantDomain } = req.body;

        // Security check: only allow updating own org if not SUPER_ADMIN
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user?.role !== 'SUPER_ADMIN' && user?.organizationId !== id) {
            return res.status(403).json({ error: "No autorizado" });
        }

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
    const orgs = await prisma.organization.findMany();
    res.json(orgs);
});








// ==================== SAAS ADMIN (USERS) ====================

// List All Users (Super Admin)
app.get("/admin/users", authMiddleware, requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            include: { organization: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' }
        });

        // Sanitize passwords
        const sanitized = users.map(u => {
            const { password, ...rest } = u;
            return rest;
        });

        res.json(sanitized);
    } catch (err: any) {
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
                role: role || 'AGENT',
                organizationId: organizationId || null
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

// ==================== TENANT ADMIN (TEAM) ====================

// List Organization Users (Tenant Admin)
app.get("/organization/users", authMiddleware, requireRole('ADMIN'), async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;
        if (!organizationId) return res.status(403).json({ error: "No tienes organización asignada" });

        const users = await prisma.user.findMany({
            where: { organizationId },
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
                role: role || 'AGENT',
                organizationId
            }
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
            prisma.customer.create({ data: { organizationId, name: 'Empresa Demo A', email: 'contacto@demoa.com', plan: 'PRO', status: 'active', monthlyRevenue: 1500 } }),
            prisma.customer.create({ data: { organizationId, name: 'Consultora XYZ', email: 'info@xyz.com', plan: 'ENTERPRISE', status: 'active', monthlyRevenue: 5000 } }),
            prisma.customer.create({ data: { organizationId, name: 'Startup Beta', email: 'hello@beta.io', plan: 'STARTER', status: 'trial', monthlyRevenue: 0 } }),
            prisma.customer.create({ data: { organizationId, name: 'Restaurante El Sabor', email: 'reservas@sabor.com', plan: 'PRO', status: 'active', monthlyRevenue: 1200 } }),
            prisma.customer.create({ data: { organizationId, name: 'Tech Solutions', email: 'support@techsol.com', plan: 'ENTERPRISE', status: 'churned', monthlyRevenue: 0 } }),
        ]);

        // 2. Create Dummy Tickets
        await prisma.ticket.createMany({
            data: [
                { organizationId, title: 'Error en login', status: 'OPEN', priority: 'HIGH', customerId: customers[0].id },
                { organizationId, title: 'Consulta sobre facturación', status: 'IN_PROGRESS', priority: 'MEDIUM', customerId: customers[1].id },
                { organizationId, title: 'Feature Request: Dark Mode', status: 'OPEN', priority: 'LOW', customerId: customers[2].id },
                { organizationId, title: 'Problema con integración WhatsApp', status: 'RESOLVED', priority: 'URGENT', customerId: customers[3].id },
            ]
        });

        // 3. Create Dummy Leads
        await prisma.lead.createMany({
            data: [
                { organizationId, name: 'Interesado Demo', email: 'lead1@test.com', status: 'NEW', source: 'Website' },
                { organizationId, name: 'Posible Partner', email: 'partner@test.com', status: 'CONTACTED', source: 'LinkedIn' },
                { organizationId, name: 'Cliente Potencial Grande', email: 'bigdeal@test.com', status: 'QUALIFIED', source: 'Referral' },
            ]
        });

        res.json({ success: true, message: "Datos de demostración generados correctamente." });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});












// ========== CONTACT IDENTITY MANAGEMENT ==========



// In-memory contact store (use database in production)
const contactIdentities: Map<string, ContactIdentity> = new Map();

// Initialize with demo contacts
contactIdentities.set('contact-001', {
    id: 'contact-001',
    clientId: 'cust-acme',
    type: 'whatsapp',
    value: '+15550001234',
    displayName: 'Cliente Demo',
    verified: true,
    createdAt: new Date()
});

// Helper function to find client by contact (IG, phone, etc.)
function findClientByContact(contactValue: string): { clientId: string | null; contactId: string | null } {
    // Normalize contact value
    const normalized = contactValue.toLowerCase().replace(/\s+/g, '').replace('@', '');

    for (const [id, contact] of contactIdentities) {
        const contactNormalized = contact.value.toLowerCase().replace(/\s+/g, '').replace('@', '');
        if (contactNormalized === normalized || contactNormalized.includes(normalized) || normalized.includes(contactNormalized)) {
            return { clientId: contact.clientId || null, contactId: id };
        }
    }
    return { clientId: null, contactId: null };
}

// GET all contacts
app.get("/contacts", (req, res) => {
    const clientId = req.query.clientId as string;
    const unassigned = req.query.unassigned === 'true';

    let results = Array.from(contactIdentities.values());

    if (clientId) {
        results = results.filter(c => c.clientId === clientId);
    }
    if (unassigned) {
        results = results.filter(c => !c.clientId);
    }

    res.json(results);
});

// POST create contact identity
app.post("/contacts", (req, res) => {
    const { type, value, displayName, clientId } = req.body;

    if (!type || !value) {
        return res.status(400).json({ error: 'type and value are required' });
    }

    // Check if contact already exists
    const existing = findClientByContact(value);
    if (existing.contactId) {
        return res.status(409).json({
            error: 'Contact already exists',
            existingContactId: existing.contactId,
            existingClientId: existing.clientId
        });
    }

    const contact: ContactIdentity = {
        id: `contact-${Date.now()}`,
        clientId: clientId || undefined,
        type,
        value,
        displayName,
        verified: false,
        createdAt: new Date()
    };

    contactIdentities.set(contact.id, contact);
    res.status(201).json(contact);
});

// PATCH assign contact to client
app.patch("/contacts/:id/assign", (req, res) => {
    const contact = contactIdentities.get(req.params.id);
    if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
    }

    const { clientId } = req.body;
    contact.clientId = clientId;
    contactIdentities.set(contact.id, contact);

    // Also update the customer's contactIds array
    const customer = customers.find(c => c.id === clientId);
    if (customer) {
        customer.contactIds = customer.contactIds || [];
        if (!customer.contactIds.includes(contact.id)) {
            customer.contactIds.push(contact.id);
        }
    }

    res.json(contact);
});

// DELETE contact
app.delete("/contacts/:id", (req, res) => {
    if (!contactIdentities.has(req.params.id)) {
        return res.status(404).json({ error: 'Contact not found' });
    }
    contactIdentities.delete(req.params.id);
    res.status(204).send();
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
app.post("/clients/from-chat", (req, res) => {
    const { name, email, phone, company, notes, contactValue, contactType, platform, sessionId } = req.body;

    if (!name || !contactValue) {
        return res.status(400).json({ error: 'name and contactValue are required' });
    }

    // Create client
    const clientId = `cust-${Date.now()}`;
    const newCustomer = {
        id: clientId,
        name,
        email: email || (contactType === 'email' ? contactValue : ''),
        phone: phone || (contactType === 'phone' || contactType === 'whatsapp' ? contactValue : undefined),
        company: company || undefined,
        plan: 'FREE' as const,
        status: 'ACTIVE' as const,
        monthlyRevenue: 0,
        currency: 'USD',
        contactIds: [] as string[],
        tags: ['from-chat'],
        notes: notes || undefined,
        source: 'chat' as const,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    customers.push(newCustomer);

    // Create primary contact identity (from the chat session)
    const primaryContactId = `contact-${Date.now()}-primary`;
    const primaryContact: ContactIdentity = {
        id: primaryContactId,
        clientId,
        type: contactType || platform || 'phone',
        value: contactValue,
        displayName: name,
        verified: true,
        createdAt: new Date()
    };
    contactIdentities.set(primaryContactId, primaryContact);
    newCustomer.contactIds.push(primaryContactId);

    // Create additional contact identity for Email field if different
    if (email && email !== contactValue) {
        const emailContactId = `contact-${Date.now()}-email`;
        contactIdentities.set(emailContactId, {
            id: emailContactId,
            clientId,
            type: 'email',
            value: email,
            displayName: name,
            verified: false,
            createdAt: new Date()
        });
        newCustomer.contactIds.push(emailContactId);
    }

    // Create additional contact identity for Phone field if different
    if (phone && phone !== contactValue) {
        const phoneContactId = `contact-${Date.now()}-phone`;
        contactIdentities.set(phoneContactId, {
            id: phoneContactId,
            clientId,
            type: 'phone',
            value: phone,
            displayName: name,
            verified: false,
            createdAt: new Date()
        });
        newCustomer.contactIds.push(phoneContactId);
    }

    // Link conversation to client
    if (sessionId && conversations.has(sessionId)) {
        const conv = conversations.get(sessionId)!;
        (conv as any).clientId = clientId;
    }

    res.status(201).json({
        client: newCustomer,
        contact: primaryContact,
        message: 'Client created and linked to conversation'
    });
});

// POST convert lead to client
app.post("/clients/from-lead/:leadId", (req, res) => {
    const leadIndex = leads.findIndex(l => l.id === req.params.leadId);
    if (leadIndex === -1) {
        return res.status(404).json({ error: 'Lead not found' });
    }

    const lead = leads[leadIndex];
    const { plan, additionalContacts } = req.body;

    // Create client from lead
    const clientId = `cust-${Date.now()}`;
    const newCustomer = {
        id: clientId,
        name: lead.name,
        email: lead.email,
        company: lead.company,
        plan: plan || 'FREE' as const,
        status: 'ACTIVE' as const,
        monthlyRevenue: 0,
        currency: 'USD',
        contactIds: [] as string[],
        tags: ['from-lead'],
        notes: lead.notes,
        source: 'lead' as const,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    customers.push(newCustomer);

    // Create email contact
    const emailContactId = `contact-${Date.now()}`;
    const emailContact: ContactIdentity = {
        id: emailContactId,
        clientId,
        type: 'email',
        value: lead.email,
        displayName: lead.name,
        verified: true,
        createdAt: new Date()
    };
    contactIdentities.set(emailContactId, emailContact);
    newCustomer.contactIds.push(emailContactId);

    // Add additional contacts if provided
    if (additionalContacts && Array.isArray(additionalContacts)) {
        for (const c of additionalContacts) {
            const cId = `contact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const newContact: ContactIdentity = {
                id: cId,
                clientId,
                type: c.type,
                value: c.value,
                verified: false,
                createdAt: new Date()
            };
            contactIdentities.set(cId, newContact);
            newCustomer.contactIds.push(cId);
        }
    }

    // Remove from leads
    leads.splice(leadIndex, 1);

    // Emit socket events for conversion
    io.emit('lead_converted', { leadId: req.params.leadId, clientId: newCustomer.id, client: newCustomer });
    io.emit('client_created', { client: newCustomer, source: 'lead_conversion' });
    io.emit('notification', {
        id: `notif-${Date.now()}`,
        userId: 'all',
        type: 'conversion',
        title: '🌟 Lead Convertido',
        body: `${newCustomer.name} es ahora cliente`,
        data: { clientId: newCustomer.id, leadId: req.params.leadId },
        read: false,
        createdAt: new Date()
    });

    res.status(201).json({
        client: newCustomer,
        message: 'Lead converted to client successfully'
    });
});

// GET client 360 view with all conversations
app.get("/clients/:id/360", (req, res) => {
    const customer = customers.find(c => c.id === req.params.id);
    if (!customer) {
        return res.status(404).json({ error: 'Client not found' });
    }

    // Get all contact identities for this client
    const clientContacts = Array.from(contactIdentities.values())
        .filter(c => c.clientId === customer.id);

    // Get all conversations linked to any of these contacts
    const clientConversations: any[] = [];
    const contactValues = clientContacts.map(c => c.value.toLowerCase());

    for (const [sessionId, conv] of conversations) {
        const convContact = conv.customerContact?.toLowerCase() || '';
        if (contactValues.some(cv => convContact.includes(cv) || cv.includes(convContact))) {
            clientConversations.push({
                sessionId,
                platform: conv.platform,
                contact: conv.customerContact,
                messageCount: conv.messages.length,
                lastMessage: conv.messages[conv.messages.length - 1]?.content,
                updatedAt: conv.updatedAt
            });
        }
    }

    // Get invoices and tickets for this client
    const clientInvoices = invoices.filter(i => i.customerId === customer.id);
    const clientTickets = tickets.filter(t => t.customerId === customer.id);

    res.json({
        client: customer,
        contacts: clientContacts,
        conversations: clientConversations,
        invoices: clientInvoices,
        tickets: clientTickets,
        stats: {
            totalConversations: clientConversations.length,
            totalMessages: clientConversations.reduce((sum, c) => sum + c.messageCount, 0),
            openTickets: clientTickets.filter(t => t.status === 'OPEN').length,
            totalRevenue: clientInvoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.amount, 0)
        }
    });
});

// GET match contact to existing client
app.get("/contacts/match", (req, res) => {
    const value = req.query.value as string;
    if (!value) {
        return res.status(400).json({ error: 'value query parameter required' });
    }

    const result = findClientByContact(value);

    if (result.clientId) {
        const customer = customers.find(c => c.id === result.clientId);
        res.json({
            matched: true,
            clientId: result.clientId,
            contactId: result.contactId,
            client: customer
        });
    } else {
        res.json({ matched: false });
    }
});


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
const notifications: Map<string, Notification> = new Map();
const pushDevices: Map<string, PushDevice> = new Map();
const notificationPrefs: Map<string, NotificationPreferences> = new Map();

// Initialize with demo notification
notifications.set('notif-001', {
    id: 'notif-001',
    userId: 'user-1',
    type: 'system',
    title: 'Bienvenido a ChronusCRM',
    body: 'Tu cuenta está configurada correctamente.',
    read: false,
    createdAt: new Date()
});

// GET all notifications for a user
app.get("/notifications", (req, res) => {
    const userId = req.query.userId as string || 'user-1';
    const unreadOnly = req.query.unread === 'true';

    const userNotifs = Array.from(notifications.values())
        .filter(n => n.userId === userId && (!unreadOnly || !n.read))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json({
        notifications: userNotifs,
        unreadCount: userNotifs.filter(n => !n.read).length,
        total: userNotifs.length
    });
});

// POST create new notification
app.post("/notifications", (req, res) => {
    const { userId, type, title, body, data } = req.body;

    if (!userId || !title || !body) {
        return res.status(400).json({ error: 'userId, title, and body are required' });
    }

    const notification: Notification = {
        id: `notif-${Date.now()}`,
        userId,
        type: type || 'system',
        title,
        body,
        data,
        read: false,
        createdAt: new Date()
    };

    notifications.set(notification.id, notification);

    // Emit socket event for real-time notification
    io.emit('notification', notification);

    res.status(201).json(notification);
});

// PATCH mark notification as read
app.patch("/notifications/:id/read", (req, res) => {
    const notif = notifications.get(req.params.id);
    if (!notif) {
        return res.status(404).json({ error: 'Notification not found' });
    }

    notif.read = true;
    notifications.set(notif.id, notif);
    res.json(notif);
});

// POST mark all as read
app.post("/notifications/mark-all-read", (req, res) => {
    const userId = req.body.userId || 'user-1';
    let count = 0;

    notifications.forEach(notif => {
        if (notif.userId === userId && !notif.read) {
            notif.read = true;
            count++;
        }
    });

    res.json({ success: true, markedRead: count });
});

// DELETE notification
app.delete("/notifications/:id", (req, res) => {
    if (!notifications.has(req.params.id)) {
        return res.status(404).json({ error: 'Notification not found' });
    }
    notifications.delete(req.params.id);
    res.status(204).send();
});

// ===== Push Device Registration =====

// POST register push device
app.post("/notifications/devices", (req, res) => {
    const { userId, token, platform } = req.body;

    if (!userId || !token || !platform) {
        return res.status(400).json({ error: 'userId, token, and platform are required' });
    }

    if (!['ios', 'android', 'web'].includes(platform)) {
        return res.status(400).json({ error: 'platform must be ios, android, or web' });
    }

    const device: PushDevice = {
        id: `device-${Date.now()}`,
        userId,
        token,
        platform,
        createdAt: new Date()
    };

    pushDevices.set(device.id, device);
    console.log(`📱 Push device registered: ${platform} for user ${userId}`);

    res.status(201).json(device);
});

// DELETE unregister push device
app.delete("/notifications/devices/:id", (req, res) => {
    if (!pushDevices.has(req.params.id)) {
        return res.status(404).json({ error: 'Device not found' });
    }
    pushDevices.delete(req.params.id);
    res.status(204).send();
});

// GET user's devices
app.get("/notifications/devices", (req, res) => {
    const userId = req.query.userId as string || 'user-1';
    const userDevices = Array.from(pushDevices.values()).filter(d => d.userId === userId);
    res.json(userDevices);
});

// ===== Notification Preferences =====

// GET preferences
app.get("/notifications/preferences", (req, res) => {
    const userId = req.query.userId as string || 'user-1';
    const prefs = notificationPrefs.get(userId) || {
        userId,
        pushEnabled: true,
        emailEnabled: true,
        channels: { messages: true, tickets: true, invoices: true, system: true }
    };
    res.json(prefs);
});

// PUT update preferences
app.put("/notifications/preferences", (req, res) => {
    const { userId, pushEnabled, emailEnabled, channels } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    const prefs: NotificationPreferences = {
        userId,
        pushEnabled: pushEnabled !== undefined ? pushEnabled : true,
        emailEnabled: emailEnabled !== undefined ? emailEnabled : true,
        channels: channels || { messages: true, tickets: true, invoices: true, system: true }
    };

    notificationPrefs.set(userId, prefs);
    res.json(prefs);
});

// POST send test push notification (for development)
app.post("/notifications/test-push", (req, res) => {
    const { userId, title, body } = req.body;

    const userDevices = Array.from(pushDevices.values()).filter(d => d.userId === (userId || 'user-1'));

    // In production, you would send to FCM/APNs here
    console.log(`📲 Would send push to ${userDevices.length} devices:`, { title, body });

    res.json({
        success: true,
        message: `Test push would be sent to ${userDevices.length} devices`,
        devices: userDevices.map(d => ({ id: d.id, platform: d.platform }))
    });
});


// ========== API DOCUMENTATION (SCALAR) ==========

const openApiSpec = {
    openapi: '3.1.0',
    info: {
        title: 'ChronusCRM API',
        version: '1.0.0',
        description: 'API completa para gestión de CRM con integración AssistAI, clientes, tickets, facturas y más.',
        contact: { name: 'Chronus Team', email: 'soporte@chronus.dev' }
    },
    servers: [{ url: 'http://localhost:3002', description: 'Servidor de desarrollo' }],
    tags: [
        { name: 'Customers', description: 'Gestión de clientes' },
        { name: 'Tickets', description: 'Tickets de soporte' },
        { name: 'Invoices', description: 'Facturación' },
        { name: 'AssistAI', description: 'Integración con AssistAI' },
        { name: 'Inbox', description: 'Bandeja de entrada unificada' },
        { name: 'Leads', description: 'Gestión de leads' },
        { name: 'Finance', description: 'Transacciones financieras' },
        { name: 'Notifications', description: 'Sistema de notificaciones' },
        { name: 'Email', description: 'Servicios de Email (Gmail)' },
        { name: 'Calendar', description: 'Google Calendar & Meet' },
        { name: 'Integrations', description: 'Gestión de credenciales de usuario' },
        { name: 'WhatsApp', description: 'WhatsApp vía WhatsMeow (mensajes directos)' },
        { name: 'Reports', description: 'Reportes y PDF' }
    ],
    paths: {
        '/customers': {
            get: { tags: ['Customers'], summary: 'Listar todos los clientes', responses: { '200': { description: 'Lista de clientes' } } },
            post: { tags: ['Customers'], summary: 'Crear cliente', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Cliente creado' } } }
        },
        '/customers/{id}': {
            get: { tags: ['Customers'], summary: 'Obtener cliente por ID', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Cliente encontrado' } } },
            patch: { tags: ['Customers'], summary: 'Actualizar cliente', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Cliente actualizado' } } },
            delete: { tags: ['Customers'], summary: 'Eliminar cliente', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '204': { description: 'Cliente eliminado' } } }
        },
        '/tickets': {
            get: { tags: ['Tickets'], summary: 'Listar tickets', responses: { '200': { description: 'Lista de tickets' } } },
            post: { tags: ['Tickets'], summary: 'Crear ticket', responses: { '201': { description: 'Ticket creado' } } }
        },
        '/tickets/{id}': {
            get: { tags: ['Tickets'], summary: 'Obtener ticket', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Ticket' } } },
            patch: { tags: ['Tickets'], summary: 'Actualizar ticket', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Actualizado' } } }
        },
        '/invoices': {
            get: { tags: ['Invoices'], summary: 'Listar facturas', responses: { '200': { description: 'Lista de facturas' } } },
            post: { tags: ['Invoices'], summary: 'Crear factura', responses: { '201': { description: 'Factura creada' } } }
        },
        '/api/assistai/agents': {
            get: { tags: ['AssistAI'], summary: 'Listar agentes de IA', responses: { '200': { description: 'Lista de agentes' } } }
        },
        '/api/assistai/agents/{code}': {
            get: { tags: ['AssistAI'], summary: 'Obtener detalle de agente', parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Agente con estadísticas' } } },
            patch: { tags: ['AssistAI'], summary: 'Actualizar agente', parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, instructions: { type: 'string' } } } } } }, responses: { '200': { description: 'Agente actualizado' } } }
        },
        '/api/assistai/agent-config/{agentId}': {
            get: { tags: ['AssistAI'], summary: 'Obtener configuración remota de agente', parameters: [{ name: 'agentId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Configuración remota' } } }
        },
        '/api/assistai/conversations': {
            get: { tags: ['AssistAI'], summary: 'Listar conversaciones de AssistAI', parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'take', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'Conversaciones' } } }
        },
        '/api/assistai/sync-all': {
            post: { tags: ['AssistAI'], summary: 'Sincronizar todas las conversaciones', description: 'Sincroniza todas las conversaciones de AssistAI al inbox local', responses: { '200': { description: 'Sincronización completada' } } }
        },
        '/voice/validate': {
            post: { tags: ['AssistAI'], summary: 'Validar Agente de Voz', description: 'Valida credenciales de ElevenLabs', requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['agentId', 'apiKey'], properties: { agentId: { type: 'string' }, apiKey: { type: 'string' } } } } } }, responses: { '200': { description: 'Agente válido' }, '400': { description: 'Credenciales inválidas' } } }
        },
        '/conversations': {
            get: { tags: ['Inbox'], summary: 'Listar conversaciones del inbox', responses: { '200': { description: 'Lista de conversaciones' } } }
        },
        '/conversations/{sessionId}/messages': {
            get: { tags: ['Inbox'], summary: 'Obtener mensajes de conversación', parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Mensajes' } } }
        },
        '/leads': {
            get: { tags: ['Leads'], summary: 'Listar leads', responses: { '200': { description: 'Lista de leads' } } },
            post: { tags: ['Leads'], summary: 'Crear lead', responses: { '201': { description: 'Lead creado' } } }
        },
        '/transactions': {
            get: { tags: ['Finance'], summary: 'Listar transacciones', responses: { '200': { description: 'Transacciones' } } },
            post: { tags: ['Finance'], summary: 'Crear transacción', responses: { '201': { description: 'Creada' } } }
        },
        '/notifications': {
            get: { tags: ['Notifications'], summary: 'Listar notificaciones de usuario', parameters: [{ name: 'userId', in: 'query', schema: { type: 'string' } }, { name: 'unread', in: 'query', schema: { type: 'boolean' } }], responses: { '200': { description: 'Lista de notificaciones con contador de no leídas' } } },
            post: { tags: ['Notifications'], summary: 'Crear notificación', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { userId: { type: 'string' }, type: { type: 'string', enum: ['message', 'ticket', 'invoice', 'system', 'assistai'] }, title: { type: 'string' }, body: { type: 'string' } } } } } }, responses: { '201': { description: 'Notificación creada y emitida via socket' } } }
        },
        '/notifications/{id}/read': {
            patch: { tags: ['Notifications'], summary: 'Marcar como leída', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Notificación marcada como leída' } } }
        },
        '/notifications/mark-all-read': {
            post: { tags: ['Notifications'], summary: 'Marcar todas como leídas', responses: { '200': { description: 'Todas marcadas' } } }
        },
        '/notifications/devices': {
            get: { tags: ['Notifications'], summary: 'Listar dispositivos push de usuario', responses: { '200': { description: 'Dispositivos registrados' } } },
            post: { tags: ['Notifications'], summary: 'Registrar dispositivo para push', description: 'Registra un dispositivo iOS, Android o Web para recibir notificaciones push', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { userId: { type: 'string' }, token: { type: 'string' }, platform: { type: 'string', enum: ['ios', 'android', 'web'] } } } } } }, responses: { '201': { description: 'Dispositivo registrado' } } }
        },
        '/notifications/preferences': {
            get: { tags: ['Notifications'], summary: 'Obtener preferencias de notificación', responses: { '200': { description: 'Preferencias del usuario' } } },
            put: { tags: ['Notifications'], summary: 'Actualizar preferencias', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { userId: { type: 'string' }, pushEnabled: { type: 'boolean' }, emailEnabled: { type: 'boolean' }, channels: { type: 'object' } } } } } }, responses: { '200': { description: 'Preferencias actualizadas' } } }
        },
        '/email/send': {
            post: { tags: ['Email'], summary: 'Enviar email', requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['to', 'subject'], properties: { to: { type: 'string' }, subject: { type: 'string' }, text: { type: 'string' }, html: { type: 'string' } } } } } }, responses: { '200': { description: 'Email enviado' } } }
        },
        '/email/welcome': {
            post: { tags: ['Email'], summary: 'Enviar email bienvenida', responses: { '200': { description: 'Enviado' } } }
        },
        '/calendar/events': {
            get: { tags: ['Calendar'], summary: 'Listar eventos', responses: { '200': { description: 'Eventos próximos' } } },
            post: { tags: ['Calendar'], summary: 'Crear evento', responses: { '201': { description: 'Evento creado' } } }
        },
        '/calendar/meeting': {
            post: { tags: ['Calendar'], summary: 'Agendar reunión rápida', description: 'Crea evento y link de Google Meet', responses: { '201': { description: 'Reunión creada' } } }
        },
        '/integrations': {
            get: { tags: ['Integrations'], summary: 'Listar integraciones de usuario', responses: { '200': { description: 'Credenciales guardadas' } } },
            post: { tags: ['Integrations'], summary: 'Guardar integración', responses: { '200': { description: 'Guardado' } } }
        },
        '/invoices/{id}/pdf': {
            get: { tags: ['Reports'], summary: 'Descargar Factura PDF', parameters: [{ name: 'id', in: 'path', required: true }], responses: { '200': { description: 'Archivo PDF' } } }
        },
        '/reports/analytics/pdf': {
            get: { tags: ['Reports'], summary: 'Descargar Reporte Analytics PDF', responses: { '200': { description: 'Archivo PDF' } } }
        },
        '/whatsmeow/agents': {
            get: { tags: ['WhatsApp'], summary: 'Listar agentes WhatsMeow', responses: { '200': { description: 'Lista de agentes' } } },
            post: { tags: ['WhatsApp'], summary: 'Crear agente WhatsMeow', description: 'Crea un nuevo agente y guarda las credenciales', responses: { '201': { description: 'Agente creado con code y token' } } }
        },
        '/whatsmeow/agents/{code}/qr': {
            get: { tags: ['WhatsApp'], summary: 'Obtener QR como imagen PNG', parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Imagen PNG del código QR' } } },
            post: { tags: ['WhatsApp'], summary: 'Iniciar proceso de vinculación QR', parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Estado pending o connected con datos QR' } } }
        },
        '/whatsmeow/status': {
            get: { tags: ['WhatsApp'], summary: 'Estado de conexión WhatsApp', responses: { '200': { description: 'configured, connected y accountInfo' } } }
        },
        '/whatsmeow/send/message': {
            post: { tags: ['WhatsApp'], summary: 'Enviar mensaje de texto', requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['to', 'message'], properties: { to: { type: 'string', description: 'Número destino (ej: 584123456789)' }, message: { type: 'string' } } } } } }, responses: { '200': { description: 'Mensaje enviado' } } }
        },
        '/whatsmeow/send/image': {
            post: { tags: ['WhatsApp'], summary: 'Enviar imagen', requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['to', 'imageUrl'], properties: { to: { type: 'string' }, imageUrl: { type: 'string' }, caption: { type: 'string' } } } } } }, responses: { '200': { description: 'Imagen enviada' } } }
        },
        '/whatsmeow/send/audio': {
            post: { tags: ['WhatsApp'], summary: 'Enviar audio/nota de voz', requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['to', 'audioUrl'], properties: { to: { type: 'string' }, audioUrl: { type: 'string' }, ptt: { type: 'boolean', description: 'true para nota de voz' } } } } } }, responses: { '200': { description: 'Audio enviado' } } }
        },
        '/whatsmeow/send/document': {
            post: { tags: ['WhatsApp'], summary: 'Enviar documento', requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['to', 'documentUrl'], properties: { to: { type: 'string' }, documentUrl: { type: 'string' }, fileName: { type: 'string' }, caption: { type: 'string' } } } } } }, responses: { '200': { description: 'Documento enviado' } } }
        },
        '/whatsmeow/disconnect': {
            post: { tags: ['WhatsApp'], summary: 'Desconectar dispositivo WhatsApp', responses: { '200': { description: 'Dispositivo desconectado' } } }
        }
    }
};

app.use('/api/docs', apiReference({ url: '/api/openapi.json', theme: 'purple' }));
app.get('/api/openapi.json', (req, res) => res.json(openApiSpec));

// ========== AUTHENTICATION ENDPOINTS ==========

// Login with email/password
app.post("/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email y contraseña requeridos" });
    }
    const result = await handleLogin(email, password);
    if (result.error) {
        return res.status(401).json({ error: result.error });
    }
    res.json(result);
});

// Register new user
app.post("/auth/register", async (req, res) => {
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
app.get("/auth/me", authMiddleware, async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { id: true, email: true, name: true, role: true, avatar: true, phone: true, createdAt: true, lastLoginAt: true, organizationId: true }
    });
    if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json({ user });
});

// Logout
app.post("/auth/logout", authMiddleware, async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
        await handleLogout(token);
    }
    res.json({ success: true, message: "Sesión cerrada" });
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
    res.redirect(`http://localhost:3003/auth/callback?token=${result.token}`);
});

// ========== ACTIVITY TIMELINE ENDPOINTS ==========

// Get all recent activities (dashboard feed)
app.get("/activities", optionalAuth, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    try {
        const activities = await getRecentActivities(limit);
        res.json(activities);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get activities for a specific customer
app.get("/customers/:id/activities", optionalAuth, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    try {
        const activities = await getCustomerActivities(req.params.id, limit);
        res.json(activities);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get activities for a specific lead
app.get("/leads/:id/activities", optionalAuth, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    try {
        const activities = await getLeadActivities(req.params.id, limit);
        res.json(activities);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get activities for a specific ticket
app.get("/tickets/:id/activities", optionalAuth, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    try {
        const activities = await getTicketActivities(req.params.id, limit);
        res.json(activities);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Log a manual activity (note, call, meeting)
app.post("/activities", authMiddleware, async (req, res) => {
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
app.get("/calendar/connect", authMiddleware, (req, res) => {
    const authUrl = getGoogleAuthUrl(req.user?.id);
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
        res.redirect('http://localhost:3003/settings?calendar=connected');
    } else {
        res.status(400).json({ error: result.error });
    }
});

// List upcoming events
app.get("/calendar/events", authMiddleware, async (req, res) => {
    const limit = Number(req.query.limit) || 10;
    const result = await listEvents(limit);
    if (result.success) {
        res.json(result.events);
    } else {
        res.status(500).json({ error: result.error });
    }
});

// Create a calendar event (with optional Google Meet)
app.post("/calendar/events", authMiddleware, async (req, res) => {
    const { summary, description, start, end, attendees, location, addMeet } = req.body;
    if (!summary || !start || !end) {
        return res.status(400).json({ error: "summary, start y end requeridos" });
    }
    const result = await createEvent({
        summary,
        description,
        start: new Date(start),
        end: new Date(end),
        attendees,
        location,
        addMeet: addMeet !== false, // Default true
    });
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
        clientName,
        clientEmail,
        new Date(dateTime),
        durationMinutes || 30,
        notes,
        withMeet !== false
    );
    if (result.success) {
        // Log activity
        await logActivity({
            type: 'MEETING',
            description: `Reunión agendada: ${clientName}${result.meetLink ? ' (Google Meet)' : ''}`,
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
    const result = await createFollowUpReminder(entityType, entityName, new Date(dateTime), notes);
    if (result.success) {
        res.status(201).json(result);
    } else {
        res.status(500).json({ error: result.error });
    }
});

// Check calendar configuration status
app.get("/calendar/status", (req, res) => {
    res.json({
        configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    });
});

// ========== USER INTEGRATIONS ==========

// Get user integrations
app.get("/integrations", authMiddleware, async (req, res) => {
    try {
        const integrations = await getUserIntegrations(req.user!.id);

        // Inject AssistAI Org Config
        const assistAiConfig = getOrganizationConfig('org-default');
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

        if (!wmConfig?.credentials?.agentToken) {
            return res.status(400).json({ error: 'WhatsMeow no configurado' });
        }

        const result = await whatsmeow.getQRCode(code, wmConfig.credentials.agentToken);
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

        if (!wmConfig?.credentials?.agentToken) {
            console.log('[WhatsMeow QR] No WHATSMEOW config found for user:', req.user!.id);
            return res.status(400).json({ error: 'WhatsMeow no configurado' });
        }

        const agentToken = wmConfig.credentials.agentToken as string;

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

        if (!wmConfig?.credentials?.agentCode || !wmConfig?.credentials?.agentToken) {
            return res.json({ configured: false, connected: false });
        }

        const agentCode = wmConfig.credentials.agentCode;

        try {
            const info = await whatsmeow.getAccountInfo(agentCode, wmConfig.credentials.agentToken);
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

        if (!wmConfig?.credentials?.agentCode || !wmConfig?.credentials?.agentToken) {
            return res.status(400).json({ error: 'WhatsMeow no configurado' });
        }

        const formattedTo = whatsmeow.formatPhoneNumber(to);
        const result = await whatsmeow.sendMessage(
            wmConfig.credentials.agentCode,
            wmConfig.credentials.agentToken,
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

        if (!wmConfig?.credentials?.agentCode || !wmConfig?.credentials?.agentToken) {
            return res.status(400).json({ error: 'WhatsMeow no configurado' });
        }

        const formattedTo = whatsmeow.formatPhoneNumber(to);
        const result = await whatsmeow.sendImage(
            wmConfig.credentials.agentCode,
            wmConfig.credentials.agentToken,
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

        if (!wmConfig?.credentials?.agentCode || !wmConfig?.credentials?.agentToken) {
            return res.status(400).json({ error: 'WhatsMeow no configurado' });
        }

        const formattedTo = whatsmeow.formatPhoneNumber(to);
        const result = await whatsmeow.sendAudio(
            wmConfig.credentials.agentCode,
            wmConfig.credentials.agentToken,
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

        if (!wmConfig?.credentials?.agentCode || !wmConfig?.credentials?.agentToken) {
            return res.status(400).json({ error: 'WhatsMeow no configurado' });
        }

        const formattedTo = whatsmeow.formatPhoneNumber(to);
        const result = await whatsmeow.sendDocument(
            wmConfig.credentials.agentCode,
            wmConfig.credentials.agentToken,
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

        if (!wmConfig?.credentials?.agentCode || !wmConfig?.credentials?.agentToken) {
            return res.status(400).json({ error: 'WhatsMeow no configurado' });
        }

        const result = await whatsmeow.disconnect(
            wmConfig.credentials.agentCode,
            wmConfig.credentials.agentToken
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

        if (!wmConfig?.credentials?.agentCode || !wmConfig?.credentials?.agentToken) {
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
            wmConfig.credentials.agentCode,
            wmConfig.credentials.agentToken,
            finalWebhookUrl
        );

        // Save webhook URL in credentials for reference
        await saveUserIntegration(req.user!.id, {
            provider: 'WHATSMEOW',
            credentials: {
                ...wmConfig.credentials,
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

        if (!wmConfig?.credentials?.agentCode || !wmConfig?.credentials?.agentToken) {
            return res.json({ configured: false });
        }

        try {
            const agent = await whatsmeow.getAgent(
                wmConfig.credentials.agentCode,
                wmConfig.credentials.agentToken
            );
            res.json({
                configured: true,
                agentCode: agent.code,
                connected: !!agent.deviceId,
                webhookUrl: agent.incomingWebhook || wmConfig.credentials.webhookUrl,
                webhookConfigured: !!agent.incomingWebhook
            });
        } catch (e) {
            res.json({
                configured: true,
                agentCode: wmConfig.credentials.agentCode,
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
app.get("/ai-agents", authMiddleware, async (req, res) => {
    try {
        const agents = await prisma.aiAgent.findMany({
            where: { organizationId: req.user!.organizationId || 'org-default' },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(agents);
    } catch (err: any) {
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
            const apiKey = agent.apiKey || openaiConfig?.credentials?.apiKey || process.env.OPENAI_API_KEY;

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

// Generate Analytics PDF
app.get("/reports/analytics/pdf", authMiddleware, async (req, res) => {
    try {
        await generateAnalyticsPDF(res);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
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
                await prisma.activity.create({
                    data: {
                        type: 'NOTE',
                        description: `[Automatización] ${MESSAGE_TEMPLATES[templateId]?.name || 'Personalizado'}: ${message.substring(0, 100)}`,
                        customerId: clientId,
                        metadata: { templateId, phone: formattedPhone, messageSent: message }
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

// ========== SERVER ==========

const PORT = process.env.PORT || 3002;

if (process.env.NODE_ENV !== 'test') {
    httpServer.listen(PORT, () => {
        console.log(`🚀 ChronusCRM API running on http://localhost:${PORT}`);
        console.log(`📚 API Docs: http://localhost:${PORT}/api/docs`);
        console.log(`🔌 Socket.io ready for connections`);
        if (process.env.ASSISTAI_API_TOKEN) {
            console.log(`🤖 AssistAI integration enabled`);
        }

        // Initialize cache
        initConversations();
    });
}

export { app, httpServer };
