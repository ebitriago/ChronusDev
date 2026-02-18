import { Request, Response } from 'express';
import { registerPushDevice } from '../services/push-service.js';

export const registerDevice = async (req: Request, res: Response) => {
    try {
        const { token, platform } = req.body;
        // @ts-ignore - user is attached by auth middleware
        const userId = req.user?.id;
        // @ts-ignore - organizationId is attached by auth middleware/header usually, 
        // but for now we might need to find the user's org or pass it in body if multi-tenant context is active.
        // Assuming user.memberships[0].organizationId logic or provided in header 'x-organization-id'

        // For simplicity in this port, let's try to get org ID from headers or assume first org
        const organizationId = req.headers['x-organization-id'] as string;

        if (!userId || !token || !organizationId) {
            return res.status(400).json({ error: 'Missing userId, organizationId or token' });
        }

        const device = await registerPushDevice(userId, organizationId, token, platform || 'web');

        return res.json({ success: true, device });
    } catch (error) {
        console.error('Error registering device:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
