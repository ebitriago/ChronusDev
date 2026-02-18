import { prisma } from '../db.js';

// ========== Push Notification Service ==========
// Centralized service for sending push notifications.
// Uses Web Push API for browsers and will integrate with 
// Capacitor Push Notifications for native apps (Phase 3).
//
// For production Firebase integration, set:
// - FIREBASE_SERVICE_ACCOUNT_JSON env var (base64 encoded)
// Then uncomment the firebase-admin section below.

interface PushPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: Record<string, any>;
    url?: string;
}

/**
 * Send push notification to a specific user (all their registered devices)
 */
export async function sendPushToUser(
    userId: string,
    organizationId: string,
    payload: PushPayload,
    io?: any
): Promise<{ sent: number; failed: number }> {
    try {
        // Check if user has push enabled
        const prefs = await prisma.notificationPreferences.findUnique({
            where: { userId }
        } as any);

        if (prefs && !(prefs as any).push) {
            console.log(`📲 Push disabled for user ${userId}, skipping`);
            return { sent: 0, failed: 0 };
        }

        // Get all registered devices for this user
        const devices = await (prisma as any).pushDevice.findMany({
            where: { userId, organizationId } as any
        });

        if (devices.length === 0) {
            console.log(`📲 No devices registered for user ${userId}`);
            return { sent: 0, failed: 0 };
        }

        let sent = 0;
        let failed = 0;

        for (const device of devices) {
            try {
                // TODO: When Firebase is configured, send actual push here
                // await firebaseAdmin.messaging().send({
                //     token: device.token,
                //     notification: { title: payload.title, body: payload.body },
                //     data: payload.data,
                // });

                console.log(`📲 Push queued for device ${device.id} (${device.platform}): "${payload.title}"`);
                sent++;

                // Update last used timestamp
                await (prisma as any).pushDevice.update({
                    where: { id: device.id },
                    data: { createdAt: new Date() } // Using createdAt as lastUsed for now
                });
            } catch (err: any) {
                console.error(`📲 Push failed for device ${device.id}:`, err.message);
                failed++;

                // If token is invalid (expired/unregistered), remove the device
                if (err.code === 'messaging/invalid-registration-token' ||
                    err.code === 'messaging/registration-token-not-registered') {
                    await (prisma as any).pushDevice.delete({ where: { id: device.id } });
                    console.log(`📲 Removed invalid device ${device.id}`);
                }
            }
        }

        // Also emit via Socket.IO for instant in-app delivery
        if (io) {
            io.to(`user_${userId}`).emit('push_notification', payload);
        }

        return { sent, failed };
    } catch (err) {
        console.error('[Push Service Error]', err);
        return { sent: 0, failed: 0 };
    }
}

/**
 * Send push notification to ALL users in an organization
 */
export async function sendPushToOrganization(
    organizationId: string,
    payload: PushPayload,
    io?: any,
    excludeUserId?: string
): Promise<{ totalUsers: number; sent: number; failed: number }> {
    try {
        // Get all users in the organization
        const members = await prisma.organizationMember.findMany({
            where: { organizationId } as any,
            select: { userId: true }
        });

        let totalSent = 0;
        let totalFailed = 0;

        for (const member of members) {
            if (excludeUserId && member.userId === excludeUserId) continue;

            const result = await sendPushToUser(member.userId, organizationId, payload, io);
            totalSent += result.sent;
            totalFailed += result.failed;
        }

        return { totalUsers: members.length, sent: totalSent, failed: totalFailed };
    } catch (err) {
        console.error('[Push Service Broadcast Error]', err);
        return { totalUsers: 0, sent: 0, failed: 0 };
    }
}

/**
 * Send push to specific users (by ID list)
 */
export async function sendPushToUsers(
    userIds: string[],
    organizationId: string,
    payload: PushPayload,
    io?: any
): Promise<{ totalUsers: number; sent: number; failed: number }> {
    let totalSent = 0;
    let totalFailed = 0;

    for (const userId of userIds) {
        const result = await sendPushToUser(userId, organizationId, payload, io);
        totalSent += result.sent;
        totalFailed += result.failed;
    }

    return { totalUsers: userIds.length, sent: totalSent, failed: totalFailed };
}

/**
 * Create in-app notification AND send push simultaneously
 */
export async function createNotificationWithPush(params: {
    userId: string;
    organizationId: string;
    type: string;
    title: string;
    body: string;
    data?: any;
    io?: any;
}): Promise<any> {
    try {
        // 1. Create in-app notification
        const notification = await prisma.notification.create({
            data: {
                userId: params.userId,
                organizationId: params.organizationId,
                type: params.type as any,
                title: params.title,
                body: params.body,
                data: params.data || {},
                read: false
            } as any
        });

        // 2. Emit via Socket.IO for real-time in-app
        if (params.io) {
            params.io.to(`user_${params.userId}`).emit('notification', notification);
        }

        // 3. Send push notification
        await sendPushToUser(params.userId, params.organizationId, {
            title: params.title,
            body: params.body,
            data: {
                ...params.data,
                notificationId: notification.id,
                type: params.type,
            }
        }, params.io);

        return notification;
    } catch (err) {
        console.error('[createNotificationWithPush Error]', err);
        return null;
    }
}

/**
 * Broadcast a notification to ALL users in org (admin manual push)
 */
export async function broadcastNotification(params: {
    organizationId: string;
    senderUserId: string;
    title: string;
    body: string;
    type?: string;
    data?: any;
    targetUserIds?: string[]; // If empty, send to ALL in org
    io?: any;
}): Promise<{
    notificationsCreated: number;
    pushSent: number;
    pushFailed: number;
}> {
    try {
        let targetUserIds = params.targetUserIds;

        // If no specific targets, get all users in org
        if (!targetUserIds || targetUserIds.length === 0) {
            const members = await prisma.organizationMember.findMany({
                where: { organizationId: params.organizationId } as any,
                select: { userId: true }
            });
            targetUserIds = members.map(m => m.userId);
        }

        let notificationsCreated = 0;
        let pushSent = 0;
        let pushFailed = 0;

        for (const userId of targetUserIds) {
            // Skip sender if desired (optional)
            // if (userId === params.senderUserId) continue;

            const notification = await createNotificationWithPush({
                userId,
                organizationId: params.organizationId,
                type: params.type || 'SYSTEM',
                title: params.title,
                body: params.body,
                data: {
                    ...params.data,
                    broadcastFrom: params.senderUserId,
                },
                io: params.io,
            });

            if (notification) notificationsCreated++;
        }

        return { notificationsCreated, pushSent, pushFailed };
    } catch (err) {
        console.error('[Broadcast Error]', err);
        return { notificationsCreated: 0, pushSent: 0, pushFailed: 0 };
    }
}
