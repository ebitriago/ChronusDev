// Tipos para el CRM

export type CustomerStatus = "ACTIVE" | "INACTIVE" | "TRIAL" | "CHURNED";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";

export type CommunicationType = "EMAIL" | "WHATSAPP" | "CALL" | "NOTE";

// Contact Identity - allows one client to have multiple contact methods
export type ContactType = "phone" | "whatsapp" | "instagram" | "email" | "messenger";

export interface ContactIdentity {
    id: string;
    clientId?: string;        // Linked client (null = unassigned lead)
    type: ContactType;
    value: string;            // @username, +phone, email
    displayName?: string;     // Name from platform
    verified: boolean;
    lastMessageAt?: Date;
    createdAt: Date;
}

// Cliente del SaaS
export interface Customer {
    id: string;
    name: string;
    email: string;
    phone?: string;
    company?: string;
    plan: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
    status: CustomerStatus;
    monthlyRevenue: number;
    currency: string;
    // Multiple contact identities (IG, WhatsApp, etc.)
    contactIds?: string[];  // IDs of linked ContactIdentity
    // Relación con ChronusDev
    chronusDevClientId?: string; // ID del cliente en ChronusDev
    chronusDevDefaultProjectId?: string; // Proyecto por defecto para tickets
    tags: string[];
    notes?: string;
    customFields?: Record<string, any>;
    source?: "lead" | "manual" | "chat";  // How the client was created
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
}

// Ticket de soporte
export interface Ticket {
    id: string;
    customerId: string;
    title: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    // Integración con ChronusDev
    chronusDevTaskId?: string; // Se llena cuando se crea tarea
    chronusDevProjectId?: string;
    assignedTo?: string;
    customFields?: Record<string, any>;
    organizationId: string;
    resolvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// Factura
export interface Invoice {
    id: string;
    customerId: string;
    number: string; // INV-001
    amount: number;
    currency: string;
    status: InvoiceStatus;
    dueDate: Date;
    paidAt?: Date;
    items: InvoiceItem[];
    organizationId: string;
    createdAt: Date;
}

export interface InvoiceItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

// Comunicación
export interface Communication {
    id: string;
    customerId: string;
    type: CommunicationType;
    direction: "INBOUND" | "OUTBOUND";
    subject?: string;
    content: string;
    metadata?: Record<string, any>; // WhatsApp message ID, etc.
    createdBy?: string;
    createdAt: Date;
}

// Finanzas / ERP Lite
export interface Transaction {
    id: string;
    customerId?: string; // Opcional, puede ser un gasto general
    date: Date;
    amount: number;
    type: "INCOME" | "EXPENSE";
    category: string; // "Subscription", "Service", "Refund", "Hosting", "Salary"
    description: string;
    status: "COMPLETED" | "PENDING" | "FAILED";
    reference?: string; // Stripe ID, Invoice #, etc.
    createdAt: Date;
}

// Leads & Automatización
export interface Lead {
    id: string;
    name: string;
    email: string;
    company?: string;
    source: "MANUAL" | "WEBHOOK" | "REFERRAL" | "OTHER";
    status: "NEW" | "CONTACTED" | "QUALIFIED" | "NEGOTIATION" | "WON" | "LOST";
    value: number; // Potential Revenue
    notes?: string;
    customFields?: Record<string, any>;
    tags?: string[];  // Flexible tagging
    score?: number;   // Lead score (0-100)
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
}

// Sistema de Etiquetas Global
export interface Tag {
    id: string;
    name: string;
    color: string;  // Hex color
    category: 'lead' | 'customer' | 'ticket' | 'general';
    organizationId: string;
    createdAt: Date;
}

// Ticket Categories for auto-classification
export type TicketCategory = 'technical' | 'billing' | 'feature_request' | 'general' | 'urgent';

// WhatsApp Provider Configuration
export interface WhatsAppProvider {
    id: string;
    name: string;
    type: 'whatsmeow' | 'meta';  // WhatsMeow (open source) o Meta Business API
    enabled: boolean;
    config: {
        // WhatsMeow config
        apiUrl?: string;             // URL del servidor WhatsMeow (Bernardo's API)
        apiKey?: string;             // API Key para autenticación
        sessionId?: string;          // ID de sesión
        // Meta Business API config  
        phoneNumberId?: string;      // Meta Phone Number ID
        accessToken?: string;        // Meta Access Token
        businessAccountId?: string;  // WABA ID
        webhookVerifyToken?: string; // Token para verificar webhooks
    };
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    lastError?: string;
    connectedAt?: Date;
    createdAt: Date;
}

// WhatsApp Message (unified format for both providers)
export interface WhatsAppMessage {
    id: string;
    providerId: string;              // ID del proveedor usado
    from: string;                    // Número del remitente
    to: string;                      // Número del destinatario
    content: string;
    mediaType?: 'text' | 'image' | 'audio' | 'video' | 'document';
    mediaUrl?: string;
    timestamp: Date;
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    direction: 'inbound' | 'outbound';
    metadata?: Record<string, any>;  // Datos adicionales del proveedor
}


// ==========================================
// ASSISTAI INTEGRATION TYPES
// ==========================================

export interface AssistAIAgentConfig {
    id: number;
    user_id: number;
    name: string;
    role: string;
    flow_id: number;
    created_at: string;
    updated_at: string;
    flow: {
        id: number;
        user_id: number;
        name: string;
        description: string;
        prompt: string;
        created_at: string;
        updated_at: string;
    };
    tools: AssistAITool[];
}

export interface AssistAITool {
    id: number;
    name: string;
    description: string;
    type: string;
    config?: any;
}

// ==========================================
// CHAT & CONVERSATION TYPES
// ==========================================

export type ChatMessage = {
    id: string;
    sessionId: string;
    from: string;    // Display name
    content: string;
    platform: 'whatsapp' | 'instagram' | 'assistai' | 'messenger'; // Origin
    sender: 'user' | 'agent'; // Direction
    timestamp: Date;
    status?: 'sent' | 'delivered' | 'read';
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'audio' | 'document';
    metadata?: any;
};

export type Conversation = {
    sessionId: string;
    platform: 'whatsapp' | 'instagram' | 'assistai' | 'messenger';
    agentCode?: string;
    agentName?: string;
    customerName: string;
    customerContact: string; // phone or ig username
    messages: ChatMessage[];
    status: 'active' | 'resolved';
    createdAt: Date;
    updatedAt: Date;
    metadata?: any;       // Added for provider info
};
