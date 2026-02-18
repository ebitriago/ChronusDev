import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { API_URL } from '../app/api';
// Minimal JWT decode function (no external lib for now to avoid install)
const parseJwt = (token: string) => {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
};

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

export default function Integrations({ onNavigate }: { onNavigate?: (tab: any) => void }) {
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

            if (res.ok) {
                const data = await res.json();
                showToast(`✅ Agente válido: ${data.name || 'Agent'}`, 'success');
            } else {
                const error = await res.json().catch(() => ({ error: 'Invalid agent' }));
                showToast(`❌ ${error.error || 'Error validando agente'}`, 'error');
            }
        } catch (err) {
            showToast('Error de conexión', 'error');
        }
    };

    const handleTestAssistAI = async () => {
        if (!formData.apiToken || !formData.tenantDomain || !formData.organizationCode) {
            showToast('Completa todos los campos de AssistAI', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('crm_token');
            const response = await fetch(`${API_URL}/integrations/test-assistai`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    apiToken: formData.apiToken,
                    tenantDomain: formData.tenantDomain,
                    organizationCode: formData.organizationCode
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showToast(`✅ ${data.message}`, 'success');
            } else {
                showToast(`❌ ${data.error || 'Error de conexión'}`, 'error');
                console.error(data);
            }
        } catch (err: any) {
            showToast(`❌ Error: ${err.message}`, 'error');
            console.error(err);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Integraciones</h3>
            <p className="text-sm text-gray-500 mb-6">Conecta tus herramientas favoritas para potenciar tu CRM.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Google Calendar / Meet */}
                <div className="group bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all hover:border-blue-200">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-white border border-gray-100 rounded-xl flex items-center justify-center p-2 shadow-sm group-hover:scale-105 transition-transform">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="Google Calendar" className="w-full h-full object-contain" />
                        </div>
                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${integrations['GOOGLE']?.connected
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-gray-50 text-gray-500 border-gray-100'
                            }`}>
                            {integrations['GOOGLE']?.connected ? 'Conectado' : 'Desconectado'}
                        </div>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Google Calendar</h4>
                    <p className="text-xs text-gray-500 mb-6 h-8 line-clamp-2">Sincroniza eventos, disponibilidad y crea videollamadas de Meet.</p>

                    <div className="flex gap-2 mt-auto">
                        <button
                            onClick={() => handleEdit('GOOGLE')}
                            className="flex-1 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                        >
                            Configurar
                        </button>
                        <button
                            onClick={() => handleConnect('GOOGLE')}
                            disabled={!integrations['GOOGLE']}
                            className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:shadow-none"
                        >
                            Conectar
                        </button>
                    </div>
                </div>

                {/* Gmail SMTP */}
                <div className="group bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all hover:border-red-200">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-white border border-gray-100 rounded-xl flex items-center justify-center p-2 shadow-sm group-hover:scale-105 transition-transform">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg" alt="Gmail" className="w-full h-full object-contain" />
                        </div>
                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${integrations['GMAIL']?.isEnabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-gray-50 text-gray-500 border-gray-100'
                            }`}>
                            {integrations['GMAIL']?.isEnabled ? 'Activo' : 'Inactivo'}
                        </div>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Gmail SMTP</h4>
                    <p className="text-xs text-gray-500 mb-6 h-8 line-clamp-2">Envío de correos transaccionales y notificaciones desde tu cuenta.</p>

                    <button
                        onClick={() => handleEdit('GMAIL')}
                        className="w-full px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                        Configurar Credenciales
                    </button>
                </div>

                {/* AssistAI */}
                <div className="group bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all hover:border-purple-200">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                            <span className="text-2xl">🤖</span>
                        </div>
                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${integrations['ASSISTAI']?.isEnabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-gray-50 text-gray-500 border-gray-100'
                            }`}>
                            {integrations['ASSISTAI']?.isEnabled ? 'Conectado' : 'Desconectado'}
                        </div>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">AssistAI Base</h4>
                    <p className="text-xs text-gray-500 mb-6 h-8 line-clamp-2">Conexión base para la gestión de agentes de inteligencia artificial.</p>

                    <button
                        onClick={() => handleEdit('ASSISTAI')}
                        className="w-full px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                        Configurar API
                    </button>
                </div>

                {/* OpenAI */}
                <div className="group bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all hover:border-green-200">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                            <span className="text-2xl">🧠</span>
                        </div>
                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${integrations['OPENAI']?.isEnabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-gray-50 text-gray-500 border-gray-100'
                            }`}>
                            {integrations['OPENAI']?.isEnabled ? 'Listo' : 'Sin Configurar'}
                        </div>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">OpenAI (ChatGPT)</h4>
                    <p className="text-xs text-gray-500 mb-6 h-8 line-clamp-2">Potencia tus agentes con los modelos GPT-4 y GPT-3.5 Turbo.</p>

                    <button
                        onClick={() => handleEdit('OPENAI')}
                        className="w-full px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                        Configurar API Key
                    </button>
                </div>

                {/* Google Gemini */}
                <div className="group bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all hover:border-blue-200">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                            <span className="text-2xl">✨</span>
                        </div>
                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${integrations['GEMINI']?.isEnabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-gray-50 text-gray-500 border-gray-100'
                            }`}>
                            {integrations['GEMINI']?.isEnabled ? 'Listo' : 'Sin Configurar'}
                        </div>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Google Gemini</h4>
                    <p className="text-xs text-gray-500 mb-6 h-8 line-clamp-2">Modelos de lenguaje de última generación de Google.</p>

                    <button
                        onClick={() => handleEdit('GEMINI')}
                        className="w-full px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                        Configurar API Key
                    </button>
                </div>

                {/* ElevenLabs */}
                <div className="group bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all hover:border-orange-200">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-600 rounded-xl flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                            <span className="text-2xl">🗣️</span>
                        </div>
                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${integrations['ELEVENLABS']?.isEnabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-gray-50 text-gray-500 border-gray-100'
                            }`}>
                            {integrations['ELEVENLABS']?.isEnabled ? 'Conectado' : 'Desconectado'}
                        </div>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">ElevenLabs Voice</h4>
                    <p className="text-xs text-gray-500 mb-6 h-8 line-clamp-2">Síntesis de voz realista y agentes de voz telefónicos.</p>

                    <div className="flex gap-2 mt-auto">
                        <button
                            onClick={() => handleEdit('ELEVENLABS')}
                            className="w-full px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            Configurar Agente
                        </button>
                    </div>
                </div>

                {/* WhatsApp WhatsMeow */}
                <div className="group bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all hover:border-green-200">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                        </div>
                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${integrations['WHATSMEOW']?.isEnabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-gray-50 text-gray-500 border-gray-100'
                            }`}>
                            {integrations['WHATSMEOW']?.isEnabled ? 'Conectado' : 'Desconectado'}
                        </div>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">WhatsApp</h4>
                    <p className="text-xs text-gray-500 mb-6 h-8 line-clamp-2">Conecta tu número de WhatsApp vía WhatsMeow para enviar y recibir mensajes.</p>

                    <button
                        onClick={() => onNavigate ? onNavigate('whatsapp') : handleEdit('WHATSMEOW')}
                        className="w-full px-3 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm"
                    >
                        Configurar WhatsApp
                    </button>
                </div>

                {/* Instagram */}
                <div className="group bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all hover:border-pink-200">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-500 rounded-xl flex items-center justify-center p-2 shadow-sm group-hover:scale-105 transition-transform">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" alt="Instagram" className="w-full h-full object-contain mix-blend-screen invert" />
                        </div>
                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${integrations['INSTAGRAM']?.isEnabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-gray-50 text-gray-500 border-gray-100'
                            }`}>
                            {integrations['INSTAGRAM']?.isEnabled ? 'Conectado' : 'Desconectado'}
                        </div>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Instagram DM</h4>
                    <p className="text-xs text-gray-500 mb-6 h-8 line-clamp-2">Automatización y gestión de mensajes directos de Instagram.</p>

                    <button
                        onClick={() => handleEdit('INSTAGRAM')}
                        className="w-full px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
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

                                    {/* Test Email Section */}
                                    {integrations['GMAIL']?.isEnabled && (
                                        <div className="mt-6 pt-4 border-t border-gray-200">
                                            <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                                                📧 Probar Envío
                                            </h4>
                                            <div className="flex gap-2">
                                                <input
                                                    type="email"
                                                    placeholder="Enviar prueba a..."
                                                    className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
                                                    id="test-email-input"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const input = document.getElementById('test-email-input') as HTMLInputElement;
                                                        const email = input.value;
                                                        if (!email) {
                                                            showToast('Ingresa un correo para probar', 'error');
                                                            return;
                                                        }

                                                        try {
                                                            const res = await fetch(`${API_URL}/debug/email`, {
                                                                method: 'POST',
                                                                headers: {
                                                                    'Content-Type': 'application/json',
                                                                    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                                                                },
                                                                body: JSON.stringify({
                                                                    to: email,
                                                                    subject: "Prueba de Integración Gmail - ChronusCRM",
                                                                    html: "<h1>¡Funciona!</h1><p>Si lees esto, tu integración de Gmail está enviando correos correctamente.</p>"
                                                                })
                                                            });

                                                            const data = await res.json();
                                                            if (data.success) {
                                                                showToast(`✅ Correo enviado a ${email}`, 'success');
                                                            } else {
                                                                showToast(`❌ Error: ${data.error}`, 'error');
                                                            }
                                                        } catch (e) {
                                                            showToast('Error de conexión', 'error');
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
                                                >
                                                    Enviar
                                                </button>
                                            </div>
                                        </div>
                                    )}
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
                                            onChange={e => {
                                                const token = e.target.value;
                                                const newData = { ...formData, apiToken: token };

                                                // Try to auto-fill from JWT claim
                                                const decoded = parseJwt(token);
                                                if (decoded) {
                                                    if (decoded.tenantDomain) newData.tenantDomain = decoded.tenantDomain;
                                                    if (decoded.orgCode) newData.organizationCode = decoded.orgCode;
                                                    if (decoded.organizationCode) newData.organizationCode = decoded.organizationCode;
                                                }
                                                setFormData(newData);
                                            }}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="JWT Token"
                                        />
                                    </div>
                                    <div className="bg-blue-50 text-blue-800 text-xs p-2 rounded mb-2">
                                        💡 Truco: Pega tu token y trataremos de rellenar el resto automáticamente.
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
                                    <button
                                        type="button"
                                        onClick={handleTestAssistAI}
                                        className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                                    >
                                        🔌 Probar Integración
                                    </button>
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

                            {/* WHATSMEOW config is handled by WhatsAppConfig component via Settings > WhatsApp tab */}

                            {editingProvider === 'META' && (
                                <>
                                    <div className="bg-green-50 text-green-800 text-xs p-3 rounded-lg mb-4">
                                        ℹ️ Configura tu cuenta de WhatsApp Business API desde <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="underline font-bold">Meta Developers</a>.
                                        <br />Tu Webhook URL es: <code className="bg-white px-1 rounded">{API_URL}/meta/webhook</code>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                                        <input
                                            type="password"
                                            value={formData.accessToken || ''}
                                            onChange={e => setFormData({ ...formData, accessToken: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="EAAxxxxxxx..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
                                        <input
                                            type="text"
                                            value={formData.phoneNumberId || ''}
                                            onChange={e => setFormData({ ...formData, phoneNumberId: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="Ej: 123456789012345"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Business Account ID</label>
                                        <input
                                            type="text"
                                            value={formData.businessAccountId || ''}
                                            onChange={e => setFormData({ ...formData, businessAccountId: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="Ej: 987654321098765"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Verify Token (para Webhook)</label>
                                        <input
                                            type="text"
                                            value={formData.verifyToken || ''}
                                            onChange={e => setFormData({ ...formData, verifyToken: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="Token personalizado para verificar webhook"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Elige un token secreto y colócalo en Meta Developers al configurar el webhook</p>
                                    </div>
                                </>
                            )}

                            {editingProvider === 'INSTAGRAM' && (
                                <>
                                    <div className="bg-pink-50 text-pink-800 text-xs p-3 rounded-lg mb-4">
                                        ℹ️ Configura Instagram Messaging desde <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="underline font-bold">Meta Developers</a>.
                                        <br />Tu Webhook URL es: <code className="bg-white px-1 rounded">{API_URL}/instagram/webhook</code>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                                        <input
                                            type="password"
                                            value={formData.accessToken || ''}
                                            onChange={e => setFormData({ ...formData, accessToken: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="EAAxxxxxxx..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Instagram User ID</label>
                                        <input
                                            type="text"
                                            value={formData.igUserId || ''}
                                            onChange={e => setFormData({ ...formData, igUserId: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="ID de tu cuenta de Instagram Business"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Facebook Page ID</label>
                                        <input
                                            type="text"
                                            value={formData.pageId || ''}
                                            onChange={e => setFormData({ ...formData, pageId: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="ID de la página de Facebook conectada"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Verify Token (para Webhook)</label>
                                        <input
                                            type="text"
                                            value={formData.verifyToken || ''}
                                            onChange={e => setFormData({ ...formData, verifyToken: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="Token personalizado para verificar webhook"
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
            )
            }
        </div >
    );
}
