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
import { customers, tickets, invoices, communications, transactions, leads, tags, loadAssistAICache, saveAssistAICache, channelConfigs, conversationTakeovers, type AssistAICache, type ChannelConfig, type ConversationTakeover } from "./data.js";
import type { Customer, Ticket, Invoice, Communication, TicketStatus, Transaction, Lead, Tag } from "./types.js";
import { authMiddleware, optionalAuth, requireRole, handleLogin, handleRegister, handleLogout, getAssistAIAuthUrl, handleAssistAICallback } from "./auth.js";
import { prisma } from "./db.js";
import { logActivity, getCustomerActivities, getLeadActivities, getTicketActivities, getRecentActivities, activityTypeLabels, activityTypeIcons } from "./activity.js";
import { sendEmail, verifyEmailConnection, emailTemplates } from "./email.js";
import { getGoogleAuthUrl, handleGoogleCallback, createEvent, listEvents, createClientMeeting, createFollowUpReminder } from "./calendar.js";
import { getUserIntegrations, saveUserIntegration } from "./integrations.js";
import { generateInvoicePDF, generateAnalyticsPDF } from "./reports.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Global Rate Limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: "Demasiadas solicitudes, por favor intente más tarde." }
});

// Apply granular limits to Auth routes
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 5 failed attempts per hour really (but 2 calls per login usually)
    message: { error: "Demasiados intentos de inicio de sesión, intente más tarde." }
});

app.use(limiter);
app.use("/auth/login", authLimiter);

// ========== LIVE CHAT DATA STRUCTURES ==========

type ChatMessage = {
    id: string;
    sessionId: string;
    from: string;       // User identifier (phone, email, etc)
    content: string;
    platform: 'assistai' | 'whatsapp' | 'instagram' | 'messenger';
    sender: 'user' | 'agent';
    mediaUrl?: string;  // URL of image, audio, or document
    mediaType?: 'image' | 'audio' | 'document' | 'video'; // Added video
    timestamp: Date;
    metadata?: any;     // Added for provider info
    status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
};

type Conversation = {
    sessionId: string;
    platform: 'assistai' | 'whatsapp' | 'instagram' | 'messenger';
    customerName?: string;
    customerContact: string;
    agentCode?: string;   // AssistAI agent code
    agentName?: string;   // AssistAI agent name (e.g., "Claudia")
    messages: ChatMessage[];
    status: 'active' | 'resolved';
    createdAt: Date;
    updatedAt: Date;
    metadata?: any;       // Added for provider info
};

// In-memory conversations store
const conversations: Map<string, Conversation> = new Map();

// AssistAI Config (from environment variables or defaults from provided credentials)
const ASSISTAI_CONFIG = {
    baseUrl: process.env.ASSISTAI_API_URL || 'https://public.assistai.lat',
    apiToken: process.env.ASSISTAI_API_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFzc2lzdGFpLmxhdEBnbWFpbC5jb20iLCJzdWIiOjU0LCJkYXRhIjp7InVzZXIiOnsiaWQiOjU0LCJlbWFpbCI6ImFzc2lzdGFpLmxhdEBnbWFpbC5jb20iLCJmaXJzdG5hbWUiOiJBc3Npc3RhaSIsImxhc3RuYW1lIjoiTWFya2V0aW5nIHkgc29wb3J0ZSIsInBob3RvVXJsIjoiaHR0cHM6Ly9tdWx0aW1lZGlhLmFzc2lzdGFpLmxhdC91cGxvYWRzL2Q5NGM0ZjJiNWYyNjQwNDBhMGJhMGMxYmVkY2Y5NzkzIiwicGhvbmVOdW1iZXIiOm51bGwsImNhbkNyZWF0ZU9yZ2FuaXphdGlvbnMiOnRydWV9fSwiaWF0IjoxNzY4ODU2NDg5LCJleHAiOjE3NzE0NDg0ODl9.ZqL9ayDBJMrhjrMN1M7MEjPfupItxw0yOu0v-2rKOsc',
    tenantDomain: process.env.ASSISTAI_TENANT_DOMAIN || 'ce230715ba86721e',
    organizationCode: process.env.ASSISTAI_ORG_CODE || 'd59b32edfb28e130',
    // Default sender metadata
    senderMetadata: {
        id: 54,
        email: 'assistai.lat@gmail.com',
        firstname: 'Assistai',
        lastname: 'Marketing y soporte'
    }
};

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
app.get("/health", (req, res) => res.json({ status: "ok", service: "chronus-crm" }));

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

