'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';

const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://127.0.0.1:3002';

type WhatsAppProvider = {
    id: string;
    name: string;
    type: 'whatsmeow' | 'meta';
    enabled: boolean;
    config: {
        apiUrl?: string;
        apiKey?: string;
        sessionId?: string;
        phoneNumberId?: string;
        accessToken?: string;
        businessAccountId?: string;
        webhookVerifyToken?: string;
    };
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    lastError?: string;
    connectedAt?: string;
};

export default function WhatsAppConfig() {
    const [providers, setProviders] = useState<WhatsAppProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingProvider, setEditingProvider] = useState<WhatsAppProvider | null>(null);
    const [testing, setTesting] = useState<string | null>(null);
    const [qrModal, setQrModal] = useState<{ providerId: string; qr: string; instructions: string[] } | null>(null);
    const [loadingQr, setLoadingQr] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        fetchProviders();
    }, []);

    const fetchProviders = async () => {
        try {
            const res = await fetch(`${API_URL}/whatsapp/providers`);
            if (res.ok) setProviders(await res.json());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (id: string, enabled: boolean) => {
        try {
            const res = await fetch(`${API_URL}/whatsapp/providers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            if (res.ok) {
                fetchProviders();
                showToast(enabled ? 'Proveedor habilitado' : 'Proveedor deshabilitado', 'success');
            }
        } catch (err) {
            showToast('Error actualizando proveedor', 'error');
        }
    };

    const handleTest = async (id: string) => {
        setTesting(id);
        try {
            const res = await fetch(`${API_URL}/whatsapp/providers/${id}/test`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showToast(data.message, 'success');
            } else {
                showToast(`Error: ${data.error}`, 'error');
            }
            fetchProviders();
        } catch (err) {
            showToast('Error probando conexión', 'error');
        } finally {
            setTesting(null);
        }
    };

    const handleSaveConfig = async () => {
        if (!editingProvider) return;
        try {
            const res = await fetch(`${API_URL}/whatsapp/providers/${editingProvider.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: editingProvider.config })
            });
            if (res.ok) {
                showToast('Configuración guardada', 'success');
                setEditingProvider(null);
                fetchProviders();
            }
        } catch (err) {
            showToast('Error guardando', 'error');
        }
    };

    // Request QR for WhatsMeow
    const handleRequestQR = async (id: string) => {
        setLoadingQr(true);
        try {
            const res = await fetch(`${API_URL}/whatsapp/providers/${id}/qr`);
            const data = await res.json();
            if (data.qr) {
                setQrModal({ providerId: id, qr: data.qr, instructions: data.instructions || [] });
                fetchProviders();
            } else {
                showToast(data.error || 'Error obteniendo QR', 'error');
            }
        } catch (err) {
            showToast('Error solicitando QR', 'error');
        } finally {
            setLoadingQr(false);
        }
    };

    const statusColors: Record<string, string> = {
        connected: 'bg-emerald-100 text-emerald-700',
        connecting: 'bg-blue-100 text-blue-700',
        disconnected: 'bg-gray-100 text-gray-500',
        error: 'bg-red-100 text-red-700'
    };

    if (loading) {
        return <div className="text-center py-10 text-gray-400">Cargando proveedores...</div>;
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg">
                    📱
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Integración WhatsApp</h2>
                    <p className="text-sm text-gray-500">Configura proveedores WhatsMeow y Meta Business API</p>
                </div>
            </div>

            {/* Providers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providers.map(provider => (
                    <div
                        key={provider.id}
                        className={`bg-white rounded-2xl border p-5 transition-all ${provider.enabled ? 'border-emerald-200 shadow-lg shadow-emerald-500/10' : 'border-gray-200'
                            }`}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${provider.type === 'whatsmeow'
                                    ? 'bg-purple-100 text-purple-600'
                                    : 'bg-blue-100 text-blue-600'
                                    }`}>
                                    {provider.type === 'whatsmeow' ? '🔧' : '📘'}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900">{provider.name}</h3>
                                    <span className="text-xs text-gray-400 uppercase">{provider.type}</span>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={provider.enabled}
                                    onChange={(e) => handleToggle(provider.id, e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-2 mb-4">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${statusColors[provider.status]}`}>
                                {provider.status === 'connected' && '✓ '}
                                {provider.status === 'error' && '⚠ '}
                                {provider.status.toUpperCase()}
                            </span>
                            {provider.connectedAt && (
                                <span className="text-xs text-gray-400">
                                    desde {new Date(provider.connectedAt).toLocaleString()}
                                </span>
                            )}
                        </div>

                        {provider.lastError && (
                            <div className="mb-4 p-2 bg-red-50 rounded-lg text-xs text-red-600">
                                {provider.lastError}
                            </div>
                        )}

                        {/* Config Preview */}
                        <div className="text-xs text-gray-500 mb-4 bg-gray-50 p-3 rounded-lg space-y-1">
                            {provider.type === 'whatsmeow' ? (
                                <>
                                    <div><strong>API URL:</strong> {provider.config.apiUrl || 'No configurada'}</div>
                                    <div><strong>Session:</strong> {provider.config.sessionId || 'N/A'}</div>
                                </>
                            ) : (
                                <>
                                    <div><strong>Phone ID:</strong> {provider.config.phoneNumberId || 'No configurado'}</div>
                                    <div><strong>Token:</strong> {provider.config.accessToken || 'No configurado'}</div>
                                </>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setEditingProvider({ ...provider })}
                                className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                            >
                                ⚙️ Configurar
                            </button>
                            {provider.type === 'whatsmeow' && provider.status !== 'connected' && (
                                <button
                                    onClick={() => handleRequestQR(provider.id)}
                                    disabled={loadingQr}
                                    className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors"
                                >
                                    {loadingQr ? '...' : '📱 Vincular'}
                                </button>
                            )}
                            <button
                                onClick={() => handleTest(provider.id)}
                                disabled={testing === provider.id}
                                className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors"
                            >
                                {testing === provider.id ? '...' : '🔌 Probar'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Webhook Info */}
            <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
                <h3 className="font-bold text-blue-900 mb-2">📡 Webhook URL para Meta Business API</h3>
                <p className="text-sm text-blue-700 mb-3">Usa esta URL en tu configuración de Meta para recibir mensajes:</p>
                <code className="block bg-white p-3 rounded-lg text-sm font-mono text-blue-800 break-all">
                    {`${API_URL}/whatsapp/webhook`}
                </code>
                <p className="text-xs text-blue-600 mt-2">Verify Token: <code className="bg-white px-2 py-0.5 rounded">crm_verify_token_2024</code></p>
            </div>

            {/* Edit Modal */}
            {editingProvider && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">
                                Configurar {editingProvider.name}
                            </h3>
                            <button onClick={() => setEditingProvider(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="space-y-4">
                            {editingProvider.type === 'whatsmeow' ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">API URL (Servidor de Bernardo)</label>
                                        <input
                                            type="url"
                                            value={editingProvider.config.apiUrl || ''}
                                            onChange={e => setEditingProvider({
                                                ...editingProvider,
                                                config: { ...editingProvider.config, apiUrl: e.target.value }
                                            })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="http://servidor:8080"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                        <input
                                            type="password"
                                            value={editingProvider.config.apiKey || ''}
                                            onChange={e => setEditingProvider({
                                                ...editingProvider,
                                                config: { ...editingProvider.config, apiKey: e.target.value }
                                            })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="Tu API key"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Session ID</label>
                                        <input
                                            type="text"
                                            value={editingProvider.config.sessionId || ''}
                                            onChange={e => setEditingProvider({
                                                ...editingProvider,
                                                config: { ...editingProvider.config, sessionId: e.target.value }
                                            })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="crm-session-1"
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
                                        <input
                                            type="text"
                                            value={editingProvider.config.phoneNumberId || ''}
                                            onChange={e => setEditingProvider({
                                                ...editingProvider,
                                                config: { ...editingProvider.config, phoneNumberId: e.target.value }
                                            })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="123456789012345"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                                        <input
                                            type="password"
                                            value={editingProvider.config.accessToken || ''}
                                            onChange={e => setEditingProvider({
                                                ...editingProvider,
                                                config: { ...editingProvider.config, accessToken: e.target.value }
                                            })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="EAAxxxxxxx..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Business Account ID (WABA)</label>
                                        <input
                                            type="text"
                                            value={editingProvider.config.businessAccountId || ''}
                                            onChange={e => setEditingProvider({
                                                ...editingProvider,
                                                config: { ...editingProvider.config, businessAccountId: e.target.value }
                                            })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="123456789012345"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setEditingProvider(null)}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveConfig}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold"
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Modal */}
            {qrModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Vincular WhatsApp</h3>
                            <button onClick={() => setQrModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        {/* QR Code Display */}
                        <div className="bg-gray-100 rounded-xl p-8 mb-4">
                            <div className="w-48 h-48 mx-auto bg-white rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                                {qrModal.qr.startsWith('data:') ? (
                                    <img src={qrModal.qr} alt="QR Code" className="w-full h-full" />
                                ) : (
                                    <div className="text-center">
                                        <div className="text-5xl mb-2">📱</div>
                                        <p className="text-xs text-gray-500">QR aparecerá aquí cuando Bernardo proporcione la API</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="text-left bg-blue-50 rounded-xl p-4 mb-4">
                            <h4 className="font-bold text-blue-900 mb-2">📖 Instrucciones</h4>
                            <ol className="text-sm text-blue-800 space-y-1">
                                {qrModal.instructions.map((inst, i) => (
                                    <li key={i}>{inst}</li>
                                ))}
                            </ol>
                        </div>

                        <button
                            onClick={() => setQrModal(null)}
                            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl font-medium"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
