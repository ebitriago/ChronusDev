// Activity tracking service for ChronusDev
import { prisma } from './db.js';
import { ActivityType } from '@prisma/client';

const MAX_ACTIVITY_LIMIT = 200;

export type ActivityFilters = {
    projectId?: string;
    taskId?: string;
    type?: ActivityType;
};

export async function logActivity(params: {
    type: ActivityType;
    description: string;
    organizationId: string;
    userId?: string;
    clientId?: string;
    projectId?: string;
    taskId?: string;
    metadata?: any;
}) {
    try {
        const activity = await prisma.activity.create({
            data: {
                type: params.type,
                description: params.description,
                organizationId: params.organizationId,
                userId: params.userId,
                clientId: params.clientId,
                projectId: params.projectId,
                taskId: params.taskId,
                metadata: params.metadata || {},
            },
        });
        return activity;
    } catch (err) {
        console.error('[Activity Log Error]', err);
        return null;
    }
}

export async function getProjectActivities(organizationId: string, projectId: string, limit = 50) {
    return prisma.activity.findMany({
        where: { projectId, organizationId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, MAX_ACTIVITY_LIMIT),
        include: {
            user: { select: { id: true, name: true, avatar: true } },
        },
    });
}

export async function getTaskActivities(organizationId: string, taskId: string, limit = 50) {
    return prisma.activity.findMany({
        where: { taskId, organizationId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, MAX_ACTIVITY_LIMIT),
        include: {
            user: { select: { id: true, name: true, avatar: true } },
        },
    });
}

export async function getRecentActivities(
    organizationId: string,
    limit = 100,
    filters?: ActivityFilters
) {
    const where: any = { organizationId };
    if (filters?.projectId) where.projectId = filters.projectId;
    if (filters?.taskId) where.taskId = filters.taskId;
    if (filters?.type) where.type = filters.type;

    return prisma.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, MAX_ACTIVITY_LIMIT),
        include: {
            user: { select: { id: true, name: true, avatar: true } },
            project: { select: { id: true, name: true } },
            task: { select: { id: true, title: true } },
        },
    });
}

export const activityTypeLabels: Record<ActivityType, string> = {
    CREATED: 'Creado',
    UPDATED: 'Actualizado',
    DELETED: 'Eliminado',
    STATUS_CHANGE: 'Cambio de estado',
    ASSIGNMENT: 'Asignación',
    COMMENT: 'Comentario',
    TIMELOG_STARTED: 'Timer iniciado',
    TIMELOG_STOPPED: 'Timer detenido',
    PAYOUT_CREATED: 'Pago creado',
    STANDUP: 'Reporte diario',
};