app.put("/leads/:id", (req, res) => {
    const lead = leads.find(l => l.id === req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });

    const { name, email, company, value, status, notes, tags: leadTags } = req.body;
    if (name) lead.name = name;
    if (email) lead.email = email;
    if (company !== undefined) lead.company = company;
    if (value !== undefined) lead.value = Number(value);
    if (status) lead.status = status;
    if (notes !== undefined) lead.notes = notes;
    if (leadTags !== undefined) lead.tags = leadTags;
    lead.updatedAt = new Date();

    // Recalculate score
    lead.score = calculateLeadScore(lead);

    res.json(lead);
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
app.get("/whatsapp/providers", (req, res) => {
    // Return providers without sensitive tokens
    const safeProviders = whatsappProviders.map(p => ({
        ...p,
        config: {
            ...p.config,
            apiKey: p.config.apiKey ? '***configured***' : '',
            accessToken: p.config.accessToken ? '***configured***' : ''
        }
    }));
    res.json(safeProviders);
});

// Get single provider
app.get("/whatsapp/providers/:id", (req, res) => {
    const provider = whatsappProviders.find(p => p.id === req.params.id);
    if (!provider) return res.status(404).json({ error: "Provider no encontrado" });
    res.json(provider);
});

// Update provider config
app.put("/whatsapp/providers/:id", (req, res) => {
    const provider = whatsappProviders.find(p => p.id === req.params.id);
    if (!provider) return res.status(404).json({ error: "Provider no encontrado" });

    const { name, enabled, config, status } = req.body;
    if (name !== undefined) provider.name = name;
    if (enabled !== undefined) provider.enabled = enabled;
    if (config) {
        provider.config = { ...provider.config, ...config };
    }
    if (status) provider.status = status;

    res.json(provider);
});

// Test provider connection
app.post("/whatsapp/providers/:id/test", async (req, res) => {
    const provider = whatsappProviders.find(p => p.id === req.params.id);
    if (!provider) return res.status(404).json({ error: "Provider no encontrado" });

    try {
        if (provider.type === 'whatsmeow') {
            // Test WhatsMeow connection
            const apiUrl = provider.config.apiUrl;
            if (!apiUrl) throw new Error('API URL no configurada');

            // TODO: Cuando Bernardo proporcione la API, descomentar:
            // const response = await fetch(`${apiUrl}/status`, {
            //     headers: { 'Authorization': `Bearer ${provider.config.apiKey}` }
            // });
            // if (!response.ok) throw new Error('No se pudo conectar');

            provider.status = 'connected';
            provider.connectedAt = new Date();
            res.json({ success: true, message: 'Conexión WhatsMeow simulada exitosa' });
        } else if (provider.type === 'meta') {
            // Test Meta Business API
            if (!provider.config.accessToken) throw new Error('Access Token no configurado');

            // Verificar token con Meta
            const response = await fetch(`https://graph.facebook.com/v18.0/${provider.config.phoneNumberId}`, {
                headers: { 'Authorization': `Bearer ${provider.config.accessToken}` }
            });

            if (!response.ok) throw new Error('Token inválido o expirado');

            provider.status = 'connected';
            provider.connectedAt = new Date();
            res.json({ success: true, message: 'Conexión Meta API exitosa' });
        }
    } catch (err: any) {
        provider.status = 'error';
        provider.lastError = err.message;
        res.status(400).json({ success: false, error: err.message });
    }
});

// Request QR Code for WhatsMeow (link phone number)
app.get("/whatsapp/providers/:id/qr", async (req, res) => {
    const provider = whatsappProviders.find(p => p.id === req.params.id);
    if (!provider) return res.status(404).json({ error: "Provider no encontrado" });
    if (provider.type !== 'whatsmeow') {
        return res.status(400).json({ error: "QR solo disponible para WhatsMeow" });
    }

    try {
        const apiUrl = provider.config.apiUrl;
        if (!apiUrl) throw new Error('API URL no configurada');

        // TODO: Cuando Bernardo proporcione la API, descomentar:
        // const response = await fetch(`${apiUrl}/qr`, {
        //     headers: { 'Authorization': `Bearer ${provider.config.apiKey}` }
        // });
        // if (!response.ok) throw new Error('Error obteniendo QR');
        // const data = await response.json();
        // return res.json({ qr: data.qr, expiresIn: 60 });

        // Simulación - retorna placeholder
        provider.status = 'connecting';
        res.json({
            qr: 'SIMULATED_QR_CODE_BASE64_OR_STRING',
            expiresIn: 60,
            message: 'QR simulado - cuando Bernardo proporcione la API, se mostrará el QR real',
            instructions: [
                '1. Abre WhatsApp en tu teléfono',
                '2. Ve a Configuración > Dispositivos vinculados',
                '3. Toca "Vincular un dispositivo"',
                '4. Escanea el código QR'
            ]
        });

    } catch (err: any) {
        provider.status = 'error';
        provider.lastError = err.message;
        res.status(500).json({ error: err.message });
    }
});

// Confirm QR scan was successful (called by WhatsMeow webhook or polling)
app.post("/whatsapp/providers/:id/qr/confirm", async (req, res) => {
    const provider = whatsappProviders.find(p => p.id === req.params.id);
    if (!provider) return res.status(404).json({ error: "Provider no encontrado" });

    // This would be called when WhatsMeow confirms the QR was scanned successfully
    provider.status = 'connected';
    provider.connectedAt = new Date();
    provider.lastError = undefined;

    // Emit socket event for real-time update
    io.emit('whatsapp_connected', { providerId: provider.id, name: provider.name });

    res.json({ success: true, message: 'WhatsApp vinculado exitosamente' });
});

// Disconnect/Logout from WhatsMeow
app.post("/whatsapp/providers/:id/disconnect", async (req, res) => {
    const provider = whatsappProviders.find(p => p.id === req.params.id);
    if (!provider) return res.status(404).json({ error: "Provider no encontrado" });

    try {
        if (provider.type === 'whatsmeow' && provider.config.apiUrl) {
            // TODO: Cuando Bernardo proporcione la API:
            // await fetch(`${provider.config.apiUrl}/logout`, {
            //     method: 'POST',
            //     headers: { 'Authorization': `Bearer ${provider.config.apiKey}` }
            // });
        }

        provider.status = 'disconnected';
        provider.connectedAt = undefined;
        io.emit('whatsapp_disconnected', { providerId: provider.id });

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
    let provider = providerId
        ? whatsappProviders.find(p => p.id === providerId && p.enabled)
        : whatsappProviders.find(p => p.enabled && p.status === 'connected');

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

    try {
        if (provider.type === 'whatsmeow') {
            // Enviar via WhatsMeow API (Bernardo)
            const apiUrl = provider.config.apiUrl;

            // TODO: Descomentar cuando Bernardo proporcione la API:
            // const response = await fetch(`${apiUrl}/send`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': `Bearer ${provider.config.apiKey}`
            //     },
            //     body: JSON.stringify({
            //         jid: `${message.to}@s.whatsapp.net`,
            //         message: content
            //     })
            // });
            // if (!response.ok) throw new Error('Error enviando mensaje');

            message.status = 'sent';
            console.log(`[WhatsMeow] Mensaje simulado a ${to}: ${content}`);

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

    // Find or create conversation
    let conversation = conversations.get(sessionId);
    if (!conversation) {
        conversation = {
            sessionId,
            platform,
            customerName: from, // Initially use phone/id as name
            customerContact: from,
            messages: [],
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: { providerId } // Store providerId to know how to reply
        };

        // Try to match with existing client to get better name (only for phone/email based IDs)
        if (!explicitSessionId) {
            const customer = customers.find((c: Customer) => c.phone === from || c.email === from);
            if (customer) {
                conversation.customerName = customer.name;
            }
        }

        conversations.set(sessionId, conversation);
    } else {
        // Update metadata if needed (e.g. if provider changed)
        if (providerId) {
            conversation.metadata = { ...conversation.metadata, providerId };
        }
    }
    // ...

    conversation.messages.push(newMessage);
    conversation.updatedAt = new Date();

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
                    const provider = whatsappProviders.find(p => p.config.phoneNumberId === phoneNumberId);
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

    const conversation = conversations.get(sessionId);
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

            // reuse /whatsapp/send logic or call it internally? 
            // Better to reimplement core valid logic here to avoid overhead of HTTP loopback

            let provider = providerId
                ? whatsappProviders.find(p => p.id === providerId && p.enabled)
                : whatsappProviders.find(p => p.enabled && p.status === 'connected'); // Fallback to any active

            if (!provider) {
                console.warn('[Chat Send] No active WhatsApp provider found for reply');
                // We still save to history but mark as failed? Or just warn?
                // For now prompt success but log warning
            } else {
                if (provider.type === 'whatsmeow') {
                    // Send via WhatsMeow
                    console.log(`[WhatsMeow] Sending to ${to}: ${content}`);
                    // TODO: Call Bernardo's API
                    // await fetch(`${provider.config.apiUrl}/send`, ...)
                } else if (provider.type === 'meta') {
                    // Send via Meta
                    console.log(`[Meta] Sending to ${to} via ${provider.id}: ${content}`);

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
                                to: to,
                                type: 'text',
                                text: { body: content }
                            })
                        }
                    );

                    if (!response.ok) {
                        const err = await response.json();
                        console.error('[Meta Send Error]', err);
                        // Don't fail the request to UI, but log it
                    }
                }
            }
        } else if (conversation.platform === 'assistai') {
            // Send via AssistAI
            // Ensure we use the configuration compatible with the new documentation
            const messageData = {
                content,
                senderMetadata: ASSISTAI_CONFIG.senderMetadata // Use default metadata for now
            };

            // We assume sessionId is the conversation UUID required by AssistAI
            try {
                await assistaiPost(`/conversations/${sessionId}/messages`, messageData);
                console.log(`[AssistAI] Sent via Unified Send to ${sessionId}`);
                newMessage.status = 'sent';
            } catch (error: any) {
                console.error(`[AssistAI] Failed to send:`, error.message);
                newMessage.status = 'failed';
                // We proceed to save it as failed so user sees error
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
app.get("/conversations", (req, res) => {
    const list = Array.from(conversations.values())
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json(list);
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
                assistaiFetch(`/conversations?take=1&customerContact=${encodeURIComponent(phone)}`),
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

// AssistAI Config (from environment variables or defaults from provided credentials)


// Helper for AssistAI GET requests
async function assistaiFetch(endpoint: string) {
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${ASSISTAI_CONFIG.apiToken}`,
        'x-tenant-domain': ASSISTAI_CONFIG.tenantDomain,
        'x-organization-code': ASSISTAI_CONFIG.organizationCode,
        'Content-Type': 'application/json',
    };
    const res = await fetch(`${ASSISTAI_CONFIG.baseUrl}/api/v1${endpoint}`, { headers });
    if (!res.ok) throw new Error(`AssistAI error: ${res.status}`);
    return res.json();
}

// Helper for AssistAI POST requests
async function assistaiPost(endpoint: string, body: any) {
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${ASSISTAI_CONFIG.apiToken}`,
        'x-tenant-domain': ASSISTAI_CONFIG.tenantDomain,
        'x-organization-code': ASSISTAI_CONFIG.organizationCode,
        'Content-Type': 'application/json',
    };
    const res = await fetch(`${ASSISTAI_CONFIG.baseUrl}/api/v1${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `AssistAI error: ${res.status}`);
    }
    return res.json();
}

// Send message to AssistAI conversation (from CRM Inbox)
app.post("/assistai/conversations/:conversationId/messages", async (req, res) => {
    const { conversationId } = req.params;
    const { content, senderName, senderEmail } = req.body;

    if (!content) {
        return res.status(400).json({ error: "content es requerido" });
    }

    try {
        const messageData = {
            content,
            senderMetadata: {
                id: ASSISTAI_CONFIG.senderMetadata.id,
                email: senderEmail || ASSISTAI_CONFIG.senderMetadata.email,
                firstname: senderName?.split(' ')[0] || ASSISTAI_CONFIG.senderMetadata.firstname,
                lastname: senderName?.split(' ').slice(1).join(' ') || ASSISTAI_CONFIG.senderMetadata.lastname
            }
        };

        const result = await assistaiPost(`/conversations/${conversationId}/messages`, messageData);

        console.log(`[AssistAI] Mensaje enviado a conversación ${conversationId}: ${content.substring(0, 50)}...`);

        // Emit socket event for real-time update
        io.emit('message_sent', {
            conversationId,
            content,
            sender: 'agent',
            timestamp: new Date().toISOString()
        });

        res.json({ success: true, data: result });
    } catch (err: any) {
        console.error('[AssistAI] Error enviando mensaje:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET AssistAI Agents
app.get("/assistai/agents", async (req, res) => {
    try {
        console.log('[AssistAI] Fetching agents...');
        // Timeout promise
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout connecting to AssistAI')), 5000));

        // Race between fetch and timeout
        const data: any = await Promise.race([
            assistaiFetch('/agents'),
            timeout
        ]);

        // Cache successful response
        if (data && data.data) {
            cachedAgents = data.data;
            // Background save
            const currentCache = loadAssistAICache();
            currentCache.agents = cachedAgents;
            saveAssistAICache(currentCache);
        }

        res.json(data);
    } catch (err: any) {
        console.error('[AssistAI] Agent fetch failed:', err.message);

        // Fallback to cache
        if (cachedAgents.length > 0) {
            console.log('[AssistAI] Returning cached agents');
            res.json({ data: cachedAgents, meta: { source: 'cache_fallback' } });
        } else {
            res.status(500).json({ error: err.message || "Failed to fetch agents and no cache available" });
        }
    }
});

// PATCH Update AssistAI Agent
app.patch("/assistai/agents/:code", async (req, res) => {
    const { code } = req.params;
    const updateData = req.body;

    try {
        // Proxy update to AssistAI
        const response = await fetch(`${process.env.ASSISTAI_API_URL}/api/v1/agents/${code}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${process.env.ASSISTAI_API_TOKEN}`,
                'Content-Type': 'application/json',
                'x-tenant-domain': process.env.ASSISTAI_TENANT_DOMAIN || '',
                'x-organization-code': process.env.ASSISTAI_ORG_CODE || ''
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return res.status(response.status).json({
                error: errorData.message || 'Error updating agent',
                details: errorData
            });
        }

        const result = await response.json();

        // Update local cache
        const cacheIndex = cachedAgents.findIndex(a => a.code === code);
        if (cacheIndex >= 0) {
            cachedAgents[cacheIndex] = { ...cachedAgents[cacheIndex], ...updateData };
        }

        res.json({ success: true, agent: result });
    } catch (err: any) {
        console.error("Error updating agent:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET AssistAI Conversations 
app.get("/assistai/conversations", async (req, res) => {
    try {
        const { page = 1, take = 20 } = req.query;
        const data = await assistaiFetch(`/conversations?page=${page}&take=${take}`);
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET AssistAI Conversation Messages
app.get("/assistai/conversations/:uuid/messages", async (req, res) => {
    try {
        const { uuid } = req.params;
        const { page = 1, take = 50 } = req.query;
        const data = await assistaiFetch(`/conversations/${uuid}/messages?page=${page}&take=${take}&order=ASC`);
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Sync AssistAI conversations into local inbox
app.post("/assistai/sync", async (req, res) => {
    try {
        const convData = await assistaiFetch('/conversations?take=50');
        const synced: string[] = [];

        for (const conv of convData.data || []) {
            const sessionId = `assistai-${conv.uuid}`;
            if (!conversations.has(sessionId)) {
                // Fetch messages
                const msgData = await assistaiFetch(`/conversations/${conv.uuid}/messages?take=100&order=ASC`);
                const messages: ChatMessage[] = (msgData.data || []).map((m: any) => ({
                    id: `assistai-msg-${m.id}`,
                    sessionId,
                    from: m.sender === 'user' ? conv.title || 'Usuario' : 'AssistAI Bot',
                    content: m.content,
                    platform: 'assistai' as const,
                    sender: m.sender === 'user' ? 'user' as const : 'agent' as const,
                    timestamp: new Date(m.timestamp || m.createdAt)
                }));

                conversations.set(sessionId, {
                    sessionId,
                    platform: 'assistai',
                    customerName: conv.title || 'Usuario AssistAI',
                    customerContact: conv.uuid,
                    messages,
                    status: 'active',
                    createdAt: new Date(conv.createdAt),
                    updatedAt: new Date()
                });
                synced.push(sessionId);
            }
        }

        io.emit("inbox_refresh", { synced: synced.length });
        res.json({ success: true, synced: synced.length, total: conversations.size });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Local Agent Config Store (for custom notes, assignments)
type AgentLocalConfig = {
    code: string;
    customName?: string;
    notes?: string;
    assignedToUserId?: string;
    updatedAt: Date;
};
const agentLocalConfigs: Map<string, AgentLocalConfig> = new Map();

// GET Single AssistAI Agent Details
app.get("/assistai/agents/:code", async (req, res) => {
    const { code } = req.params;

    try {
        // First get the agent basic info
        let agent = null;
        try {
            const agentsData = await assistaiFetch('/agents');
            agent = (agentsData.data || []).find((a: any) => a.code === code);
        } catch (agentErr: any) {
            console.error("Error fetching agents from AssistAI:", agentErr.message);
            return res.status(503).json({
                error: "Error conectando con AssistAI",
                details: agentErr.message,
                retryable: true
            });
        }

        if (!agent) {
            return res.status(404).json({ error: "Agente no encontrado" });
        }

        // Merge with local config
        const localConfig = agentLocalConfigs.get(code);

        // Try to get conversation stats (but don't fail if this errors)
        let stats = { totalConversations: 0, recentConversations: [] as any[] };
        try {
            const convData = await assistaiFetch('/conversations?take=100');
            const agentConversations = (convData.data || []).filter((c: any) => c.agentCode === code);
            stats = {
                totalConversations: agentConversations.length,
                recentConversations: agentConversations.slice(0, 5)
            };
        } catch (convErr: any) {
            console.error("Error fetching conversations for agent stats:", convErr.message);
            // Continue with empty stats - non-critical error
        }

        res.json({
            ...agent,
            localConfig: localConfig || null,
            stats
        });
    } catch (err: any) {
        console.error("Unexpected error in agent detail:", err);
        res.status(500).json({ error: err.message, retryable: true });
    }
});

// PUT Update Local Agent Config
app.put("/assistai/agents/:code/config", (req, res) => {
    const { code } = req.params;
    const { customName, notes, assignedToUserId } = req.body;

    const existing = agentLocalConfigs.get(code) || { code, updatedAt: new Date() };
    const updated: AgentLocalConfig = {
        ...existing,
        customName: customName !== undefined ? customName : existing.customName,
        notes: notes !== undefined ? notes : existing.notes,
        assignedToUserId: assignedToUserId !== undefined ? assignedToUserId : existing.assignedToUserId,
        updatedAt: new Date()
    };

    agentLocalConfigs.set(code, updated);
    res.json({ success: true, config: updated });
});

// GET All Agent Local Configs
app.get("/assistai/configs", (req, res) => {
    res.json(Array.from(agentLocalConfigs.values()));
});

// Enhanced Sync: Fetch all conversations with messages and agent/platform info
app.post("/assistai/sync-all", async (req, res) => {
    try {
        // First get all agents to map codes to names
        const agentsData = await assistaiFetch('/agents');
        const agentsMap = new Map<string, string>();
        for (const agent of agentsData.data || []) {
            agentsMap.set(agent.code, agent.name);
        }

        // Get all conversations
        const convData = await assistaiFetch('/conversations?take=100');
        const synced: string[] = [];
        const updated: string[] = [];

        for (const conv of convData.data || []) {
            const sessionId = `assistai-${conv.uuid}`;

            // Fetch messages for this conversation
            const msgData = await assistaiFetch(`/conversations/${conv.uuid}/messages?take=100&order=ASC`);
            const messagesRaw = msgData.data || [];

            // Detect platform from first message's channel field
            const firstMessage = messagesRaw[0];
            let platform: 'assistai' | 'whatsapp' | 'instagram' = 'assistai';
            if (firstMessage?.channel === 'whatsapp') platform = 'whatsapp';
            else if (firstMessage?.channel === 'instagram') platform = 'instagram';

            // Get agent info - API doesn't provide agentCode, so we show unknown
            // TODO: Request AssistAI to add agentCode to conversations endpoint
            const agentCode = conv.agentCode || '';
            const agentName = agentCode ? (agentsMap.get(agentCode) || 'AssistAI Bot') : 'Agente Desconocido';

            // Customer contact info (IG username or phone number)
            const customerContact = conv.sender || conv.contactPhone || conv.uuid;
            // Format display name based on platform
            const customerName = platform === 'instagram'
                ? `@${customerContact}`
                : platform === 'whatsapp'
                    ? `+${customerContact.replace(/[^\d]/g, '')}`
                    : customerContact;

            const messages: ChatMessage[] = messagesRaw.map((m: any) => ({
                id: `assistai-msg-${m.uuid || m.id}`,
                sessionId,
                from: m.sender === 'customer' || m.role === 'user'
                    ? customerName
                    : agentName,
                content: m.content,
                platform: platform,
                sender: (m.sender === 'customer' || m.role === 'user') ? 'user' as const : 'agent' as const,
                mediaUrl: m.mediaUrl,
                mediaType: m.mediaType,
                timestamp: new Date(m.timestamp || m.createdAt)
            }));

            const isNew = !conversations.has(sessionId);

            conversations.set(sessionId, {
                sessionId,
                platform,
                customerName,
                customerContact,
                agentCode,
                agentName,
                messages,
                status: 'active',
                createdAt: new Date(conv.createdAt || conv.lastMessageDate),
                updatedAt: new Date(conv.lastMessageDate || new Date())
            });

            if (isNew) {
                synced.push(sessionId);
            } else {
                updated.push(sessionId);
            }
        }

        // Update cached agents and save to disk
        cachedAgents = agentsData.data || [];
        saveAssistAICache({
            lastSync: new Date().toISOString(),
            agents: cachedAgents,
            conversations: Array.from(conversations.values()),
            agentConfigs: Array.from(agentLocalConfigs.values())
        });

        io.emit("inbox_refresh", { synced: synced.length, updated: updated.length });
        res.json({
            success: true,
            synced: synced.length,
            updated: updated.length,
            total: conversations.size,
            agents: agentsData.data?.length || 0
        });
    } catch (err: any) {
        console.warn("Sync-all: AssistAI unavailable, using cached data");
        // Return cached data instead of error
        const cachedConvs = Array.from(conversations.values());
        res.json({
            success: true,
            cached: true,
            synced: 0,
            updated: 0,
            total: cachedConvs.length,
            agents: cachedAgents.length,
            message: 'Using cached data - AssistAI temporarily unavailable'
        });
    }
});

// Get conversation messages with full details
app.get("/conversations/:sessionId/messages", (req, res) => {
    const conversation = conversations.get(req.params.sessionId);
    if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
    }
    res.json({
        sessionId: conversation.sessionId,
        platform: conversation.platform,
        agentCode: conversation.agentCode,
        agentName: conversation.agentName,
        customerName: conversation.customerName,
        messages: conversation.messages
    });
});


// ========== INBOX AGENT SUBSCRIPTION ==========

// Store for subscribed agents per user/session (in production, use DB)
let subscribedAgentCodes: string[] = []; // Default: all agents
let lastSyncTime: Date = new Date(0);

// GET Subscribed Agents
app.get("/inbox/subscribed-agents", (req, res) => {
    res.json({ agents: subscribedAgentCodes, subscribeAll: subscribedAgentCodes.length === 0 });
});

// POST Update Subscribed Agents
app.post("/inbox/subscribed-agents", (req, res) => {
    const { agents } = req.body;
    if (!Array.isArray(agents)) {
        return res.status(400).json({ error: "agents must be an array" });
    }
    subscribedAgentCodes = agents;
    res.json({ success: true, agents: subscribedAgentCodes });
});

// Polling endpoint for real-time updates
app.get("/assistai/poll", async (req, res) => {
    try {
        const since = req.query.since ? new Date(req.query.since as string) : lastSyncTime;

        // Try to get agents map for names (with fallback)
        let agentsMap = new Map<string, string>();
        try {
            const agentsData = await assistaiFetch('/agents');
            for (const agent of agentsData.data || []) {
                agentsMap.set(agent.code, agent.name);
            }
        } catch (agentErr) {
            console.warn('Could not fetch agents, using cached names');
        }

        // Try to get recent conversations (with fallback)
        let convData: any = { data: [] };
        try {
            convData = await assistaiFetch('/conversations?take=50');
        } catch (convErr) {
            console.warn('AssistAI conversations unavailable, returning cached data');
            // Return cached conversations when external API fails
            const cachedConvs = Array.from(conversations.values()).map(c => ({
                sessionId: c.sessionId,
                agentCode: c.agentCode,
                agentName: c.agentName,
                platform: c.platform,
                messageCount: c.messages.length
            }));
            return res.json({
                success: true,
                cached: true,
                since: since.toISOString(),
                now: new Date().toISOString(),
                new: [],
                updated: [],
                conversations: cachedConvs,
                subscribedAgents: subscribedAgentCodes.length > 0 ? subscribedAgentCodes : 'all'
            });
        }

        const newConversations: any[] = [];
        const updatedConversations: any[] = [];

        for (const conv of convData.data || []) {
            const convUpdatedAt = new Date(conv.updatedAt || conv.createdAt);

            // Skip if older than since time
            if (convUpdatedAt <= since) continue;

            // Filter by subscribed agents if any are set
            if (subscribedAgentCodes.length > 0 && !subscribedAgentCodes.includes(conv.agentCode)) {
                continue;
            }

            const sessionId = `assistai-${conv.uuid}`;
            const isNew = !conversations.has(sessionId);

            // Fetch messages (with error handling)
            let messagesRaw: any[] = [];
            try {
                const msgData = await assistaiFetch(`/conversations/${conv.uuid}/messages?take=100&order=ASC`);
                messagesRaw = msgData.data || [];
            } catch (msgErr) {
                console.warn(`Could not fetch messages for ${conv.uuid}`);
                continue;
            }

            // Detect platform from first message's channel field
            const firstMessage = messagesRaw[0];
            let platform: 'assistai' | 'whatsapp' | 'instagram' = 'assistai';
            if (firstMessage?.channel === 'whatsapp') platform = 'whatsapp';
            else if (firstMessage?.channel === 'instagram') platform = 'instagram';

            const agentCode = conv.agentCode || (convData.data?.[0]?.agentCode);
            const agentName = agentsMap.get(agentCode) || 'AssistAI Bot';

            // Customer contact info
            const customerContact = conv.sender || conv.contactPhone || conv.uuid;
            const customerName = platform === 'instagram'
                ? `@${customerContact}`
                : platform === 'whatsapp'
                    ? `+${customerContact.replace(/[^\d]/g, '')}`
                    : customerContact;

            const messages: ChatMessage[] = messagesRaw.map((m: any) => ({
                id: `assistai-msg-${m.uuid || m.id}`,
                sessionId,
                from: m.sender === 'customer' || m.role === 'user'
                    ? customerName
                    : agentName,
                content: m.content,
                platform,
                sender: (m.sender === 'customer' || m.role === 'user') ? 'user' as const : 'agent' as const,
                mediaUrl: m.mediaUrl,
                mediaType: m.mediaType,
                timestamp: new Date(m.timestamp || m.createdAt)
            }));

            conversations.set(sessionId, {
                sessionId,
                platform,
                customerName,
                customerContact,
                agentCode,
                agentName,
                messages,
                status: 'active',
                createdAt: new Date(conv.createdAt || conv.lastMessageDate),
                updatedAt: new Date(conv.lastMessageDate || new Date())
            });

            if (isNew) {
                newConversations.push({ sessionId, agentCode, agentName, platform, messageCount: messages.length });
            } else {
                updatedConversations.push({ sessionId, agentCode, agentName, platform, messageCount: messages.length });
            }
        }

        // Update last sync time
        lastSyncTime = new Date();

        // Emit socket event for real-time UI updates
        if (newConversations.length > 0 || updatedConversations.length > 0) {
            io.emit("inbox_refresh", {
                newCount: newConversations.length,
                updatedCount: updatedConversations.length,
                timestamp: lastSyncTime.toISOString()
            });

            // Auto-save to cache after updates
            saveAssistAICache({
                lastSync: lastSyncTime.toISOString(),
                agents: cachedAgents,
                conversations: Array.from(conversations.values()),
                agentConfigs: []
            });
        }

        res.json({
            success: true,
            since: since.toISOString(),
            now: lastSyncTime.toISOString(),
            new: newConversations,
            updated: updatedConversations,
            subscribedAgents: subscribedAgentCodes.length > 0 ? subscribedAgentCodes : 'all'
        });
    } catch (err: any) {
        console.error("Poll error:", err);
        // Return empty result instead of error to prevent frontend crash
        res.json({
            success: false,
            error: err.message,
            new: [],
            updated: [],
            conversations: Array.from(conversations.values()).map(c => ({
                sessionId: c.sessionId,
                platform: c.platform,
                messageCount: c.messages.length
            }))
        });
    }
});


// ========== ASSISTAI WEBHOOK (Real-time notifications) ==========

// Webhook log for debugging
const webhookLogs: Array<{ timestamp: Date; event: string; payload: any }> = [];

// POST webhook endpoint for AssistAI to call
app.post("/webhooks/assistai", async (req, res) => {
    const signature = req.headers['x-assistai-signature'] as string;
    const event = req.headers['x-assistai-event'] as string || 'unknown';
    const payload = req.body;

    // Log the webhook call
    console.log(`📨 Webhook received: ${event}`, JSON.stringify(payload).substring(0, 200));
    webhookLogs.push({ timestamp: new Date(), event, payload });

    // Keep only last 100 logs
    if (webhookLogs.length > 100) webhookLogs.shift();

    // TODO: Verify signature when AssistAI provides signing secret
    // const expectedSignature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(JSON.stringify(payload)).digest('hex');
    // if (signature !== expectedSignature) return res.status(401).json({ error: 'Invalid signature' });

    try {
        switch (event) {
            case 'new_message':
            case 'message.created': {
                // New message received
                const { conversationId, sessionId, message, agentCode, platform } = payload;
                const convId = sessionId || conversationId;

                if (convId && conversations.has(convId)) {
                    const conv = conversations.get(convId)!;

                    // Add message to conversation
                    const newMsg = {
                        id: message?.id || `msg-wh-${Date.now()}`,
                        sessionId: convId,
                        from: message?.from || payload.customerName || 'Cliente',
                        content: message?.content || message?.text || '',
                        platform: platform || conv.platform || 'assistai',
                        sender: message?.sender || (message?.isFromCustomer ? 'user' : 'agent'),
                        mediaUrl: message?.mediaUrl,
                        mediaType: message?.mediaType,
                        timestamp: message?.createdAt || new Date().toISOString()
                    };

                    conv.messages.push(newMsg as any);
                    conv.updatedAt = new Date();

                    // Emit socket event for real-time update
                    io.emit('new_message', { sessionId: convId, message: newMsg });
                    io.to(convId).emit('chat_message', newMsg);
                    io.emit('inbox_refresh');

                    console.log(`✅ Message added to conversation ${convId}`);
                } else if (convId) {
                    // New conversation - create it
                    const newConv = {
                        sessionId: convId,
                        customerName: payload.customerName || 'Nuevo contacto',
                        customerContact: payload.customerContact || payload.phone || payload.instagram || '',
                        platform: platform || 'assistai',
                        agentCode: agentCode,
                        agentName: payload.agentName,
                        messages: [],
                        status: 'active' as const,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    conversations.set(convId, newConv);
                    io.emit('inbox_refresh');
                    console.log(`✅ New conversation created: ${convId}`);
                }
                break;
            }

            case 'conversation.created':
            case 'conversation_created': {
                // New conversation started
                const { sessionId, conversationId, agentCode, customerInfo } = payload;
                const convId = sessionId || conversationId;

                if (convId && !conversations.has(convId)) {
                    const newConv = {
                        sessionId: convId,
                        customerName: customerInfo?.name || 'Nuevo contacto',
                        customerContact: customerInfo?.phone || customerInfo?.instagram || customerInfo?.email || '',
                        platform: payload.platform || 'assistai',
                        agentCode: agentCode,
                        agentName: payload.agentName,
                        messages: [],
                        status: 'active' as const,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    conversations.set(convId, newConv);
                    io.emit('inbox_refresh');
                    io.emit('notification', {
                        id: `notif-${Date.now()}`,
                        type: 'message',
                        title: 'Nueva conversación',
                        body: `${newConv.customerName} inició una conversación`
                    });
                }
                break;
            }

            case 'conversation.resolved':
            case 'conversation_resolved': {
                const { sessionId, conversationId } = payload;
                const convId = sessionId || conversationId;

                if (convId && conversations.has(convId)) {
                    const conv = conversations.get(convId)!;
                    conv.status = 'resolved';
                    io.emit('inbox_refresh');
                }
                break;
            }

            case 'ai.paused':
            case 'ai_paused': {
                // Agent took over conversation
                console.log(`🤖 AI paused for conversation: ${payload.sessionId || payload.conversationId}`);
                break;
            }

            default:
                console.log(`⚠️ Unknown webhook event: ${event}`);
        }

        res.json({ success: true, message: 'Webhook processed' });
    } catch (err: any) {
        console.error('Webhook processing error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET webhook logs (for debugging)
app.get("/webhooks/assistai/logs", (req, res) => {
    res.json({
        logs: webhookLogs.slice(-20).reverse(),
        total: webhookLogs.length
    });
});

// Webhook configuration info for AssistAI team
app.get("/webhooks/assistai/config", (req, res) => {
    const baseUrl = req.headers.host?.includes('localhost')
        ? `http://${req.headers.host}`
        : `https://${req.headers.host}`;

    res.json({
        endpoint: `${baseUrl}/webhooks/assistai`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-assistai-event': 'Event type (new_message, conversation.created, etc.)',
            'x-assistai-signature': 'HMAC-SHA256 signature (optional for now)'
        },
        supportedEvents: [
            'new_message / message.created',
            'conversation.created / conversation_created',
            'conversation.resolved / conversation_resolved',
            'ai.paused / ai_paused'
        ],
        examplePayload: {
            sessionId: 'conv-123',
            agentCode: 'agent-claudia',
            platform: 'whatsapp',
            customerName: 'Eduardo',
            customerContact: '+584144314817',
            message: {
                id: 'msg-456',
                content: 'Hola, necesito ayuda',
                from: 'Eduardo',
                isFromCustomer: true,
                createdAt: new Date().toISOString()
            }
        }
    });
});


// ========== CONTACT IDENTITY MANAGEMENT ==========

import type { ContactIdentity, ContactType } from './types.js';

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
        '/assistai/agents': {
            get: { tags: ['AssistAI'], summary: 'Listar agentes de IA', responses: { '200': { description: 'Lista de agentes' } } }
        },
        '/assistai/agents/{code}': {
            get: { tags: ['AssistAI'], summary: 'Obtener detalle de agente', parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Agente con estadísticas' } } },
            patch: { tags: ['AssistAI'], summary: 'Actualizar agente', parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, instructions: { type: 'string' } } } } } }, responses: { '200': { description: 'Agente actualizado' } } }
        },
        '/assistai/conversations': {
            get: { tags: ['AssistAI'], summary: 'Listar conversaciones de AssistAI', parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'take', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'Conversaciones' } } }
        },
        '/assistai/sync-all': {
            post: { tags: ['AssistAI'], summary: 'Sincronizar todas las conversaciones', description: 'Sincroniza todas las conversaciones de AssistAI al inbox local', responses: { '200': { description: 'Sincronización completada' } } }
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
        select: { id: true, email: true, name: true, role: true, avatar: true, phone: true, createdAt: true, lastLoginAt: true }
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
        res.json(integrations);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Save user integration
app.post("/integrations", authMiddleware, async (req, res) => {
    const { provider, credentials, isEnabled } = req.body;
    if (!provider || !credentials) {
        return res.status(400).json({ error: "provider y credentials requeridos" });
    }
    try {
        const integration = await saveUserIntegration(req.user!.id, {
            provider,
            credentials,
            isEnabled: isEnabled !== false
        });
        res.json(integration);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
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
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date() });
});

// ========== SERVER ==========

const PORT = process.env.PORT || 3002;

if (process.env.NODE_ENV !== 'test') {
    httpServer.listen(PORT, () => {
        console.log(`🚀 ChronusCRM API running on http://localhost:${PORT}`);
        console.log(`📚 API Docs: http://localhost:${PORT}/api/docs`);
        console.log(`🔌 Socket.io ready for connections`);
        if (ASSISTAI_CONFIG.apiToken) {
            console.log(`🤖 AssistAI integration enabled`);
        }

        // Initialize cache
        initializeFromCache();
    });
}

export { app, httpServer };
