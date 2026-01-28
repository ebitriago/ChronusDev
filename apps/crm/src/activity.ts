// Activity tracking service for CRM
import { prisma } from './db.js';
import { ActivityType } from '@prisma/client';

// Log an activity
export async function logActivity(params: {
    type: ActivityType;
    description: string;
    organizationId: string;
    userId?: string;
    customerId?: string;
    leadId?: string;
    ticketId?: string;
    metadata?: any;
}) {
    try {
        const activity = await prisma.activity.create({
            data: {
                type: params.type,
                description: params.description,
                organizationId: params.organizationId,
                userId: params.userId,
                customerId: params.customerId,
                leadId: params.leadId,
                ticketId: params.ticketId,
                metadata: params.metadata || {},
            },
        });
        return activity;
    } catch (err) {
        console.error('[Activity Log Error]', err);
        return null;
    }
}

// Get activities for a customer
export async function getCustomerActivities(organizationId: string, customerId: string, limit = 50) {
    return prisma.activity.findMany({
        where: { customerId, organizationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            user: { select: { id: true, name: true, avatar: true } },
        },
    });
}

// Get activities for a lead
export async function getLeadActivities(organizationId: string, leadId: string, limit = 50) {
    return prisma.activity.findMany({
        where: { leadId, organizationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            user: { select: { id: true, name: true, avatar: true } },
        },
    });
}

// Get activities for a ticket
export async function getTicketActivities(organizationId: string, ticketId: string, limit = 50) {
    return prisma.activity.findMany({
        where: { ticketId, organizationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            user: { select: { id: true, name: true, avatar: true } },
        },
    });
}

// Get all recent activities
export async function getRecentActivities(organizationId: string, limit = 100) {
    return prisma.activity.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            user: { select: { id: true, name: true, avatar: true } },
            customer: { select: { id: true, name: true } },
            lead: { select: { id: true, name: true } },
            ticket: { select: { id: true, title: true } },
        },
    });
}

// Activity type descriptions in Spanish
export const activityTypeLabels: Record<ActivityType, string> = {
    CREATED: 'Creado',
    UPDATED: 'Actualizado',
    DELETED: 'Eliminado',
    STATUS_CHANGE: 'Cambio de estado',
    ASSIGNMENT: 'Asignación',
    COMMENT: 'Comentario',
    EMAIL_SENT: 'Email enviado',
    CALL: 'Llamada',
    MEETING: 'Reunión',
    NOTE: 'Nota',
};

// Activity type icons
export const activityTypeIcons: Record<ActivityType, string> = {
    CREATED: '🆕',
    UPDATED: '✏️',
    DELETED: '🗑️',
    STATUS_CHANGE: '🔄',
    ASSIGNMENT: '👤',
    COMMENT: '💬',
    EMAIL_SENT: '📧',
    CALL: '📞',
    MEETING: '📅',
    NOTE: '📝',
};
