// Notifications service for ChronusDev
import { prisma } from './db.js';
import { NotificationType } from '@prisma/client';
import { Server } from 'socket.io';

let ioInstance: Server | null = null;

export function setSocketIO(io: Server) {
    ioInstance = io;
}

export async function createNotification(params: {
    userId: string;
    organizationId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: any;
}) {
    try {
        const notification = await prisma.notification.create({
            data: {
                userId: params.userId,
                organizationId: params.organizationId,
                type: params.type,
                title: params.title,
                body: params.body,
                data: params.data || {},
                read: false
            },
        });

        // Emit socket event
        if (ioInstance) {
            ioInstance.to(`user_${params.userId}`).emit('notification', notification);
        }

        return notification;
    } catch (err) {
        console.error('[Notification Error]', err);
        return null;
    }
}

export async function getUserNotifications(userId: string, organizationId: string, limit = 50) {
    return prisma.notification.findMany({
        where: { userId, organizationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}

export async function markAsRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { read: true },
    });
}

export async function markAllAsRead(userId: string, organizationId: string) {
    return prisma.notification.updateMany({
        where: { userId, organizationId, read: false },
        data: { read: true },
    });
}
