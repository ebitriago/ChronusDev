'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function TicketDetailRedirect() {
    const router = useRouter();
    const params = useParams();

    useEffect(() => {
        if (params?.id) {
            // Set intent to open specific ticket in Kanban view
            sessionStorage.setItem('crm_initial_view', 'kanban');
            sessionStorage.setItem('crm_active_ticket', params.id as string);
            router.replace('/');
        }
    }, [params, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center">
                <div className="w-8 h-8 border-2 border-emerald-500 rounded-full animate-spin border-t-transparent mx-auto mb-2"></div>
                <p className="text-gray-400 text-sm">Abriendo ticket...</p>
            </div>
        </div>
    );
}
