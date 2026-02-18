'use client';

import { useEffect } from 'react';
import { registerPushNotifications, isNativePlatform } from '../services/capacitor';

export default function PushInitializer() {
    useEffect(() => {
        // Only run on native platforms
        if (!isNativePlatform()) return;

        // Check if user is logged in (using correct keys from api.ts)
        const token = localStorage.getItem('crm_token') || localStorage.getItem('authToken');
        if (token) {
            console.log('🔔 Initializing Push Notifications...');
            registerPushNotifications();
        }
    }, []);

    return null; // This component renders nothing
}
