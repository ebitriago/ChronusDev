'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './Toast';
import { API_URL, getHeaders } from '../app/api';

type ProviderType = 'whatsmeow' | 'meta';

type WhatsAppProvider = {
    id: string;
    name: string;
    type: ProviderType;
    enabled: boolean;
    config: any;
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    lastError?: string;
    connectedAt?: string;
    phoneNumber?: string;
    mode?: 'AI_ONLY' | 'HUMAN_ONLY' | 'HYBRID';
    assistaiAgentCode?: string;
    autoResumeMinutes?: number;
};

type TestMessageResult = {
    phone: string;
    message: string;
    status: 'sending' | 'sent' | 'error';
    timestamp: Date;
    error?: string;
};

// ─── QR Image Component ───────────────────────────────────────────────
function QRImage({ providerId, onRefresh }: { providerId: string; onRefresh: () => void }) {
    const [src, setSrc] = useState<string>('');
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [countdown, setCountdown] = useState(30);
    const [realProviderId, setRealProviderId] = useState(providerId);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    const loadQR = useCallback(async () => {
        try {
            setError(false);
            const res = await fetch(`${API_URL}/whatsapp/providers/${realProviderId}/qr`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                // If backend auto-created a real provider, switch to it
                if (data.providerId && data.providerId !== realProviderId) {
                    setRealProviderId(data.providerId);
                }
                if (data.status === 'connected') {
                    onRefresh();
                    // Trigger recent conversation sync
                    fetch(`${API_URL}/assistai/sync-recent`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({ limit: 20 })
                    }).catch(console.error);
                    return;
                }
                if (data.qr && data.qr.startsWith('data:image')) {
                    setSrc(data.qr);
                } else if (data.qr) {
                    setSrc(`data:image/png;base64,${data.qr}`);
                }
                setLoading(false);
                setCountdown(30);
            } else {
                setError(true);
                setLoading(false);
            }
        } catch {
            setError(true);
            setLoading(false);
        }
    }, [realProviderId, onRefresh]);

    // QR fetch with 30s refresh
    useEffect(() => {
        if (!realProviderId) return;
        setSrc(''); setError(false); setLoading(true);
        loadQR();
        const interval = setInterval(loadQR, 30000);
        return () => clearInterval(interval);
    }, [realProviderId, loadQR]);

    // Countdown timer
    useEffect(() => {
        if (loading || error) return;
        setCountdown(30);
        countdownRef.current = setInterval(() => {
            setCountdown(prev => (prev <= 1 ? 30 : prev - 1));
        }, 1000);
        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [loading, error, src]);

    // Fast status poll (3s)
    useEffect(() => {
        if (!realProviderId) return;
        const checkStatus = async () => {
            try {
                const res = await fetch(`${API_URL}/whatsapp/providers/${realProviderId}/status`, {
                    headers: getHeaders()
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'connected') onRefresh();
                }
            } catch { /* silent */ }
        };
        const interval = setInterval(checkStatus, 3000);
        return () => clearInterval(interval);
    }, [realProviderId, onRefresh]);

    if (error) {
        return (
            <div className="w-56 h-56 bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl flex flex-col items-center justify-center text-center p-4 border border-red-100">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-3">
                    <span className="text-2xl">⚠️</span>
                </div>
                <p className="text-sm font-semibold text-red-700 mb-1">Error cargando QR</p>
                <p className="text-[11px] text-red-500 mb-3">Verifica que el servidor CRM esté funcionando</p>
                <button
                    onClick={loadQR}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                >
                    🔄 Reintentar
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="w-56 h-56 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl flex flex-col items-center justify-center animate-pulse border border-green-100">
                <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-xs text-green-600 font-medium">Generando código QR...</p>
            </div>
        );
    }

    // Countdown progress (0-1)
    const progress = countdown / 30;

    return (
        <div className="flex flex-col items-center gap-3">
            <img
                src={src}
                alt="QR Code"
                className="w-56 h-56 rounded-2xl border-2 border-green-200 shadow-lg shadow-green-500/10"
            />
            {/* Progress bar below QR */}
            <div className="w-56 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className="h-full bg-green-500 rounded-full transition-all duration-1000"
                    style={{ width: `${progress * 100}%` }}
                />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Actualiza en {countdown}s
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────
export default function WhatsAppConfig() {
    const [providers, setProviders] = useState<WhatsAppProvider[]>([]);
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    // Celebration state
    const [justConnected, setJustConnected] = useState(false);
    const [connectedNumber, setConnectedNumber] = useState('');

    // Meta form (controlled)
    const [metaForm, setMetaForm] = useState({
        phoneNumberId: '',
        accessToken: '',
        businessAccountId: ''
    });

    // AI config (controlled)
    const [selectedMode, setSelectedMode] = useState<string>('HYBRID');
    const [selectedAgent, setSelectedAgent] = useState<string>('');
    const [autoResume, setAutoResume] = useState<number>(30);

    // Test sender
    const [testPhone, setTestPhone] = useState('');
    const [testMessage, setTestMessage] = useState('Mensaje de prueba desde ChronusCRM 🚀');
    const [sending, setSending] = useState(false);
    const [testResults, setTestResults] = useState<TestMessageResult[]>([]);

    // Webhook
    const [webhookUrl, setWebhookUrl] = useState('');
    const [savingWebhook, setSavingWebhook] = useState(false);
    const [copiedWebhook, setCopiedWebhook] = useState(false);

    // Agents
    const [agents, setAgents] = useState<any[]>([]);
    const [savingConfig, setSavingConfig] = useState(false);

    // ─── Data Loading ─────────────────────────────────────────────────
    const fetchProviders = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/whatsapp/providers`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setProviders(data);
                if (!selectedProviderId && data.length > 0) {
                    const connected = data.find((p: any) => p.status === 'connected');
                    setSelectedProviderId(connected ? connected.id : data[0].id);
                }
                // Check if a provider just connected
                const connectedProvider = data.find((p: any) => p.status === 'connected');
                if (connectedProvider && connectedProvider.phoneNumber) {
                    setConnectedNumber(connectedProvider.phoneNumber);
                }
            }
        } catch (error) {
            console.error('Error fetching providers:', error);
            showToast('Error cargando configuración', 'error');
        } finally {
            setLoading(false);
        }
    }, [selectedProviderId, showToast]);

    useEffect(() => {
        fetchProviders();
    }, [fetchProviders]);

    // Fetch AssistAI agents
    useEffect(() => {
        fetch(`${API_URL}/assistai/agents`, { headers: getHeaders() })
            .then(r => r.ok ? r.json() : { data: [] })
            .then(data => setAgents(data.data || []))
            .catch(() => setAgents([]));
    }, []);

    // Sync controlled AI config when provider changes
    useEffect(() => {
        const p = providers.find(p => p.id === selectedProviderId);
        if (p) {
            setSelectedMode(p.mode || 'HYBRID');
            setSelectedAgent(p.assistaiAgentCode || '');
            setAutoResume(p.autoResumeMinutes ?? 30);
            if (p.config?.webhookUrl) setWebhookUrl(p.config.webhookUrl);
        }
    }, [selectedProviderId, providers]);

    // ─── Handlers ─────────────────────────────────────────────────────
    const handleRefreshAfterConnect = useCallback(() => {
        setJustConnected(true);
        fetchProviders();
        setTimeout(() => setJustConnected(false), 5000);
    }, [fetchProviders]);

    const handleCreateProvider = async (type: ProviderType) => {
        setLoading(true);
        try {
            const placeholderId = `placeholder-${type}-${Date.now()}`;
            const res = await fetch(`${API_URL}/whatsapp/providers/${placeholderId}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({
                    name: type === 'meta' ? 'WhatsApp Business (Meta)' : 'WhatsApp (WhatsMeow)',
                    enabled: false,
                    config: {},
                    status: 'disconnected'
                })
            });
            if (res.ok) {
                showToast('Proveedor creado', 'success');
                await fetchProviders();
            }
        } catch {
            showToast('Error al crear proveedor', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveMeta = async (providerId: string) => {
        try {
            const res = await fetch(`${API_URL}/whatsapp/providers/${providerId}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ enabled: true, config: metaForm })
            });
            if (res.ok) {
                showToast('Credenciales guardadas', 'success');
                fetchProviders();
            }
        } catch {
            showToast('Error al guardar', 'error');
        }
    };

    const handleTestConnection = async (providerId: string) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/whatsapp/providers/${providerId}/test`, {
                method: 'POST',
                headers: getHeaders()
            });
            if (res.ok) {
                showToast('Conexión exitosa ✅', 'success');
                fetchProviders();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error de conexión', 'error');
            }
        } catch {
            showToast('Error al probar conexión', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async (providerId: string) => {
        if (!confirm('¿Seguro que deseas desconectar este proveedor?')) return;
        try {
            await fetch(`${API_URL}/whatsapp/providers/${providerId}/disconnect`, {
                method: 'POST',
                headers: getHeaders()
            });
            showToast('Desconectado', 'success');
            setJustConnected(false);
            fetchProviders();
        } catch {
            showToast('Error al desconectar', 'error');
        }
    };

    const handleSaveChannelConfig = async (providerId: string) => {
        setSavingConfig(true);
        try {
            const res = await fetch(`${API_URL}/whatsapp/providers/${providerId}/channel-config`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({
                    mode: selectedMode,
                    assistaiAgentCode: selectedAgent,
                    autoResumeMinutes: autoResume
                })
            });
            if (res.ok) {
                showToast('Configuración guardada ✅', 'success');
                fetchProviders();
            } else {
                showToast('Error al guardar', 'error');
            }
        } catch {
            showToast('Error de conexión', 'error');
        } finally {
            setSavingConfig(false);
        }
    };

    const handleSaveWebhook = async (providerId: string) => {
        if (!webhookUrl.trim()) {
            showToast('Ingresa una URL válida', 'error');
            return;
        }
        setSavingWebhook(true);
        try {
            const res = await fetch(`${API_URL}/whatsmeow/configure-webhook`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ webhookUrl: webhookUrl.trim() })
            });
            if (res.ok) {
                showToast('Webhook configurado ✅', 'success');
                fetchProviders();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al guardar webhook', 'error');
            }
        } catch {
            showToast('Error de conexión', 'error');
        } finally {
            setSavingWebhook(false);
        }
    };

    const handleCopyWebhook = (url: string) => {
        navigator.clipboard.writeText(url);
        setCopiedWebhook(true);
        setTimeout(() => setCopiedWebhook(false), 2000);
        showToast('URL copiada', 'success');
    };

    const handleSendTest = async (e: React.FormEvent, providerId: string) => {
        e.preventDefault();
        if (!testPhone || !testMessage) return;
        setSending(true);

        const result: TestMessageResult = {
            phone: testPhone,
            message: testMessage,
            status: 'sending',
            timestamp: new Date()
        };
        setTestResults(prev => [result, ...prev.slice(0, 4)]);

        try {
            const res = await fetch(`${API_URL}/whatsapp/send`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    providerId,
                    to: testPhone,
                    content: testMessage
                })
            });
            if (res.ok) {
                setTestResults(prev =>
                    prev.map((r, i) => i === 0 ? { ...r, status: 'sent' as const } : r)
                );
                showToast('Mensaje enviado ✅', 'success');
                setTestMessage('');
            } else {
                const err = await res.json().catch(() => ({ error: 'Error' }));
                setTestResults(prev =>
                    prev.map((r, i) => i === 0 ? { ...r, status: 'error' as const, error: err.error } : r)
                );
                showToast('Error al enviar', 'error');
            }
        } catch {
            setTestResults(prev =>
                prev.map((r, i) => i === 0 ? { ...r, status: 'error' as const, error: 'Error de conexión' } : r)
            );
            showToast('Error de conexión', 'error');
        } finally {
            setSending(false);
        }
    };

    // ─── Derived State ────────────────────────────────────────────────
    const selectedProvider = providers.find(p => p.id === selectedProviderId) || providers[0];
    const autoWebhookUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/api/whatsmeow/webhook`
        : '';

    // ─── Render ───────────────────────────────────────────────────────
    if (loading && providers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fadeIn">
                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">Cargando configuración WhatsApp...</p>
            </div>
        );
    }

    // ─── Connection Celebration ───────────────────────────────────────
    if (justConnected && selectedProvider?.status === 'connected') {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
                <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-green-500/30 animate-bounce">
                    <span className="text-5xl">✅</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">¡Conectado Exitosamente!</h2>
                <p className="text-gray-500 mb-4">Tu número de WhatsApp está vinculado y listo para recibir mensajes.</p>
                {connectedNumber && (
                    <div className="px-6 py-3 bg-green-50 rounded-xl border border-green-200 text-green-700 font-mono text-lg font-bold mb-6">
                        📱 {connectedNumber}
                    </div>
                )}
                <div className="flex gap-3">
                    <button
                        onClick={() => setJustConnected(false)}
                        className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-500/30"
                    >
                        Continuar a Configuración →
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn space-y-6">
            {/* ─── Header / Provider Tabs ──────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-x-auto">
                        {providers.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setSelectedProviderId(p.id)}
                                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${selectedProviderId === p.id
                                    ? p.status === 'connected'
                                        ? 'bg-green-50 text-green-700 ring-2 ring-green-200 shadow-sm'
                                        : 'bg-gray-100 text-gray-800 ring-2 ring-gray-300 shadow-sm'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                                    }`}
                            >
                                <span className="flex items-center gap-2">
                                    {p.status === 'connected' ? (
                                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                                    ) : (
                                        <span className="w-2.5 h-2.5 rounded-full bg-gray-300"></span>
                                    )}
                                    {p.name}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-200">
                        <button
                            onClick={() => handleCreateProvider('whatsmeow')}
                            className="flex items-center gap-1.5 text-xs bg-green-50 text-green-700 px-3 py-2 rounded-lg hover:bg-green-100 font-bold transition-colors border border-green-100"
                        >
                            <span>📱</span> + WhatsMeow
                        </button>
                        <button
                            onClick={() => handleCreateProvider('meta')}
                            className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-100 font-bold transition-colors border border-blue-100"
                        >
                            <span>♾️</span> + Meta API
                        </button>
                    </div>
                </div>

                {selectedProvider && (
                    <div className="p-6">
                        {/* ─── Provider Status Card ─────────────────── */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg ${selectedProvider.type === 'meta'
                                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/20'
                                    : 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-500/20'
                                    }`}>
                                    {selectedProvider.type === 'meta' ? '♾️' : '📱'}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">{selectedProvider.name}</h3>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${selectedProvider.status === 'connected'
                                            ? 'bg-green-100 text-green-700 border border-green-200'
                                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                                            }`}>
                                            <span className={`w-2 h-2 rounded-full ${selectedProvider.status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                                            {selectedProvider.status === 'connected' ? 'Conectado' : 'Desconectado'}
                                        </span>
                                        {selectedProvider.phoneNumber && (
                                            <span className="text-sm text-gray-600 font-mono bg-gray-50 px-3 py-1 rounded-lg border border-gray-200 font-semibold">
                                                📱 {selectedProvider.phoneNumber}
                                            </span>
                                        )}
                                        {selectedProvider.connectedAt && (
                                            <span className="text-xs text-gray-400">
                                                desde {new Date(selectedProvider.connectedAt).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {selectedProvider.status === 'connected' && (
                                <button
                                    onClick={() => handleDisconnect(selectedProvider.id)}
                                    className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl text-sm font-bold transition-colors border border-red-100 hover:border-red-200"
                                >
                                    ⏏️ Desconectar
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {selectedProvider && (
                <>
                    {/* ─── DISCONNECTED: Connection Warning ────────── */}
                    {selectedProvider.status !== 'connected' && (
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-5 flex items-start gap-4">
                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                                <span className="text-xl">⚡</span>
                            </div>
                            <div>
                                <p className="font-bold text-amber-900">Proveedor No Conectado</p>
                                <p className="text-sm text-amber-700 mt-0.5">
                                    {selectedProvider.type === 'meta'
                                        ? 'Configura tus credenciales de Meta Business API para comenzar a recibir mensajes.'
                                        : 'Escanea el código QR con WhatsApp en tu teléfono para vincular tu número.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ─── META: Credentials Form ──────────────────── */}
                    {selectedProvider.type === 'meta' && selectedProvider.status !== 'connected' && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h4 className="font-bold text-gray-900 text-lg mb-6 flex items-center gap-2">
                                🔑 Credenciales de Meta Business API
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Phone Number ID</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
                                        placeholder="ej. 104581..."
                                        value={metaForm.phoneNumberId || selectedProvider.config.phoneNumberId || ''}
                                        onChange={e => setMetaForm({ ...metaForm, phoneNumberId: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Webhook Verify Token</label>
                                    <div className="flex items-center gap-2">
                                        <code className="w-full bg-blue-50 px-4 py-3 rounded-xl border border-blue-100 text-sm font-mono text-blue-700 select-all font-semibold">
                                            crm_verify_token_2024
                                        </code>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText('crm_verify_token_2024');
                                                showToast('Token copiado', 'success');
                                            }}
                                            className="p-3 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-colors shrink-0"
                                            title="Copiar"
                                        >
                                            📋
                                        </button>
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Access Token (Permanente)</label>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
                                        placeholder="EAAG..."
                                        value={metaForm.accessToken || selectedProvider.config.accessToken || ''}
                                        onChange={e => setMetaForm({ ...metaForm, accessToken: e.target.value })}
                                    />
                                    <p className="text-[11px] text-gray-400 mt-1.5">Token de usuario del sistema o token permanente de Meta Developers.</p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                                <button
                                    onClick={() => handleTestConnection(selectedProvider.id)}
                                    className="px-5 py-2.5 text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-bold transition-colors"
                                >
                                    🔗 Probar Conexión
                                </button>
                                <button
                                    onClick={() => handleSaveMeta(selectedProvider.id)}
                                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-bold shadow-lg shadow-blue-500/20 transition-all"
                                >
                                    💾 Guardar Credenciales
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ─── WHATSMEOW: QR Scanner Flow ──────────────── */}
                    {selectedProvider.type === 'whatsmeow' && selectedProvider.status !== 'connected' && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            {/* Stepper */}
                            <div className="px-6 py-5 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
                                <div className="flex items-center justify-center gap-0 max-w-lg mx-auto">
                                    {[
                                        { step: 1, label: 'Abre WhatsApp', icon: '📱' },
                                        { step: 2, label: 'Dispositivos Vinculados', icon: '🔗' },
                                        { step: 3, label: 'Escanea el QR', icon: '📷' },
                                    ].map((item, idx) => (
                                        <React.Fragment key={item.step}>
                                            <div className="flex flex-col items-center gap-1.5">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${idx === 2
                                                    ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                                                    : 'bg-white text-gray-600 border-2 border-green-200'
                                                    }`}>
                                                    {item.icon}
                                                </div>
                                                <span className={`text-[11px] font-semibold whitespace-nowrap ${idx === 2 ? 'text-green-700' : 'text-gray-500'}`}>
                                                    {item.label}
                                                </span>
                                            </div>
                                            {idx < 2 && (
                                                <div className="w-16 h-0.5 bg-green-200 mx-2 mt-[-16px]"></div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>

                            {/* QR Area */}
                            <div className="p-10 flex flex-col items-center">
                                <h4 className="text-2xl font-bold text-gray-900 mb-2">Vincular Dispositivo</h4>
                                <p className="text-gray-500 mb-8 max-w-md text-center">
                                    Abre WhatsApp en tu teléfono → <strong>Ajustes</strong> → <strong>Dispositivos vinculados</strong> → <strong>Vincular un dispositivo</strong>
                                </p>
                                <div className="p-3 bg-white rounded-3xl shadow-2xl shadow-green-500/10 border-2 border-green-100 mb-6">
                                    <QRImage providerId={selectedProvider.id} onRefresh={handleRefreshAfterConnect} />
                                </div>
                                <div className="flex items-center gap-6 text-xs text-gray-400 mt-2">
                                    <span className="flex items-center gap-1.5">🔒 Cifrado de extremo a extremo</span>
                                    <span className="flex items-center gap-1.5">⚡ Conexión instantánea</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── CONNECTED: Webhook Config (WhatsMeow) ──── */}
                    {selectedProvider.type === 'whatsmeow' && selectedProvider.status === 'connected' && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h4 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                                🔗 Webhook de Entrada
                            </h4>
                            <div className="space-y-4">
                                {/* Auto-detected URL */}
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">URL Detectada Automáticamente</label>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 bg-white px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-mono text-gray-700 overflow-x-auto">
                                            {autoWebhookUrl}
                                        </code>
                                        <button
                                            onClick={() => handleCopyWebhook(autoWebhookUrl)}
                                            className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-all shrink-0 ${copiedWebhook
                                                ? 'bg-green-100 text-green-700 border border-green-200'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                                                }`}
                                        >
                                            {copiedWebhook ? '✅ Copiado' : '📋 Copiar'}
                                        </button>
                                    </div>
                                </div>
                                {/* Custom URL */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">URL Personalizada (Opcional)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                                            placeholder="https://tu-servidor.com/webhook"
                                            value={webhookUrl}
                                            onChange={e => setWebhookUrl(e.target.value)}
                                        />
                                        <button
                                            onClick={() => handleSaveWebhook(selectedProvider.id)}
                                            disabled={savingWebhook}
                                            className="px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm font-bold shadow-sm disabled:bg-gray-300 disabled:shadow-none transition-all whitespace-nowrap"
                                        >
                                            {savingWebhook ? '⏳ Guardando...' : '💾 Guardar'}
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-1.5">
                                        Usa una URL personalizada si la detección automática no funciona para tu entorno.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── CONNECTED: AI Mode Configuration ────────── */}
                    {selectedProvider.status === 'connected' && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h4 className="font-bold text-gray-900 text-lg flex items-center gap-2">🤖 Inteligencia Artificial</h4>
                                    <p className="text-sm text-gray-500 mt-1">Configura cómo responde el asistente en este canal.</p>
                                </div>
                            </div>

                            {/* AI Mode Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                {[
                                    {
                                        mode: 'AI_ONLY',
                                        label: 'IA Total',
                                        icon: '🤖',
                                        description: 'El agente de IA responde automáticamente a todos los mensajes entrantes.',
                                        color: 'purple',
                                        gradient: 'from-purple-500 to-indigo-600',
                                        ring: 'ring-purple-300',
                                        bg: 'bg-purple-50',
                                        border: 'border-purple-200',
                                        text: 'text-purple-700'
                                    },
                                    {
                                        mode: 'HUMAN_ONLY',
                                        label: 'Solo Humano',
                                        icon: '👤',
                                        description: 'Todas las conversaciones van directo a la bandeja de tus agentes.',
                                        color: 'blue',
                                        gradient: 'from-blue-500 to-cyan-600',
                                        ring: 'ring-blue-300',
                                        bg: 'bg-blue-50',
                                        border: 'border-blue-200',
                                        text: 'text-blue-700'
                                    },
                                    {
                                        mode: 'HYBRID',
                                        label: 'Híbrido',
                                        icon: '🔄',
                                        description: 'La IA responde primero; un humano toma control cuando es necesario.',
                                        color: 'indigo',
                                        gradient: 'from-indigo-500 to-violet-600',
                                        ring: 'ring-indigo-300',
                                        bg: 'bg-indigo-50',
                                        border: 'border-indigo-200',
                                        text: 'text-indigo-700'
                                    }
                                ].map(opt => (
                                    <button
                                        key={opt.mode}
                                        onClick={() => setSelectedMode(opt.mode)}
                                        className={`relative p-5 rounded-2xl border-2 text-left transition-all group ${selectedMode === opt.mode
                                            ? `${opt.bg} ${opt.border} ring-2 ${opt.ring} shadow-md`
                                            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                            }`}
                                    >
                                        {selectedMode === opt.mode && (
                                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-100">
                                                <span className="text-green-600 text-sm">✓</span>
                                            </div>
                                        )}
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl mb-3 shadow-lg ${selectedMode === opt.mode
                                            ? `bg-gradient-to-br ${opt.gradient}`
                                            : 'bg-gray-200 group-hover:bg-gray-300'
                                            } transition-colors`}>
                                            {opt.icon}
                                        </div>
                                        <h5 className={`font-bold mb-1 ${selectedMode === opt.mode ? opt.text : 'text-gray-900'}`}>
                                            {opt.label}
                                        </h5>
                                        <p className="text-xs text-gray-500 leading-relaxed">{opt.description}</p>
                                    </button>
                                ))}
                            </div>

                            {/* Agent + Auto-Resume */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Agente AssistAI Asignado</label>
                                    <select
                                        value={selectedAgent}
                                        onChange={e => setSelectedAgent(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none"
                                    >
                                        <option value="">Seleccionar Agente...</option>
                                        {agents.map((agent: any) => (
                                            <option key={agent.code} value={agent.code}>{agent.name}</option>
                                        ))}
                                    </select>
                                    {agents.length === 0 && (
                                        <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                                            ⚠️ No hay agentes. <a href="https://account.assistai.lat" target="_blank" rel="noreferrer" className="underline font-bold">Crear agente en AssistAI</a>
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Auto-Reanudar IA</label>
                                    <select
                                        value={autoResume}
                                        onChange={e => setAutoResume(parseInt(e.target.value))}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none"
                                    >
                                        <option value={15}>⏱️ Tras 15 min de inactividad</option>
                                        <option value={30}>⏱️ Tras 30 min de inactividad</option>
                                        <option value={60}>⏱️ Tras 1 hora de inactividad</option>
                                        <option value={0}>🚫 Nunca (Manual)</option>
                                    </select>
                                    <p className="text-[11px] text-gray-400 mt-1.5">
                                        Tiempo antes de que la IA retome la conversación tras un takeover humano.
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={() => handleSaveChannelConfig(selectedProvider.id)}
                                    disabled={savingConfig}
                                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/40 disabled:bg-gray-300 disabled:shadow-none"
                                >
                                    {savingConfig ? '⏳ Guardando...' : '💾 Aplicar Configuración'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ─── CONNECTED: Test Sender ───────────────────── */}
                    {providers.some(p => p.status === 'connected') && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h4 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                                ✉️ Enviar Mensaje de Prueba
                            </h4>
                            <form onSubmit={(e) => handleSendTest(e, selectedProvider?.id)} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Número</label>
                                        <input
                                            type="tel"
                                            placeholder="+58414..."
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-500/20 outline-none transition-all bg-gray-50 focus:bg-white"
                                            value={testPhone}
                                            onChange={e => setTestPhone(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Mensaje</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Escribe tu mensaje..."
                                                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-500/20 outline-none transition-all bg-gray-50 focus:bg-white"
                                                value={testMessage}
                                                onChange={e => setTestMessage(e.target.value)}
                                                required
                                            />
                                            <button
                                                type="submit"
                                                disabled={sending}
                                                className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-black text-sm font-bold transition-all whitespace-nowrap disabled:bg-gray-400 shadow-lg shadow-gray-500/10"
                                            >
                                                {sending ? (
                                                    <span className="flex items-center gap-2">
                                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                                        Enviando
                                                    </span>
                                                ) : '📤 Enviar'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </form>

                            {/* Test Results History */}
                            {testResults.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Historial de Envíos</p>
                                    {testResults.map((result, idx) => (
                                        <div key={idx} className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm ${result.status === 'sent' ? 'bg-green-50 border border-green-100'
                                            : result.status === 'error' ? 'bg-red-50 border border-red-100'
                                                : 'bg-gray-50 border border-gray-100'
                                            }`}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">
                                                    {result.status === 'sent' ? '✅' : result.status === 'error' ? '❌' : '⏳'}
                                                </span>
                                                <div>
                                                    <span className="font-mono font-semibold text-gray-700">{result.phone}</span>
                                                    <span className="text-gray-400 mx-2">→</span>
                                                    <span className="text-gray-600 truncate max-w-[200px] inline-block align-bottom">
                                                        {result.message.slice(0, 40)}{result.message.length > 40 ? '...' : ''}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-400 shrink-0">
                                                {result.error && <span className="text-red-500">{result.error}</span>}
                                                <span>{result.timestamp.toLocaleTimeString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ─── No Providers ──────────────────────────────────── */}
            {!selectedProvider && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16 px-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <span className="text-4xl">📱</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Configura tu primer canal de WhatsApp</h3>
                    <p className="text-gray-500 max-w-sm mx-auto mb-8">
                        Conecta tu número de WhatsApp o WhatsApp Business para enviar y recibir mensajes desde el CRM.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <button
                            onClick={() => handleCreateProvider('whatsmeow')}
                            className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-500/20 flex items-center gap-2"
                        >
                            📱 WhatsApp Personal
                        </button>
                        <button
                            onClick={() => handleCreateProvider('meta')}
                            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2"
                        >
                            ♾️ WhatsApp Business (Meta)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
