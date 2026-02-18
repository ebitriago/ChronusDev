import { PrismaClient } from '@prisma/client';

// Initialize Prisma Client
const prisma = new PrismaClient();

// ========== Push Notification Service ==========
// Centralized service for sending push notifications.
// Uses Web Push API for browsers and will integrate with 
// Capacitor Push Notifications for native apps.
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
        // Check if user has push enabled (assuming NotificationPreferences exists in schema, otherwise skip check)
        // In ChronusDev schema, we don't have NotificationPreferences yet, but we have PushDevice.
        // We will assume enabled for now or add the table if strictly needed.

        // Get all registered devices for this user
        const devices = await prisma.pushDevice.findMany({
            where: { userId, organizationId }
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
                await prisma.pushDevice.update({
                    where: { id: device.id },
                    data: { createdAt: new Date() } // Using createdAt as lastUsed/refreshed
                });
            } catch (err: any) {
                console.error(`📲 Push failed for device ${device.id}:`, err.message);
                failed++;

                // If token is invalid (expired/unregistered), remove the device
                if (err.code === 'messaging/invalid-registration-token' ||
                    err.code === 'messaging/registration-token-not-registered') {
                    await prisma.pushDevice.delete({ where: { id: device.id } });
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
 * Register a new device token
 */
export async function registerPushDevice(
    userId: string,
    organizationId: string,
    token: string,
    platform: string
) {
    try {
        // Check if device already exists
        const existing = await prisma.pushDevice.findFirst({
            where: { token, userId, organizationId }
        });

        if (existing) {
            // Update timestamp
            return await prisma.pushDevice.update({
                where: { id: existing.id },
                data: { updatedAt: new Date() }
            });
        }

        // Create new device
        return await prisma.pushDevice.create({
            data: {
                userId,
                organizationId,
                token,
                platform
            }
        });
    } catch (err) {
        console.error('Error registering push device:', err);
        throw err;
    }
}
