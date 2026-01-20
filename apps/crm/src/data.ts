// Datos iniciales del CRM
import type { Customer, Ticket, Invoice, Communication, Transaction, Lead, Tag } from "./types.js";

export const customers: Customer[] = [
    {
        id: "cust-acme",
        name: "Acme Corp",
        email: "contact@acme.com",
        phone: "+1 555-123-4567",
        company: "Acme Corporation",
        plan: "PRO",
        status: "ACTIVE",
        monthlyRevenue: 499,
        currency: "USD",
        chronusDevClientId: "c-client-x", // Vinculado a Cliente X en ChronusDev
        tags: ["enterprise", "priority"],
        notes: "Cliente desde 2024. Muy activo.",
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date(),
    },
    {
        id: "cust-startup",
        name: "TechStartup Inc",
        email: "hello@techstartup.io",
        company: "TechStartup Inc",
        plan: "STARTER",
        status: "ACTIVE",
        monthlyRevenue: 99,
        currency: "USD",
        tags: ["startup"],
        createdAt: new Date("2024-06-01"),
        updatedAt: new Date(),
    },
    {
        id: "cust-trial",
        name: "NewCo",
        email: "info@newco.com",
        plan: "FREE",
        status: "TRIAL",
        monthlyRevenue: 0,
        currency: "USD",
        tags: ["trial", "lead"],
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];

export const tickets: Ticket[] = [
    {
        id: "tkt-001",
        customerId: "cust-acme",
        title: "Error al exportar reportes",
        description: "Cuando intento exportar un reporte en PDF, la página se queda cargando indefinidamente.",
        status: "OPEN",
        priority: "HIGH",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: "tkt-002",
        customerId: "cust-startup",
        title: "Solicitud: Integrar WhatsApp",
        description: "Necesitamos poder enviar notificaciones por WhatsApp a nuestros usuarios.",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        chronusDevTaskId: "t-home", // Ya enviado a ChronusDev
        chronusDevProjectId: "p-ecommerce-x",
        createdAt: new Date(Date.now() - 86400000 * 3), // 3 días atrás
        updatedAt: new Date(),
    },
];

export const invoices: Invoice[] = [
    {
        id: "inv-001",
        customerId: "cust-acme",
        number: "INV-2026-001",
        amount: 499,
        currency: "USD",
        status: "PAID",
        dueDate: new Date("2026-01-15"),
        paidAt: new Date("2026-01-10"),
        items: [
            { description: "Plan PRO - Enero 2026", quantity: 1, unitPrice: 499, total: 499 },
        ],
        createdAt: new Date("2026-01-01"),
    },
    {
        id: "inv-002",
        customerId: "cust-acme",
        number: "INV-2026-002",
        amount: 499,
        currency: "USD",
        status: "SENT",
        dueDate: new Date("2026-02-15"),
        items: [
            { description: "Plan PRO - Febrero 2026", quantity: 1, unitPrice: 499, total: 499 },
        ],
        createdAt: new Date("2026-02-01"),
    },
    {
        id: "inv-003",
        customerId: "cust-startup",
        number: "INV-2026-003",
        amount: 99,
        currency: "USD",
        status: "OVERDUE",
        dueDate: new Date("2026-01-10"),
        items: [
            { description: "Plan STARTER - Enero 2026", quantity: 1, unitPrice: 99, total: 99 },
        ],
        createdAt: new Date("2026-01-01"),
    },
];

export const communications: Communication[] = [
    {
        id: "comm-001",
        customerId: "cust-acme",
        type: "EMAIL",
        direction: "OUTBOUND",
        subject: "Bienvenido a ChronusDev Pro!",
        content: "Gracias por actualizar a Pro. Aquí están tus nuevas funcionalidades...",
        createdAt: new Date("2024-01-15"),
    },
    {
        id: "comm-002",
        customerId: "cust-acme",
        type: "WHATSAPP",
        direction: "INBOUND",
        content: "Hola, tengo un problema con la exportación de reportes",
        metadata: { whatsappMessageId: "wamid.xxx" },
        createdAt: new Date(),
    },
    {
        id: "comm-003",
        customerId: "cust-acme",
        type: "NOTE",
        direction: "OUTBOUND",
        content: "Cliente muy satisfecho. Mencionó posible upgrade a Enterprise.",
        createdBy: "u-admin",
        createdAt: new Date(),
    },
];

export const transactions: Transaction[] = [
    {
        id: "txn-001",
        customerId: "cust-acme",
        date: new Date("2026-01-10"),
        amount: 499,
        type: "INCOME",
        category: "Subscription",
        description: "Pago Mensual Plan PRO",
        status: "COMPLETED",
        reference: "inv-001",
        createdAt: new Date("2026-01-10"),
    },
    {
        id: "txn-002",
        customerId: "cust-startup",
        date: new Date("2026-01-15"),
        amount: 99,
        type: "INCOME",
        category: "Subscription",
        description: "Pago Mensual Plan STARTER",
        status: "COMPLETED",
        reference: "inv-003",
        createdAt: new Date("2026-01-15"),
    },
    {
        id: "txn-003",
        date: new Date("2026-01-05"),
        amount: 50,
        type: "EXPENSE",
        category: "Hosting",
        description: "Pago mensual Vercel/Render",
        status: "COMPLETED",
        createdAt: new Date("2026-01-05"),
    },
    {
        id: "txn-004",
        date: new Date("2026-01-01"),
        amount: 1200,
        type: "EXPENSE",
        category: "Payroll",
        description: "Nómina Freelancers",
        status: "COMPLETED",
        createdAt: new Date("2026-01-01"),
    },
];

export const leads: Lead[] = [
    {
        id: "lead-001",
        name: "Carlos Potencial",
        email: "carlos@bigcorp.com",
        company: "Big Corp Ltd",
        source: "WEBHOOK",
        status: "NEW",
        value: 5000,
        notes: "Interesado en plan Enterprise",
        tags: ["enterprise", "hot-lead"],
        score: 85,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: "lead-002",
        name: "Ana Startup",
        email: "ana@techstart.io",
        company: "TechStart",
        source: "MANUAL",
        status: "CONTACTED",
        value: 299,
        notes: "Llamada programada para mañana",
        tags: ["startup", "seguimiento"],
        score: 60,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];

// ==========================================
// GLOBAL TAGS SYSTEM
// ==========================================

export const tags: Tag[] = [
    // Lead tags
    { id: 'tag-hot', name: 'Hot Lead', color: '#ef4444', category: 'lead', createdAt: new Date() },
    { id: 'tag-cold', name: 'Cold Lead', color: '#3b82f6', category: 'lead', createdAt: new Date() },
    { id: 'tag-followup', name: 'Seguimiento', color: '#f59e0b', category: 'lead', createdAt: new Date() },

    // Customer tags
    { id: 'tag-enterprise', name: 'Enterprise', color: '#8b5cf6', category: 'customer', createdAt: new Date() },
    { id: 'tag-startup', name: 'Startup', color: '#10b981', category: 'customer', createdAt: new Date() },
    { id: 'tag-priority', name: 'Prioridad', color: '#ec4899', category: 'customer', createdAt: new Date() },
    { id: 'tag-vip', name: 'VIP', color: '#f59e0b', category: 'customer', createdAt: new Date() },

    // Ticket tags  
    { id: 'tag-urgent', name: 'Urgente', color: '#dc2626', category: 'ticket', createdAt: new Date() },
    { id: 'tag-billing', name: 'Facturación', color: '#059669', category: 'ticket', createdAt: new Date() },
    { id: 'tag-technical', name: 'Técnico', color: '#2563eb', category: 'ticket', createdAt: new Date() },
    { id: 'tag-feature', name: 'Feature Request', color: '#7c3aed', category: 'ticket', createdAt: new Date() },

    // General
    { id: 'tag-trial', name: 'Trial', color: '#6b7280', category: 'general', createdAt: new Date() },
    { id: 'tag-churn-risk', name: 'Riesgo Churn', color: '#dc2626', category: 'general', createdAt: new Date() },
];

// ==========================================
// CHANNEL CONFIGURATIONS (Hybrid AI/Human)
// ==========================================

export type ChannelConfig = {
    id: string;
    channelValue: string;        // "+584144314817" or "@username"
    platform: 'whatsapp' | 'instagram';
    mode: 'ai-only' | 'human-only' | 'hybrid';
    assignedAgentId?: string;    // AssistAI agent ID
    assignedAgentName?: string;  // For display
    humanTakeoverDuration: number; // minutes
    autoResumeAI: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export const channelConfigs: ChannelConfig[] = [
    {
        id: 'channel-1',
        channelValue: '+584144314817',
        platform: 'whatsapp',
        mode: 'hybrid',
        assignedAgentId: 'agent-claudia',
        assignedAgentName: 'Claudia (AssistAI)',
        humanTakeoverDuration: 60,
        autoResumeAI: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    }
];

// Conversation takeover state (tracks when humans take control)
export type ConversationTakeover = {
    sessionId: string;
    takenBy: string;       // user ID
    takenAt: Date;
    expiresAt: Date;
    previousMode: 'ai-only' | 'hybrid';
};

export const conversationTakeovers: Map<string, ConversationTakeover> = new Map();

// ==========================================
// AssistAI Data Persistence
// ==========================================
import * as fs from 'fs';
import * as path from 'path';

const ASSISTAI_DATA_FILE = path.join(process.cwd(), 'assistai_cache.json');

export interface AssistAICache {
    lastSync: string;
    agents: any[];
    conversations: any[];
    agentConfigs: any[];
}

const defaultCache: AssistAICache = {
    lastSync: '',
    agents: [],
    conversations: [],
    agentConfigs: []
};

export function loadAssistAICache(): AssistAICache {
    try {
        if (fs.existsSync(ASSISTAI_DATA_FILE)) {
            const data = fs.readFileSync(ASSISTAI_DATA_FILE, 'utf-8');
            const parsed = JSON.parse(data);
            console.log(`📂 Loaded AssistAI cache: ${parsed.agents?.length || 0} agents, ${parsed.conversations?.length || 0} conversations`);
            return {
                ...defaultCache,
                ...parsed,
            };
        }
    } catch (err) {
        console.error('⚠️ Error loading AssistAI cache:', err);
    }
    return defaultCache;
}

export function saveAssistAICache(cache: AssistAICache): void {
    try {
        cache.lastSync = new Date().toISOString();
        fs.writeFileSync(ASSISTAI_DATA_FILE, JSON.stringify(cache, null, 2));
        console.log(`💾 Saved AssistAI cache: ${cache.agents?.length || 0} agents, ${cache.conversations?.length || 0} conversations`);
    } catch (err) {
        console.error('⚠️ Error saving AssistAI cache:', err);
    }
}

export function getCacheInfo(): { exists: boolean; lastSync: string; stats: { agents: number; conversations: number } } {
    const cache = loadAssistAICache();
    return {
        exists: !!cache.lastSync,
        lastSync: cache.lastSync,
        stats: {
            agents: cache.agents?.length || 0,
            conversations: cache.conversations?.length || 0
        }
    };
}

// ==========================================
// WHATSAPP PROVIDERS (Dual Integration)
// ==========================================

import { WhatsAppProvider } from "./types.js";

export const whatsappProviders: WhatsAppProvider[] = [
    // WhatsMeow Provider (Bernardo's API)
    {
        id: 'whatsmeow-main',
        name: 'WhatsApp (WhatsMeow)',
        type: 'whatsmeow',
        enabled: false, // Habilitar cuando Bernardo proporcione la URL
        config: {
            apiUrl: 'http://localhost:8080',  // URL del servidor WhatsMeow de Bernardo
            apiKey: '',                        // API Key a configurar
            sessionId: 'crm-session-1'
        },
        status: 'disconnected',
        createdAt: new Date()
    },
    // Meta Business API Provider
    {
        id: 'meta-business',
        name: 'WhatsApp Business (Meta)',
        type: 'meta',
        enabled: false, // Habilitar cuando se configuren credenciales
        config: {
            phoneNumberId: '',        // ID del número de teléfono de Meta
            accessToken: '',          // Token de acceso de Meta
            businessAccountId: '',    // WABA ID
            webhookVerifyToken: 'crm_verify_token_2024'
        },
        status: 'disconnected',
        createdAt: new Date()
    }
];
