'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from './Toast';

const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://127.0.0.1:3002';

type WhatsMeowStatus = {
    configured: boolean;
    connected: boolean;
    accountInfo?: any;
    agentCode?: string;
};

// Component to load QR with auth header
function QRImage({ agentCode, onReset }: { agentCode: string, onReset: () => void }) {
    const [src, setSrc] = useState<string>('');
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!agentCode) return;
        setSrc(''); setError(false);

        const loadQR = async () => {
            try {
                // The backend now checks agent existence before fetching QR
                // If backend returns 500/404, we show error
                const res = await fetch(`${API_URL}/whatsmeow/agents/${agentCode}/qr`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('crm_token')}` }
                });
                if (res.ok) {
                    const blob = await res.blob();
                    setSrc(URL.createObjectURL(blob));
                } else {
                    console.error('QR fetch failed:', res.status, res.statusText);
                    setError(true);
                }
            } catch (e) {
                console.error('QR fetch error:', e);
                setError(true);
            }
        };
        loadQR();

        const interval = setInterval(loadQR, 30000);
        return () => clearInterval(interval);
    }, [agentCode]);

    if (error) {
        return (
            <div className="w-48 h-48 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-center p-2">
                <div className="text-3xl mb-2">⚠️</div>
                <p className="text-xs text-gray-500 mb-2">Error cargando QR</p>
                <div className="text-[10px] text-gray-400 mb-2">Error del servidor externo</div>
                <button
                    onClick={onReset}
                    className="px-3 py-1 bg-white border border-gray-300 rounded text-xs text-red-600 hover:bg-gray-50 transition-colors"
                >
                    Nuevo Agente
                </button>
            </div>
        );
    }

    if (!src) {
        return (
            <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center animate-pulse">
                <div className="text-center">
                    <div className="text-3xl mb-2">📱</div>
                    <p className="text-xs text-gray-500">Cargando QR...</p>
                </div>
            </div>
        );
    }

    return <img src={src} alt="QR Code" className="w-48 h-48 border border-gray-200 rounded-lg" />;
}

export default function WhatsAppConfig() {
    const [status, setStatus] = useState<WhatsMeowStatus>({ configured: false, connected: false });
    const [loading, setLoading] = useState(true);
    const [testPhone, setTestPhone] = useState('');
    const [testMessage, setTestMessage] = useState('');
    const [sending, setSending] = useState(false);
    const { showToast } = useToast();

    const fetchStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/whatsmeow/status`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('crm_token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            }
        } catch (error) {
            console.error('Error fetching status:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const handleCreateAgent = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/whatsmeow/agents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                }
            });

            if (res.ok) {
                showToast('Agente creado correctamente', 'success');
                await fetchStatus();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al crear agente', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async () => {
        if (!confirm('¿Seguro que quieres borrar la configuración y crear un nuevo agente?')) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/whatsmeow/reset`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                }
            });

            if (res.ok) {
                showToast('Configuración reiniciada', 'success');
                // Force reset state locally
                setStatus({ configured: false, connected: false });
            } else {
                showToast('Error al reiniciar', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyConnection = async () => {
        setLoading(true);
        await fetchStatus();
        setLoading(false);
    };

    const handleSendTestMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        try {
            const res = await fetch(`${API_URL}/whatsmeow/send/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                },
                body: JSON.stringify({ to: testPhone, message: testMessage })
            });

            if (res.ok) {
                showToast('Mensaje enviado', 'success');
                setTestMessage('');
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al enviar mensaje', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        } finally {
            setSending(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('¿Seguro que quieres desconectar?')) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/whatsmeow/disconnect`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('crm_token')}` }
            });

            if (res.ok) {
                showToast('Desconectado correctamente', 'success');
                fetchStatus();
            } else {
                showToast('Error al desconectar', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Cargando estado de WhatsApp...</div>;
    }

    /* 1. Not Configured - Show Create Button */
    if (!status.configured) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center animate-fadeIn">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">📱</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">WhatsApp (WhatsMeow)</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    Envía mensajes directos usando tu número de WhatsApp. Vincula tu dispositivo para comenzar.
                </p>
                <button
                    onClick={handleCreateAgent}
                    disabled={loading}
                    className="bg-[#25D366] text-white px-6 py-2.5 rounded-lg hover:bg-[#20bd5a] transition-colors font-medium inline-flex items-center gap-2 shadow-sm"
                >
                    🚀 Crear Agente WhatsApp
                </button>
            </div>
        );
    }

    /* 2. Configured but not connected - Show QR */
    if (status.configured && !status.connected) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 animate-fadeIn">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#25D366] rounded-lg flex items-center justify-center text-white">
                            📱
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">WhatsApp (WhatsMeow)</h3>
                            <p className="text-sm text-gray-500">Envía mensajes directos usando tu número de WhatsApp</p>
                        </div>
                    </div>
                </div>

                <div className="text-center py-4">
                    <div className="flex items-center justify-center gap-2 text-yellow-600 bg-yellow-50 py-2 px-4 rounded-full inline-flex mb-8">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                        <span className="text-sm font-medium">⏳ Pendiente de vincular</span>
                    </div>

                    <h4 className="font-medium text-gray-900 mb-4">Escanea el código QR</h4>

                    <div className="bg-gray-50 rounded-xl p-6 mb-4 inline-block">
                        {status.agentCode ? (
                            <QRImage agentCode={status.agentCode} onReset={handleReset} />
                        ) : (
                            <div className="text-red-500">Error: No hay código de agente</div>
                        )}
                    </div>

                    <div className="max-w-md mx-auto bg-blue-50 rounded-lg p-4 text-left mb-6">
                        <h5 className="text-sm font-semibold text-blue-900 mb-2">📖 Instrucciones</h5>
                        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                            <li>Abre WhatsApp en tu teléfono</li>
                            <li>Ve a Configuración → Dispositivos vinculados</li>
                            <li>Toca "Vincular un dispositivo"</li>
                            <li>Escanea el código QR</li>
                        </ol>
                    </div>

                    <div className="flex flex-col gap-3 items-center">
                        <button
                            onClick={handleVerifyConnection}
                            className="text-[#25D366] hover:text-[#20bd5a] font-medium text-sm flex items-center gap-1"
                        >
                            🔄 Verificar Conexión
                        </button>

                        <button
                            onClick={handleReset}
                            className="text-gray-400 hover:text-red-500 text-xs underline"
                        >
                            ❌ Cancelar / Cambiar Agente
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /* 3. Connected - Show Test Form */
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 animate-fadeIn">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#25D366] rounded-lg flex items-center justify-center text-white">
                        📱
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">WhatsApp (WhatsMeow)</h3>
                        <p className="text-sm text-gray-500">
                            Conectado: {status.accountInfo?.PushName || status.accountInfo?.JID || 'Desconocido'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleDisconnect}
                    className="text-red-500 hover:text-red-600 text-sm font-medium px-4 py-2 hover:bg-red-50 rounded-lg transition-colors"
                >
                    Desconectar
                </button>
            </div>

            <div className="flex items-center gap-2 text-green-600 bg-green-50 py-2 px-4 rounded-full inline-flex mb-8">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-sm font-medium">✅ Conectado y listo para enviar</span>
            </div>

            <div className="max-w-md">
                <h4 className="font-medium text-gray-900 mb-4">Enviar mensaje de prueba</h4>
                <form onSubmit={handleSendTestMessage} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Número de destino</label>
                        <input
                            type="tel"
                            placeholder="Ej: 584241234567"
                            value={testPhone}
                            onChange={(e) => setTestPhone(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent outline-none transition-all"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">Incluye código de país sin + (ej: 58...)</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
                        <textarea
                            placeholder="Escribe un mensaje de prueba..."
                            value={testMessage}
                            onChange={(e) => setTestMessage(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent outline-none transition-all h-24 resize-none"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={sending}
                        className="bg-gray-900 text-white px-6 py-2.5 rounded-lg hover:bg-gray-800 transition-colors font-medium w-full flex items-center justify-center gap-2"
                    >
                        {sending ? 'Enviando...' : '✉️ Enviar Mensaje'}
                    </button>
                </form>
            </div>
        </div>
    );
}
