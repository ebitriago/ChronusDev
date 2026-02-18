'use client';

import { useEffect } from 'react';
import { initCapacitor } from '../services/capacitor';
import { registerNativePush, removenativePushListeners } from '../services/capacitor-push';
import { useAuth } from './AuthProvider';

export default function CapacitorInit() {
    const { user, token } = useAuth();

    // 1. Init Capacitor core (Status Bar, Splash) on mount
    useEffect(() => {
        initCapacitor();
    }, []);

    // 2. Register Push when user is authenticated
    useEffect(() => {
        if (user && token) {
            // Get API URL (using public env var since this is client side)
            const apiUrl = process.env.NEXT_PUBLIC_CRM_API_URL || '/api'; // Fallback to relative proxy

            // Register native push
            registerNativePush(apiUrl, token);

            return () => {
                removenativePushListeners();
            };
        }
    }, [user, token]);

    return null; // Logic-only component
}
