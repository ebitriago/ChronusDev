'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CustomersRedirect() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const isNew = searchParams.get('new');
        if (isNew) {
            sessionStorage.setItem('crm_initial_action', 'new_customer');
        }

        sessionStorage.setItem('crm_initial_view', 'customers');
        router.replace('/');
    }, [router, searchParams]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-emerald-200 rounded-full animate-spin border-t-emerald-600" />
                <p className="text-gray-500 font-medium">Cargando Clientes...</p>
            </div>
        </div>
    );
}

export default function CustomersPage() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <CustomersRedirect />
        </Suspense>
    );
}
