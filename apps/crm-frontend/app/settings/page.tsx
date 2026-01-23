'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SettingsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tab = searchParams.get('tab');

    useEffect(() => {
        // Store the target view and optional tab in sessionStorage
        sessionStorage.setItem('crm_initial_view', 'settings');
        if (tab) {
            sessionStorage.setItem('crm_settings_tab', tab);
        }
        router.replace('/');
    }, [router, tab]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-emerald-200 rounded-full animate-spin border-t-emerald-600" />
                <p className="text-gray-500 font-medium">Cargando Configuración...</p>
            </div>
        </div>
    );
}
