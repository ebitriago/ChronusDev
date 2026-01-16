// Tipos para el CRM

export type CustomerStatus = "ACTIVE" | "INACTIVE" | "TRIAL" | "CHURNED";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";

export type CommunicationType = "EMAIL" | "WHATSAPP" | "CALL" | "NOTE";

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
    // Relación con ChronusDev
    chronusDevClientId?: string; // ID del cliente en ChronusDev
    chronusDevDefaultProjectId?: string; // Proyecto por defecto para tickets
    tags: string[];
    notes?: string;
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
    createdAt: Date;
    updatedAt: Date;
}
