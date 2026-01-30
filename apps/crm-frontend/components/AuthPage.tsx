'use client';

import { useState } from 'react';
import { API_URL } from '../app/api';

type AuthMode = 'login' | 'register';

interface AuthPageProps {
    onLogin: (token: string, user: any) => void;
}

export default function AuthPage({ onLogin }: AuthPageProps) {
    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
            const body = mode === 'login'
                ? { email, password }
                : { name, email, password };

            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Error de autenticación');
                return;
            }

            // Store token
            localStorage.setItem('crm_token', data.token);
            localStorage.setItem('crm_user', JSON.stringify(data.user));

            // Callback
            onLogin(data.token, data.user);
        } catch (err: any) {
            setError(err.message || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleAssistAILogin = () => {
        window.location.href = `${API_URL}/auth/assistai`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg shadow-emerald-500/30 mb-4">
                        <span className="text-white text-2xl font-bold">C</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white">ChronusCRM</h1>
                    <p className="text-slate-400 text-sm mt-1">Gestión inteligente de clientes</p>
                </div>

                {/* Card */}
                <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
                    <h2 className="text-xl font-bold text-white mb-6 text-center">
                        {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
                    </h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'register' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">
                                    Nombre Completo
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Tu nombre"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                                    required
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@email.com"
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">
                                Contraseña
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                                required
                                minLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Procesando...' : (mode === 'login' ? 'Ingresar' : 'Registrarse')}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-white/10"></div>
                        <span className="text-xs text-slate-500 uppercase">o continuar con</span>
                        <div className="flex-1 h-px bg-white/10"></div>
                    </div>

                    {/* AssistAI SSO */}
                    <button
                        onClick={handleAssistAILogin}
                        className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
                    >
                        <span className="text-lg">🤖</span>
                        <span>Continuar con AssistAI</span>
                    </button>

                    {/* Toggle Mode */}
                    <p className="mt-6 text-center text-sm text-slate-400">
                        {mode === 'login' ? (
                            <>
                                ¿No tienes cuenta?{' '}
                                <button
                                    onClick={() => { setMode('register'); setError(''); }}
                                    className="text-emerald-400 hover:text-emerald-300 font-bold"
                                >
                                    Regístrate
                                </button>
                            </>
                        ) : (
                            <>
                                ¿Ya tienes cuenta?{' '}
                                <button
                                    onClick={() => { setMode('login'); setError(''); }}
                                    className="text-emerald-400 hover:text-emerald-300 font-bold"
                                >
                                    Inicia Sesión
                                </button>
                            </>
                        )}
                    </p>
                </div>

                {/* Demo credentials */}
                <p className="text-center text-xs text-slate-500 mt-6">
                    Demo: <span className="text-slate-400">admin@chronuscrm.com</span> / <span className="text-slate-400">admin123</span>
                </p>
            </div>
        </div>
    );
}
