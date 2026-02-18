'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function TicketsRedirect() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        // Persist 'new=true' intention if needed, or just map path to view
        const isNew = searchParams.get('new');
        if (isNew) {
            sessionStorage.setItem('crm_initial_action', 'new_ticket');
        }

        sessionStorage.setItem('crm_initial_view', 'tickets');
        router.replace('/');
    }, [router, searchParams]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center">
                <div className="w-8 h-8 border-2 border-emerald-500 rounded-full animate-spin border-t-transparent mx-auto mb-2"></div>
                <p className="text-gray-400 text-sm">Redirigiendo...</p>
            </div>
        </div>
    );
}

export default function TicketsPage() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <TicketsRedirect />
        </Suspense>
    );
}
