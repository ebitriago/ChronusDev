'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';

const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://127.0.0.1:3002';

// Declare ElevenLabs custom element for TypeScript
declare global {
    namespace JSX {
        interface IntrinsicElements {
            'elevenlabs-convai': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { 'agent-id': string }, HTMLElement>;
        }
    }
}

type IntegrationConfig = {
    provider: string; // 'GOOGLE', 'GMAIL'
    isEnabled: boolean;
    credentials?: {
        clientId?: string;
        clientSecret?: string;
        user?: string; // For Gmail (email address)
        appPassword?: string; // For Gmail
        apiToken?: string; // AssistAI
        tenantDomain?: string; // AssistAI
        organizationCode?: string; // AssistAI
        apiKey?: string; // ElevenLabs
        agentId?: string; // ElevenLabs
        agentCode?: string; // WhatsMeow
        agentToken?: string; // WhatsMeow
    };
    connected?: boolean;
    id?: string;
};

// Authenticated QR Display Component
const QRDisplay = ({ url }: { url: string }) => {
    const [src, setSrc] = useState('');
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchQR = async () => {
            try {
                const res = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('crm_token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    // Backend returns { qr: "url_or_base64" }
                    setSrc(data.qr);
                } else {
                    setError(true);
                }
            } catch (e) {
                setError(true);
            }
        };
        fetchQR();
        // Poll every 5s
        const interval = setInterval(fetchQR, 5000);
        return () => clearInterval(interval);
    }, [url]);

    if (error) return <div className="text-red-500 text-xs">Error cargando QR</div>;
    if (!src) return <div className="w-48 h-48 bg-gray-100 animate-pulse rounded-lg mx-auto" />;

    return (
        <img
            src={src}
            alt="QR Code"
            className="mx-auto w-48 h-48 border border-gray-200 rounded-lg"
        />
    );
};

