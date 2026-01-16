import 'dotenv/config';
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import { customers, tickets, invoices, communications, transactions, leads } from "./data.js";
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

// Seed demo conversation
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

app.post("/tickets", (req, res) => {
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

    // Auto-create Task if Customer has default Project
    const customer = customers.find(c => c.id === customerId);
    if (customer && customer.chronusDevDefaultProjectId) {
        (async () => {
            const CHRONUSDEV_URL = process.env.CHRONUSDEV_API_URL || "http://127.0.0.1:3001";
            try {
                const response = await fetch(`${CHRONUSDEV_URL}/tasks`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.CHRONUSDEV_TOKEN || "token-admin-123"}`,
                    },
                    body: JSON.stringify({
                        projectId: customer.chronusDevDefaultProjectId,
                        title: `[CRM] ${ticket.title}`,
                        description: `Cliente: ${customer.name}\nTicket ID: ${ticket.id}\n\n${ticket.description}`,
                        priority: ticket.priority,
                        status: "TODO",
                    }),
                });

                if (response.ok) {
                    const task = await response.json();
                    ticket.chronusDevTaskId = task.id;
                    ticket.chronusDevProjectId = customer.chronusDevDefaultProjectId;
                    ticket.status = "IN_PROGRESS"; // Auto-move to In Progress
                    ticket.updatedAt = new Date();
                }
            } catch (err) {
                console.error("Error auto-creating task in ChronusDev:", err);
            }
        })();
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

// GET AssistAI Conversations 
app.get("/assistai/conversations", async (req, res) => {
    try {
        const { page = 1, take = 20 } = req.query;
        const data = await assistaiFetch(`/conversations?page=${page}&take=${take}&order=DESC&orderBy=createdAt`);
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
        const convData = await assistaiFetch('/conversations?take=50&order=DESC&orderBy=createdAt');
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

// ========== SERVER ==========

const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
    console.log(`🚀 ChronusCRM API running on http://localhost:${PORT}`);
    console.log(`🔌 Socket.io ready for connections`);
    if (ASSISTAI_CONFIG.apiToken) {
        console.log(`🤖 AssistAI integration enabled`);
    }
});
