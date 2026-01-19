import 'dotenv/config';
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import { apiReference } from '@scalar/express-api-reference';
import { customers, tickets, invoices, communications, transactions, leads, loadAssistAICache, saveAssistAICache, type AssistAICache } from "./data.js";
import type { Customer, Ticket, Invoice, Communication, TicketStatus, Transaction, Lead } from "./types.js";

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
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ========== LIVE CHAT DATA STRUCTURES ==========

type ChatMessage = {
    id: string;
    sessionId: string;
    from: string;       // User identifier (phone, email, etc)
    content: string;
    platform: 'assistai' | 'whatsapp' | 'instagram' | 'messenger';
    sender: 'user' | 'agent';
    mediaUrl?: string;  // URL of image, audio, or document
    mediaType?: 'image' | 'audio' | 'document';
    timestamp: Date;
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
};

// In-memory conversations store
const conversations: Map<string, Conversation> = new Map();

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

app.get("/leads", (req, res) => {
    const { status } = req.query;
    let filtered = leads;
    if (status) filtered = filtered.filter(l => l.status === status);
    // Sort by recent first
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(filtered);
});

app.post("/leads", (req, res) => {
    const { name, email, company, value, status = "NEW", notes, source = "MANUAL" } = req.body;
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
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    leads.push(lead);
    res.json(lead);
});

app.put("/leads/:id", (req, res) => {
    const lead = leads.find(l => l.id === req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });

    const { name, email, company, value, status, notes } = req.body;
    if (name) lead.name = name;
    if (email) lead.email = email;
    if (company !== undefined) lead.company = company;
    if (value !== undefined) lead.value = Number(value);
    if (status) {
        // Here we could implement "Convert to Customer" logic if status === 'WON'
        lead.status = status;
    }
    if (notes !== undefined) lead.notes = notes;
    lead.updatedAt = new Date();

    res.json(lead);
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
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    leads.push(lead);
    console.log(`[Webhook] Lead creado: ${lead.id} (${lead.email})`);


    res.json({ success: true, id: lead.id, message: "Lead creado exitosamente" });
});

app.post("/webhooks/messages/incoming", (req, res) => {
    // Universal Webhook for WhatsApp, Instagram, Messenger, AssistAI
    const { from, content, platform = "assistai", sessionId: providedSessionId, customerName, mediaUrl, mediaType, agentCode, agentName } = req.body;

    if (!from || (!content && !mediaUrl)) {
        return res.status(400).json({ error: "Missing from or content/mediaUrl" });
    }

    // Use provided sessionId or generate one based on `from`
    const sessionId = providedSessionId || `session-${from.replace(/[^a-zA-Z0-9]/g, '')}`;

    const newMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        sessionId,
        from,
        content: content || '',
        platform: platform as any,
        sender: "user",
        mediaUrl,
        mediaType,
        timestamp: new Date()
    };

    // Find or create conversation
    let conversation = conversations.get(sessionId);
    if (!conversation) {
        conversation = {
            sessionId,
            platform: platform as any,
            customerName: customerName || from,
            customerContact: from,
            agentCode: agentCode,
            agentName: agentName,
            messages: [],
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date()
        };
        conversations.set(sessionId, conversation);
    } else {
        // Update agent info if provided
        if (agentCode) conversation.agentCode = agentCode;
        if (agentName) conversation.agentName = agentName;
    }

    conversation.messages.push(newMessage);
    conversation.updatedAt = new Date();

    // Real-time broadcast to room and general inbox
    io.to(sessionId).emit("new_message", newMessage);
    io.emit("inbox_update", { sessionId, message: newMessage });
    console.log(`[Message] From ${from} (${platform}): ${content}`);

    res.json({ success: true, sessionId, messageId: newMessage.id });
});

// Agent sends reply
app.post("/chat/send", (req, res) => {
    const { sessionId, content } = req.body;

    if (!sessionId || !content) {
        return res.status(400).json({ error: "Missing sessionId or content" });
    }

    const conversation = conversations.get(sessionId);
    if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
    }

    const newMessage: ChatMessage = {
        id: `msg-agent-${Date.now()}`,
        sessionId,
        from: "Support Agent",
        content,
        platform: conversation.platform,
        sender: "agent",
        timestamp: new Date()
    };

    conversation.messages.push(newMessage);
    conversation.updatedAt = new Date();

    // Real-time broadcast to user widget
    io.to(sessionId).emit("new_message", newMessage);
    io.emit("inbox_update", { sessionId, message: newMessage });

    res.json({ success: true, message: newMessage });
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

// ========== USERS PROXY ==========

app.get("/users", async (req, res) => {
    const CHRONUSDEV_URL = process.env.CHRONUSDEV_API_URL || "http://127.0.0.1:3001";
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
        console.error("Error setting up users proxy:", err);
        res.status(500).json({ error: "Error fetching users from ChronusDev" });
    }
});

// ========== ASSISTAI INTEGRATION ==========

// AssistAI Config (from environment variables)
const ASSISTAI_CONFIG = {
    baseUrl: process.env.ASSISTAI_API_URL || 'https://public.assistai.lat',
    apiToken: process.env.ASSISTAI_API_TOKEN || '',
    tenantDomain: process.env.ASSISTAI_TENANT_DOMAIN || '',
    organizationCode: process.env.ASSISTAI_ORG_CODE || '',
};

// Helper for AssistAI requests
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

// GET AssistAI Agents
app.get("/assistai/agents", async (req, res) => {
    try {
        const data = await assistaiFetch('/agents');
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
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
        console.error("Sync-all error:", err);
        res.status(500).json({ error: err.message });
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

        // Get agents map for names
        const agentsData = await assistaiFetch('/agents');
        const agentsMap = new Map<string, string>();
        for (const agent of agentsData.data || []) {
            agentsMap.set(agent.code, agent.name);
        }

        // Get recent conversations
        const convData = await assistaiFetch('/conversations?take=50');
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

            // Fetch messages
            const msgData = await assistaiFetch(`/conversations/${conv.uuid}/messages?take=100&order=ASC`);
            const messagesRaw = msgData.data || [];

            // Detect platform from first message's channel field
            const firstMessage = messagesRaw[0];
            let platform: 'assistai' | 'whatsapp' | 'instagram' = 'assistai';
            if (firstMessage?.channel === 'whatsapp') platform = 'whatsapp';
            else if (firstMessage?.channel === 'instagram') platform = 'instagram';

            const agentCode = conv.agentCode || (agentsData.data?.[0]?.code);
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
        res.status(500).json({ error: err.message });
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
        { name: 'Notifications', description: 'Sistema de notificaciones y push para móviles' }
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
        '/notifications/test-push': {
            post: { tags: ['Notifications'], summary: 'Enviar push de prueba', description: 'Para desarrollo - simula envío de push notification', responses: { '200': { description: 'Información de dispositivos que recibirían el push' } } }
        }
    }
};

app.use('/api/docs', apiReference({ url: '/api/openapi.json', theme: 'purple' }));
app.get('/api/openapi.json', (req, res) => res.json(openApiSpec));

// ========== SERVER ==========

const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
    console.log(`🚀 ChronusCRM API running on http://localhost:${PORT}`);
    console.log(`📚 API Docs: http://localhost:${PORT}/api/docs`);
    console.log(`🔌 Socket.io ready for connections`);
    if (ASSISTAI_CONFIG.apiToken) {
        console.log(`🤖 AssistAI integration enabled`);
    }
});