export default function Integrations() {
    const [integrations, setIntegrations] = useState<Record<string, IntegrationConfig>>({});
    const [loading, setLoading] = useState(false);
    const [editingProvider, setEditingProvider] = useState<string | null>(null);
    const [formData, setFormData] = useState<any>({});
    const [elevenLabsScriptLoaded, setElevenLabsScriptLoaded] = useState(false);
    const { showToast } = useToast();



    useEffect(() => {
        fetchIntegrations();
    }, []);

    // Load ElevenLabs script when editing ELEVENLABS
    useEffect(() => {
        if (editingProvider === 'ELEVENLABS' && !elevenLabsScriptLoaded) {
            const existingScript = document.querySelector('script[src*="elevenlabs.io/convai-widget"]');
            if (!existingScript) {
                const script = document.createElement('script');
                script.src = 'https://elevenlabs.io/convai-widget/index.js';
                script.async = true;
                script.type = 'text/javascript';
                script.onload = () => setElevenLabsScriptLoaded(true);
                document.body.appendChild(script);
            } else {
                setElevenLabsScriptLoaded(true);
            }
        }
    }, [editingProvider, elevenLabsScriptLoaded]);

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
        // Pre-fill form if data exists
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
                // Save ElevenLabs config to localStorage for VoiceWidget
                if (editingProvider === 'ELEVENLABS' && formData.agentId) {
                    localStorage.setItem('elevenlabs_config', JSON.stringify({
                        agentId: formData.agentId,
                        apiKey: formData.apiKey
                    }));
                }

                showToast('Integración guardada exitosamente', 'success');
                setEditingProvider(null);
                fetchIntegrations();
            } else {
                const errorData = await res.json().catch(() => ({}));
                showToast(`Error: ${errorData.error || 'Error al guardar integración'}`, 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de conexión', 'error');
        }
    };

    const handleConnect = (provider: string) => {
        if (provider === 'GOOGLE') {
            window.location.href = `${API_URL}/calendar/connect?token=${localStorage.getItem('crm_token')}`;
        }
    };

    const handleValidateAgent = async () => {
        if (!formData.apiKey || !formData.agentId) {
            showToast('Ingresa API Key y Agent ID', 'error');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/voice/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                },
                body: JSON.stringify({
                    agentId: formData.agentId,
                    apiKey: formData.apiKey
                })
            });

            const data = await res.json();
            if (res.ok) {
                showToast(`Agente válido: ${data.agentName}`, 'success');
            } else {
                showToast(`Error: ${data.error}`, 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de validación', 'error');
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

                {/* AssistAI Integration */}
                <div className="border border-gray-200 rounded-xl p-5 flex items-center justify-between hover:border-emerald-200 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white border border-gray-100 rounded-lg flex items-center justify-center p-2 shadow-sm">
                            <span className="text-2xl">🤖</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900">AssistAI</h4>
                            <p className="text-xs text-gray-500 mb-1">Conecta tus agentes de IA</p>
                            {integrations['ASSISTAI']?.isEnabled ? (
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
                    <button
                        onClick={() => handleEdit('ASSISTAI')}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                    >
                        Configurar
                    </button>
                </div>

                {/* OpenAI Integration */}
                <div className="border border-gray-200 rounded-xl p-5 flex items-center justify-between hover:border-emerald-200 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white border border-gray-100 rounded-lg flex items-center justify-center p-2 shadow-sm">
                            <span className="text-2xl">🤖</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900">OpenAI (ChatGPT)</h4>
                            <p className="text-xs text-gray-500 mb-1">GPT-4, GPT-3.5 para agentes de IA</p>
                            {integrations['OPENAI']?.isEnabled ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Configurado
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                    No configurado
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => handleEdit('OPENAI')}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                    >
                        Configurar
                    </button>
                </div>

                {/* Google Gemini Integration */}
                <div className="border border-gray-200 rounded-xl p-5 flex items-center justify-between hover:border-emerald-200 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white border border-gray-100 rounded-lg flex items-center justify-center p-2 shadow-sm">
                            <span className="text-2xl">✨</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900">Google Gemini</h4>
                            <p className="text-xs text-gray-500 mb-1">Gemini Pro para agentes de IA</p>
                            {integrations['GEMINI']?.isEnabled ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Configurado
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                    No configurado
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => handleEdit('GEMINI')}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                    >
                        Configurar
                    </button>
                </div>

                {/* ElevenLabs Integration */}
                <div className="border border-gray-200 rounded-xl p-5 flex items-center justify-between hover:border-emerald-200 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white border border-gray-100 rounded-lg flex items-center justify-center p-2 shadow-sm">
                            <span className="text-2xl">🗣️</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900">ElevenLabs Voice</h4>
                            <p className="text-xs text-gray-500 mb-1">Agentes de voz con IA (Telefonía Integrada)</p>
                            {integrations['ELEVENLABS']?.isEnabled ? (
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
                    <button
                        onClick={() => handleEdit('ELEVENLABS')}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                    >
                        Configurar
                    </button>
                </div>

                {/* WhatsMeow WhatsApp */}
                <div className="border border-gray-200 rounded-xl p-5 flex items-center justify-between hover:border-emerald-200 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white border border-gray-100 rounded-lg flex items-center justify-center p-2 shadow-sm">
                            <span className="text-2xl">💬</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900">WhatsApp (WhatsMeow)</h4>
                            <p className="text-xs text-gray-500 mb-1">Envía mensajes directos por WhatsApp</p>
                            {integrations['WHATSMEOW']?.isEnabled ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Conectado
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                    No configurado
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => handleEdit('WHATSMEOW')}
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
                                Configurar {editingProvider === 'GOOGLE' ? 'Google Calendar' : editingProvider === 'GMAIL' ? 'Gmail' : editingProvider === 'ELEVENLABS' ? 'ElevenLabs Voice' : editingProvider === 'ASSISTAI' ? 'AssistAI' : editingProvider === 'WHATSMEOW' ? 'WhatsApp (WhatsMeow)' : editingProvider}
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

                            {editingProvider === 'OPENAI' && (
                                <>
                                    <div className="bg-green-50 text-green-800 text-xs p-3 rounded-lg mb-4">
                                        ℹ️ Ingresa tu API Key de OpenAI.
                                        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="block mt-1 underline font-bold">Obtener API Key</a>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                        <input
                                            type="password"
                                            value={formData.apiKey || ''}
                                            onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="sk-..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Modelo por defecto (opcional)</label>
                                        <select
                                            value={formData.defaultModel || 'gpt-4'}
                                            onChange={e => setFormData({ ...formData, defaultModel: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                                        >
                                            <option value="gpt-4">GPT-4</option>
                                            <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            {editingProvider === 'GEMINI' && (
                                <>
                                    <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg mb-4">
                                        ℹ️ Ingresa tu API Key de Google AI (Gemini).
                                        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="block mt-1 underline font-bold">Obtener API Key</a>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                        <input
                                            type="password"
                                            value={formData.apiKey || ''}
                                            onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="AIza..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Modelo por defecto (opcional)</label>
                                        <select
                                            value={formData.defaultModel || 'gemini-pro'}
                                            onChange={e => setFormData({ ...formData, defaultModel: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                                        >
                                            <option value="gemini-pro">Gemini Pro</option>
                                            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            {editingProvider === 'ASSISTAI' && (
                                <>
                                    <div className="bg-purple-50 text-purple-800 text-xs p-3 rounded-lg mb-4">
                                        ℹ️ Ingresa las credenciales de tu organización de AssistAI.
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">API Token</label>
                                        <input
                                            type="password"
                                            value={formData.apiToken || ''}
                                            onChange={e => setFormData({ ...formData, apiToken: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="JWT Token"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tenant Domain</label>
                                        <input
                                            type="text"
                                            value={formData.tenantDomain || ''}
                                            onChange={e => setFormData({ ...formData, tenantDomain: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="e.g. ce230715ba86721e"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Organization Code</label>
                                        <input
                                            type="text"
                                            value={formData.organizationCode || ''}
                                            onChange={e => setFormData({ ...formData, organizationCode: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="e.g. d59b32edfb28e130"
                                        />
                                    </div>
                                </>
                            )}

                            {editingProvider === 'ELEVENLABS' && (
                                <>
                                    <div className="bg-orange-50 text-orange-800 text-xs p-3 rounded-lg mb-4">
                                        ℹ️ Configura tu Agente de Voz de ElevenLabs.
                                        <br />Asegúrate de que Twilio esté conectado en tu cuenta de ElevenLabs si requieres telefonía.
                                    </div>
                                    <h4 className="font-bold text-gray-900 border-b pb-1 mb-2">ElevenLabs</h4>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                        <input
                                            type="password"
                                            value={formData.apiKey || ''}
                                            onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="sk_..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Agent ID</label>
                                        <input
                                            type="text"
                                            value={formData.agentId || ''}
                                            onChange={e => setFormData({ ...formData, agentId: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="ID del agente de voz"
                                        />
                                    </div>

                                    <div className="mt-2 flex justify-between items-center">
                                        <button
                                            type="button"
                                            onClick={handleValidateAgent}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                                        >
                                            Validar Agente
                                        </button>
                                    </div>

                                    {/* Test Agent Section */}
                                    {integrations['ELEVENLABS']?.isEnabled && formData.agentId && (
                                        <div className="mt-4 pt-4 border-t border-gray-200">
                                            <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                                                🎙️ Probar Agente
                                            </h4>
                                            <p className="text-xs text-gray-500 mb-3">
                                                Haz clic en el botón de micrófono para iniciar una conversación de prueba con tu agente.
                                            </p>
                                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100">
                                                <div id="elevenlabs-test-widget" className="flex justify-center">
                                                    <elevenlabs-convai agent-id={formData.agentId}></elevenlabs-convai>
                                                </div>
                                                <p className="text-center text-xs text-orange-600 mt-2">
                                                    El widget se conectará al agente configurado
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {editingProvider === 'WHATSMEOW' && (
                                <>
                                    <div className="bg-green-50 text-green-800 text-xs p-3 rounded-lg mb-4">
                                        💬 Conecta tu número de WhatsApp escaneando el código QR.
                                        <br />Se creará automáticamente un agente para tu cuenta.
                                    </div>

                                    {integrations['WHATSMEOW']?.credentials?.agentCode ? (
                                        <>
                                            <div className="text-sm text-gray-600 mb-2">
                                                <strong>Agent Code:</strong> {integrations['WHATSMEOW'].credentials.agentCode}
                                            </div>
                                            <div className="bg-gray-50 rounded-xl p-4 text-center">
                                                <p className="text-sm text-gray-600 mb-2">Escanea el código QR con WhatsApp:</p>
                                                <QRDisplay
                                                    url={`${API_URL}/whatsapp/providers/${integrations['WHATSMEOW'].id}/qr`}
                                                />
                                                <p className="text-xs text-gray-500 mt-2">El QR se actualiza automáticamente</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        const res = await fetch(`${API_URL}/whatsmeow/status`, {
                                                            headers: { 'Authorization': `Bearer ${localStorage.getItem('crm_token')}` }
                                                        });
                                                        const data = await res.json();
                                                        if (data.connected) {
                                                            showToast('✅ WhatsApp conectado correctamente', 'success');
                                                        } else {
                                                            showToast('⏳ Aún no conectado. Escanea el QR.', 'info');
                                                        }
                                                    } catch (err) {
                                                        showToast('Error verificando estado', 'error');
                                                    }
                                                }}
                                                className="mt-3 w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
                                            >
                                                Verificar Conexión
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch(`${API_URL}/whatsmeow/agents`, {
                                                        method: 'POST',
                                                        headers: {
                                                            'Content-Type': 'application/json',
                                                            'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                                                        },
                                                        body: JSON.stringify({})
                                                    });
                                                    if (res.ok) {
                                                        showToast('Agente WhatsMeow creado. Recarga para ver el QR.', 'success');
                                                        fetchIntegrations();
                                                    } else {
                                                        const data = await res.json();
                                                        showToast(`Error: ${data.error}`, 'error');
                                                    }
                                                } catch (err) {
                                                    showToast('Error creando agente', 'error');
                                                }
                                            }}
                                            className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl font-bold transition-colors"
                                        >
                                            Crear Agente WhatsApp
                                        </button>
                                    )}
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
