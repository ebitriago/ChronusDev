'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';

const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://127.0.0.1:3002';

type IntegrationConfig = {
    provider: string; // 'GOOGLE', 'GMAIL'
    isEnabled: boolean;
    credentials?: {
        clientId?: string;
        clientSecret?: string;
        user?: string; // For Gmail (email address)
        appPassword?: string; // For Gmail
    };
    connected?: boolean;
};

export default function Integrations() {
    const [integrations, setIntegrations] = useState<Record<string, IntegrationConfig>>({});
    const [loading, setLoading] = useState(false);
    const [editingProvider, setEditingProvider] = useState<string | null>(null);
    const [formData, setFormData] = useState<any>({});
    const { showToast } = useToast();

    useEffect(() => {
        fetchIntegrations();
    }, []);

    const fetchIntegrations = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/integrations`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('crm_token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Map array to object for easier visual handling
                const map: Record<string, IntegrationConfig> = {};
                data.forEach((i: IntegrationConfig) => map[i.provider] = i);
                setIntegrations(map);
            }
        } catch (err) {
            console.error('Error fetching integrations:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (provider: string) => {
        setEditingProvider(provider);
        // Pre-fill form if data exists (except sensitive secrets if masking is used securely on backend, but here we might want to let them overwrite)
        const current = integrations[provider] || {};
        setFormData(current.credentials || {});
    };

    const handleSave = async () => {
        if (!editingProvider) return;

        try {
            const res = await fetch(`${API_URL}/integrations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                },
                body: JSON.stringify({
                    provider: editingProvider,
                    credentials: formData,
                    isEnabled: true
                })
            });

            if (res.ok) {
                showToast('Integración guardada exitosamente', 'success');
                setEditingProvider(null);
                fetchIntegrations();
            } else {
                showToast('Error al guardar integración', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de conexión', 'error');
        }
    };

    const handleConnect = (provider: string) => {
        if (provider === 'GOOGLE') {
            // Redirect to backend auth flow which uses the stored credentials
            window.location.href = `${API_URL}/calendar/connect?token=${localStorage.getItem('crm_token')}`;
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Integraciones</h3>
            <p className="text-sm text-gray-500 mb-6">Conecta tus herramientas favoritas para potenciar tu CRM.</p>

            <div className="grid grid-cols-1 gap-4">
                {/* Google Calendar / Meet */}
                <div className="border border-gray-200 rounded-xl p-5 flex items-center justify-between hover:border-emerald-200 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white border border-gray-100 rounded-lg flex items-center justify-center p-2 shadow-sm">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="Google Calendar" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900">Google Calendar & Meet</h4>
                            <p className="text-xs text-gray-500 mb-1">Sincroniza eventos y crea videollamadas</p>
                            {integrations['GOOGLE']?.connected ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Conectado
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                    No conectado
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleEdit('GOOGLE')}
                            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                        >
                            Configurar
                        </button>
                        <button
                            onClick={() => handleConnect('GOOGLE')}
                            disabled={!integrations['GOOGLE']}
                            className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Conectar
                        </button>
                    </div>
                </div>

                {/* Gmail SMTP */}
                <div className="border border-gray-200 rounded-xl p-5 flex items-center justify-between hover:border-emerald-200 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white border border-gray-100 rounded-lg flex items-center justify-center p-2 shadow-sm">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg" alt="Gmail" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900">Gmail SMTP</h4>
                            <p className="text-xs text-gray-500 mb-1">Envía correos transaccionales desde tu cuenta</p>
                            {integrations['GMAIL']?.isEnabled ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Activo
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                    Inactivo
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => handleEdit('GMAIL')}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                    >
                        Configurar
                    </button>
                </div>
            </div>

            {/* Config Modal */}
            {editingProvider && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fadeIn">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">
                                Configurar {editingProvider === 'GOOGLE' ? 'Google Calendar' : 'Gmail'}
                            </h3>
                            <button onClick={() => setEditingProvider(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="space-y-4">
                            {editingProvider === 'GOOGLE' && (
                                <>
                                    <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg mb-4">
                                        ℹ️ Obtén estas credenciales en <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="underline font-bold">Google Cloud Console</a>.
                                        <br />Habilita <strong>Google Calendar API</strong>.
                                        <br />Redirect URI: <code>{API_URL}/auth/google/callback</code>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                                        <input
                                            type="text"
                                            value={formData.clientId || ''}
                                            onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="xxx.apps.googleusercontent.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
                                        <input
                                            type="password"
                                            value={formData.clientSecret || ''}
                                            onChange={e => setFormData({ ...formData, clientSecret: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="••••••••••••"
                                        />
                                    </div>
                                </>
                            )}

                            {editingProvider === 'GMAIL' && (
                                <>
                                    <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg mb-4">
                                        ℹ️ Usa tu correo de Gmail y una <strong>App Password</strong> (no tu contraseña normal) si tienes 2FA activado.
                                        <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="block mt-1 underline font-bold">Crear App Password</a>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Correo Gmail</label>
                                        <input
                                            type="email"
                                            value={formData.user || ''}
                                            onChange={e => setFormData({ ...formData, user: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="tu@gmail.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">App Password</label>
                                        <input
                                            type="password"
                                            value={formData.appPassword || ''}
                                            onChange={e => setFormData({ ...formData, appPassword: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="xxxx xxxx xxxx xxxx"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setEditingProvider(null)}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold transition-colors"
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
