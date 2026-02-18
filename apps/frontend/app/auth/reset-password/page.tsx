'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { resetPassword } from '../../api';
import Link from 'next/link';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Si no hay token, mostrar error
    if (!token) {
        return (
            <div className="text-center space-y-4">
                <div className="text-red-400 text-lg">⚠️ Token inválido o faltante</div>
                <Link href="/auth/forgot-password" className="text-blue-400 hover:text-blue-300 underline">
                    Solicitar nuevo enlace
                </Link>
            </div>
        );
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (password !== confirmPassword) {
            setStatus({ type: 'error', message: 'Las contraseñas no coinciden' });
            return;
        }

        if (password.length < 6) {
            setStatus({ type: 'error', message: 'La contraseña debe tener al menos 6 caracteres' });
            return;
        }

        setLoading(true);
        setStatus(null);

        try {
            const res = await resetPassword(token!, password);
            setStatus({ type: 'success', message: 'Tu contraseña ha sido actualizada correctamente.' });

            // Redirect after delay
            setTimeout(() => {
                router.push('/');
            }, 3000);
        } catch (err: any) {
            setStatus({ type: 'error', message: err.message || 'Error al restablecer contraseña' });
        } finally {
            setLoading(false);
        }
    }

    if (status?.type === 'success') {
        return (
            <div className="text-center space-y-6">
                <div className="flex items-center justify-center w-16 h-16 bg-green-500/20 text-green-400 rounded-full mx-auto">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white mb-2">¡Contraseña actualizada!</h3>
                    <p className="text-white/60">
                        Serás redirigido al inicio de sesión en unos segundos...
                    </p>
                </div>
                <Link href="/" className="inline-block px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors">
                    Ir al inicio ahora
                </Link>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="pass" className="block text-sm font-medium text-white/80 mb-2">
                    Nueva Contraseña
                </label>
                <input
                    id="pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                    placeholder="Mínimo 6 caracteres"
                />
            </div>

            <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-white/80 mb-2">
                    Confirmar Contraseña
                </label>
                <input
                    id="confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                    placeholder="Repite la contraseña"
                />
            </div>

            {status?.type === 'error' && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {status.message}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3.5 px-4 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
            >
                {loading ? 'Restableciendo...' : 'Guardar nueva contraseña'}
            </button>
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900">
            {/* Fondo animado */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
            </div>

            <div className="relative z-10 w-full max-w-md px-4">
                <div className="bg-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 p-8 animate-fadeIn">

                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg shadow-purple-500/30 mb-4">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
                            Restablecer Contraseña
                        </h1>
                    </div>

                    <Suspense fallback={<div className="text-center text-white/60">Cargando...</div>}>
                        <ResetPasswordForm />
                    </Suspense>

                    <div className="text-center mt-6">
                        <Link href="/" className="text-white/60 hover:text-white text-sm transition-colors flex items-center justify-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Volver al inicio
                        </Link>
                    </div>
                </div>

                <p className="text-center text-white/30 text-xs mt-6">
                    © 2024 ChronusDev
                </p>
            </div>
        </div>
    );
}
