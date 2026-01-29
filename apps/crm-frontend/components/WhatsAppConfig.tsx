'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from './Toast';

const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://127.0.0.1:3002';

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
};

// Component to load QR with auth header
function QRImage({ providerId, onRefresh }: { providerId: string, onRefresh: () => void }) {
    const [src, setSrc] = useState<string>('');
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);

    // 1. Fetch QR (Slow poll) - Keep QR stable for scanning
    useEffect(() => {
        if (!providerId) return;
        setSrc(''); setError(false); setLoading(true);

        const loadQR = async () => {
            try {
                const res = await fetch(`${API_URL}/whatsapp/providers/${providerId}/qr`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('crm_token')}` }
                });
                if (res.ok) {
                    const data = await res.json();

                    if (data.status === 'connected') {
                        onRefresh(); // Parent updates UI
                        // Trigger recent conversation sync
                        fetch(`${API_URL}/assistai/sync-recent`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                            },
                            body: JSON.stringify({ limit: 20 })
                        }).catch(console.error);
                        return;
                    }

                    if (data.qr && data.qr.startsWith('data:image')) {
                        setSrc(data.qr);
                    } else if (data.qr) {
                        // Assuming standard Base64 if no prefix
                        setSrc(`data:image/png;base64,${data.qr}`);
                    } else if (!src) {
                        // Only show placeholder if we don't have a QR yet
                        setSrc('https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg');
                    }
                    setLoading(false);
                } else {
                    console.error('QR fetch failed');
                    setError(true);
                    setLoading(false);
                }
            } catch (e) {
                console.error('QR fetch error:', e);
                setError(true);
                setLoading(false);
            }
        };

        loadQR();
        const interval = setInterval(loadQR, 60000); // 60s Refresh
        return () => clearInterval(interval);
    }, [providerId]);

    // 2. Poll Status (Fast poll) - Detect scan immediately
    useEffect(() => {
        if (!providerId) return;

        const checkStatus = async () => {
            try {
                const res = await fetch(`${API_URL}/whatsapp/providers/${providerId}/status`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('crm_token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'connected') {
                        onRefresh();
                    }
                }
            } catch (err) {
                // Ignore silent poll errors
            }
        };

        const interval = setInterval(checkStatus, 3000); // 3s Status Check
        return () => clearInterval(interval);
    }, [providerId, onRefresh]);

    if (error) {
        return (
            <div className="w-48 h-48 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-center p-2">
                <div className="text-3xl mb-2">⚠️</div>
                <p className="text-xs text-gray-500 mb-2">Error cargando QR</p>
                <button onClick={() => window.location.reload()} className="text-xs text-blue-500 underline">Recargar</button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center animate-pulse">
                <p className="text-xs text-gray-500">Cargando código...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-2">
            <img src={src} alt="QR Code" className="w-48 h-48 border border-gray-200 rounded-lg" />
            <p className="text-xs text-gray-500 animate-pulse">Escanea para conectar...</p>
        </div>
    );
}

export default function WhatsAppConfig() {
    const [providers, setProviders] = useState<WhatsAppProvider[]>([]);
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    // Form states
    const [metaForm, setMetaForm] = useState({
        phoneNumberId: '',
        accessToken: '',
        businessAccountId: ''
    });

    const [testPhone, setTestPhone] = useState('');
    const [testMessage, setTestMessage] = useState('');
    const [sending, setSending] = useState(false);

    const fetchProviders = async () => {
        try {
            const res = await fetch(`${API_URL}/whatsapp/providers`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('crm_token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setProviders(data);
                // Select first connected or first available if none selected
                if (!selectedProviderId && data.length > 0) {
                    // Prefer connected
                    const connected = data.find((p: any) => p.status === 'connected');
                    setSelectedProviderId(connected ? connected.id : data[0].id);
                }
            }
        } catch (error) {
            console.error('Error fetching providers:', error);
            showToast('Error cargando configuración', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProviders();
    }, []);

    const handleCreateProvider = async (type: ProviderType) => {
        setLoading(true);
        try {
            const placeholderId = `placeholder-${type}-${Date.now()}`;
            const res = await fetch(`${API_URL}/whatsapp/providers/${placeholderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                },
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
        } catch (error) {
            showToast('Error al crear proveedor', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveMeta = async (providerId: string) => {
        try {
            const res = await fetch(`${API_URL}/whatsapp/providers/${providerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                },
                body: JSON.stringify({
                    enabled: true,
                    config: metaForm
                })
            });
            if (res.ok) {
                showToast('Configuración guardada', 'success');
                fetchProviders();
            }
        } catch (e) {
            showToast('Error al guardar', 'error');
        }
    };

    const handleTestConnection = async (providerId: string) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/whatsapp/providers/${providerId}/test`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('crm_token')}` }
            });
            if (res.ok) {
                showToast('Conexión exitosa', 'success');
                fetchProviders();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error de conexión', 'error');
            }
        } catch (e) {
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
                headers: { 'Authorization': `Bearer ${localStorage.getItem('crm_token')}` }
            });
            showToast('Desconectado', 'success');
            fetchProviders();
        } catch (e) {
            showToast('Error al desconectar', 'error');
        }
    };

    const handleSendTest = async (e: React.FormEvent, providerId: string) => {
        e.preventDefault();
        setSending(true);
        try {
            const res = await fetch(`${API_URL}/whatsapp/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                },
                body: JSON.stringify({
                    providerId,
                    to: testPhone,
                    content: testMessage
                })
            });

            if (res.ok) {
                showToast('Mensaje enviado', 'success');
                setTestMessage('');
            } else {
                showToast('Error al enviar', 'error');
            }
        } catch (e) {
            showToast('Error de conexión', 'error');
        } finally {
            setSending(false);
        }
    };

    if (loading && providers.length === 0) {
        return <div className="p-8 text-center text-gray-500">Cargando proveedores...</div>;
    }

    const selectedProvider = providers.find(p => p.id === selectedProviderId) || providers[0];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-fadeIn">
            {/* Header / Tabs */}
            <div className="flex items-center justify-between mb-6 border-b pb-4">
                <div className="flex items-center gap-4 overflow-x-auto">
                    {providers.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setSelectedProviderId(p.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedProviderId === p.id
                                ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'
                                : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                {p.status === 'connected' ? '✅' : '⚪️'} {p.name}
                            </span>
                        </button>
                    ))}
                    <div className="flex items-center gap-2 ml-2 pl-2 border-l">
                        <button onClick={() => handleCreateProvider('whatsmeow')} className="text-xs bg-gray-100 px-3 py-1.5 rounded hover:bg-green-50 text-gray-600 hover:text-green-600 transition-colors">
                            + WhatsMeow
                        </button>
                        <button onClick={() => handleCreateProvider('meta')} className="text-xs bg-gray-100 px-3 py-1.5 rounded hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors">
                            + Meta API
                        </button>
                    </div>
                </div>
            </div>

            {/* Provider Content */}
            {selectedProvider ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${selectedProvider.type === 'meta' ? 'bg-blue-600' : 'bg-green-500'}`}>
                                {selectedProvider.type === 'meta' ? '♾️' : '📱'}
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">{selectedProvider.name}</h3>
                                <p className="text-sm text-gray-500">
                                    Estado: <span className={`font-medium ${selectedProvider.status === 'connected' ? 'text-green-600' : 'text-gray-500'}`}>
                                        {selectedProvider.status === 'connected' ? 'Conectado' : 'Desconectado'}
                                    </span>
                                </p>
                            </div>
                        </div>
                        {selectedProvider.status === 'connected' && (
                            <button
                                onClick={() => handleDisconnect(selectedProvider.id)}
                                className="text-red-500 hover:bg-red-50 px-3 py-1 rounded text-sm transition-colors"
                            >
                                Desconectar
                            </button>
                        )}
                    </div>

                    {/* Meta Config Form */}
                    {selectedProvider.type === 'meta' && selectedProvider.status !== 'connected' && (
                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                            <h4 className="font-medium text-gray-900 mb-4">Credenciales Meta Business API</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number ID</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border rounded-lg text-sm"
                                        placeholder="ej. 1045..."
                                        value={metaForm.phoneNumberId || selectedProvider.config.phoneNumberId}
                                        onChange={e => setMetaForm({ ...metaForm, phoneNumberId: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Access Token</label>
                                    <input
                                        type="password"
                                        className="w-full px-3 py-2 border rounded-lg text-sm"
                                        placeholder="EAAG..."
                                        value={metaForm.accessToken || selectedProvider.config.accessToken}
                                        onChange={e => setMetaForm({ ...metaForm, accessToken: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Webhook Verify Token</label>
                                    <div className="flex items-center gap-2">
                                        <code className="bg-white px-2 py-1 rounded border text-xs flex-1">crm_verify_token_2024</code>
                                        <span className="text-xs text-gray-500">(Fijo)</span>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        onClick={() => handleTestConnection(selectedProvider.id)}
                                        className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50 text-sm"
                                    >
                                        Probar Conexión
                                    </button>
                                    <button
                                        onClick={() => handleSaveMeta(selectedProvider.id)}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* WhatsMeow Config (QR) */}
                    {selectedProvider.type === 'whatsmeow' && selectedProvider.status !== 'connected' && (
                        <div className="bg-white border-2 border-dashed border-gray-200 p-8 rounded-xl text-center">
                            <h4 className="font-medium text-gray-900 mb-4">Vincular Dispositivo</h4>
                            <QRImage providerId={selectedProvider.id} onRefresh={fetchProviders} />
                        </div>
                    )}

                    {/* Test Sender */}
                    {selectedProvider.status === 'connected' && (
                        <div className="border-t pt-6">
                            <h4 className="font-medium text-gray-900 mb-4">Enviar Mensaje de Prueba</h4>
                            <form onSubmit={(e) => handleSendTest(e, selectedProvider.id)} className="flex gap-3 items-start">
                                <div className="flex-1 space-y-3">
                                    <input
                                        type="tel"
                                        placeholder="+58414..."
                                        className="w-full px-3 py-2 border rounded-lg text-sm"
                                        value={testPhone}
                                        onChange={e => setTestPhone(e.target.value)}
                                        required
                                    />
                                    <textarea
                                        placeholder="Mensaje..."
                                        className="w-full px-3 py-2 border rounded-lg text-sm h-20 resize-none"
                                        value={testMessage}
                                        onChange={e => setTestMessage(e.target.value)}
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black text-sm whitespace-nowrap"
                                >
                                    {sending ? 'Enviando...' : 'Enviar'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-12 text-gray-500">
                    <p>No hay proveedores configurados.</p>
                    <p className="text-sm">Selecciona una opción arriba para comenzar.</p>
                </div>
            )}
        </div>
    );
}
