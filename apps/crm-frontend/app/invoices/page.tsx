'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InvoicesPage() {
    const router = useRouter();

    useEffect(() => {
        sessionStorage.setItem('crm_initial_view', 'invoices');
        router.replace('/');
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-emerald-200 rounded-full animate-spin border-t-emerald-600" />
                <p className="text-gray-500 font-medium">Cargando Facturas...</p>
            </div>
        </div>
    );
}
