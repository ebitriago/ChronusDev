"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SSOContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const token = searchParams.get('token');

        if (token) {
            // Save token to localStorage (ChronusDev uses 'authToken')
            localStorage.setItem('authToken', token);

            // Also try to decode user from token and save basic info if needed
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                localStorage.setItem('userId', payload.userId || payload.id);
            } catch (e) {
                console.error("Failed to parse token payload", e);
            }

            // Redirect to home/dashboard
            router.push('/');
        } else {
            // If no token, redirect to login (or current behavior)
            // Since ChronusDev might default to unauthorized view, push to /
            router.push('/');
        }
    }, [router, searchParams]);

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-emerald-500 rounded-full animate-spin border-t-transparent" />
            <p>Autenticando con ChronusDev...</p>
        </div>
    );
}

export default function SSOPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
            <Suspense fallback={
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-500 rounded-full animate-spin border-t-transparent" />
                    <p>Cargando...</p>
                </div>
            }>
                <SSOContent />
            </Suspense>
        </div>
    );
}
