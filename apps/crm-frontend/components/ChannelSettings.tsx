'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { API_URL } from '../app/api';

type ChannelConfig = {
    id: string;
    channelValue: string;
    platform: 'whatsapp' | 'instagram' | 'web';
    mode: 'ai-only' | 'human-only' | 'hybrid';
    assignedAgentId?: string;
    assignedAgentName?: string;
    humanTakeoverDuration: number;
    autoResumeAI: boolean;
    config?: any;
};

type Agent = {
    id: string;
    name: string;
    provider: string;
    config?: any;
};

export default function ChannelSettings() {
    const [channels, setChannels] = useState<ChannelConfig[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingChannel, setEditingChannel] = useState<ChannelConfig | null>(null);
    const [showCodeModal, setShowCodeModal] = useState<ChannelConfig | null>(null);
    const { showToast } = useToast();

    const [formData, setFormData] = useState({
        channelValue: '',
        platform: 'whatsapp' as 'whatsapp' | 'instagram' | 'web',
        mode: 'hybrid' as 'ai-only' | 'human-only' | 'hybrid',
        assignedAgentId: '',
        humanTakeoverDuration: 60,
        autoResumeAI: true,
    });

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const token = localStorage.getItem('crm_token');
            const [channelsRes, agentsRes] = await Promise.all([
                fetch(`${API_URL}/channels`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${API_URL}/ai-agents`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            let fetchedAgents: Agent[] = [];
            if (agentsRes.ok) {
                const data = await agentsRes.json();
                // Filter only AssistAI agents
                fetchedAgents = data.filter((a: Agent) => a.provider === 'ASSISTAI');
                setAgents(fetchedAgents);
            }

            if (channelsRes.ok) {
                const rawChannels = await channelsRes.json();
                const mappedChannels = rawChannels.map((c: any) => ({
                    ...c,
                    channelValue: c.name,
                    // Map assistaiAgentCode to agent ID if needed
                    assignedAgentId: c.assistaiAgentCode || '',
                    assignedAgentName: fetchedAgents.find(a => {
                        // Match by assistaiCode in config or by ID
                        const agentCode = (a.config as any)?.assistaiCode;
                        return agentCode === c.assistaiAgentCode || a.id === c.assistaiAgentCode;
                    })?.name
                }));
                // Ensure platform and mode are valid (backend sends uppercase)
                const normalizedChannels = mappedChannels.map((c: any) => ({
                    ...c,
                    platform: c.platform?.toLowerCase(),
                    mode: c.mode?.toLowerCase().replace('_', '-') || 'hybrid'
                }));
                console.log('[ChannelSettings] Loaded channels:', normalizedChannels);
                setChannels(normalizedChannels);
            }
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!formData.channelValue) {
            showToast('Ingresa el identificador del canal', 'error');
            return;
        }

        try {
            const agent = agents.find(a => {
                const agentCode = (a.config as any)?.assistaiCode;
                return agentCode === formData.assignedAgentId || a.id === formData.assignedAgentId;
            });
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/channels`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    platform: formData.platform.toUpperCase(), // Backend expects uppercase for enum
                    id: editingChannel?.id,
                    assignedAgentName: agent?.name,
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                showToast(errData.error || 'Error al guardar canal', 'error');
                console.error('[ChannelSettings] Error:', errData);
                return;
            }

            showToast(editingChannel ? 'Canal actualizado' : 'Canal configurado', 'success');
            setShowForm(false);
            setEditingChannel(null);
            resetForm();
            loadData();
        } catch (err) {
            showToast('Error al guardar', 'error');
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar esta configuración de canal?')) return;

        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/channels/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                showToast('Canal eliminado', 'success');
                loadData();
            }
        } catch (err) {
            showToast('Error al eliminar', 'error');
        }
    }

    function resetForm() {
        setFormData({
            channelValue: '',
            platform: 'whatsapp',
            mode: 'hybrid',
            assignedAgentId: '',
            humanTakeoverDuration: 60,
            autoResumeAI: true,
        });
    }

    function startEdit(channel: ChannelConfig) {
        setEditingChannel(channel);
        setFormData({
            channelValue: channel.channelValue,
            platform: channel.platform,
            mode: channel.mode,
            assignedAgentId: channel.assignedAgentId || '',
            humanTakeoverDuration: channel.humanTakeoverDuration,
            autoResumeAI: channel.autoResumeAI,
        });
        setShowForm(true);
    }

    function getPlatformIcon(platform: string) {
        switch (platform) {
            case 'whatsapp': return '📱';
            case 'instagram': return '📸';
            case 'web': return '🌐';
            default: return '❓';
        }
    }

    function getPlatformColor(platform: string) {
        switch (platform) {
            case 'whatsapp': return 'bg-green-100 text-green-700';
            case 'instagram': return 'bg-pink-100 text-pink-700';
            case 'web': return 'bg-blue-100 text-blue-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    }

    const modeLabels = {
        'ai-only': { label: 'Solo IA', color: 'bg-purple-100 text-purple-700', icon: '🤖' },
        'human-only': { label: 'Solo Humano', color: 'bg-blue-100 text-blue-700', icon: '👤' },
        'hybrid': { label: 'Híbrido', color: 'bg-emerald-100 text-emerald-700', icon: '🔄' },
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">⚙️ Configuración de Canales</h1>
                    <p className="text-gray-500 text-sm mt-1">Gestiona cómo se manejan los mensajes de cada canal</p>
                </div>
                <button
                    onClick={() => { resetForm(); setEditingChannel(null); setShowForm(true); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 transition-colors"
                >
                    + Nuevo Canal
                </button>
            </div>

            {/* Mode Legend */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6 flex gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🤖</span>
                    <div>
                        <p className="font-bold text-sm text-gray-800">Solo IA</p>
                        <p className="text-xs text-gray-500">AssistAI responde automáticamente</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-2xl">👤</span>
                    <div>
                        <p className="font-bold text-sm text-gray-800">Solo Humano</p>
                        <p className="text-xs text-gray-500">Equipo responde manualmente</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🔄</span>
                    <div>
                        <p className="font-bold text-sm text-gray-800">Híbrido</p>
                        <p className="text-xs text-gray-500">IA responde, humano puede intervenir</p>
                    </div>
                </div>
            </div>

            {/* Channels List */}
            <div className="space-y-3">
                {channels.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                        <p className="text-gray-400 mb-4">No hay canales configurados</p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="text-emerald-600 font-bold text-sm"
                        >
                            + Configurar primer canal
                        </button>
                    </div>
                ) : (
                    channels.map(channel => (
                        <div
                            key={channel.id}
                            className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${getPlatformColor(channel.platform)}`}>
                                    {getPlatformIcon(channel.platform)}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900">{channel.channelValue}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${modeLabels[channel.mode].color}`}>
                                            {modeLabels[channel.mode].icon} {modeLabels[channel.mode].label}
                                        </span>
                                        {channel.assignedAgentName && (
                                            <span className="text-xs text-gray-500">🤖 {channel.assignedAgentName}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {channel.platform === 'web' && (
                                    <button
                                        onClick={() => setShowCodeModal(channel)}
                                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                        title="Ver código de instalación"
                                    >
                                        💻
                                    </button>
                                )}

                                {(() => {
                                    const widgetId = (channel.config as any)?.widgetId;

                                    let realLink = null;
                                    if (channel.platform === 'whatsapp') {
                                        const num = channel.channelValue.replace(/[^0-9]/g, '');
                                        realLink = `https://wa.me/${num}`;
                                    } else if (channel.platform === 'instagram') {
                                        const user = channel.channelValue.replace('@', '').trim();
                                        realLink = `https://instagram.com/${user}`;
                                    } else if (channel.platform === 'web' && widgetId) {
                                        // For web, the simulator IS the real link
                                        realLink = `${window.location.origin}/live-chat/${widgetId}`;
                                    }

                                    return (
                                        <>
                                            {/* Primary Button: Test Simulator (Available for ALL channels with widgetId) */}
                                            {widgetId && (
                                                <button
                                                    onClick={() => window.open(`${window.location.origin}/live-chat/${widgetId}`, '_blank')}
                                                    className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                    title="Probar Chat con IA (Simulador)"
                                                >
                                                    👁️
                                                </button>
                                            )}

                                            {/* Secondary Button: Real Platform Link (WhatsApp/IG) */}
                                            {realLink && channel.platform !== 'web' && (
                                                <button
                                                    onClick={() => window.open(realLink!, '_blank')}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title={`Ir a ${channel.platform === 'whatsapp' ? 'WhatsApp' : 'Instagram'}`}
                                                >
                                                    🚀
                                                </button>
                                            )}
                                        </>
                                    );
                                })()}

                                <button
                                    onClick={() => startEdit(channel)}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={() => handleDelete(channel.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                            <h3 className="text-lg font-bold">
                                {editingChannel ? '✏️ Editar Canal' : '➕ Nuevo Canal'}
                            </h3>
                            <button onClick={() => setShowForm(false)} className="text-white/80 hover:text-white text-xl">✕</button>
                        </div>
                        <div className="p-5 space-y-4">
                            {/* Platform */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Plataforma</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setFormData({ ...formData, platform: 'whatsapp' })}
                                        className={`flex-1 p-3 rounded-xl border-2 transition-colors ${formData.platform === 'whatsapp'
                                            ? 'border-green-500 bg-green-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <span className="text-2xl">📱</span>
                                        <p className="text-sm font-bold mt-1">WhatsApp</p>
                                    </button>
                                    <button
                                        onClick={() => setFormData({ ...formData, platform: 'instagram' })}
                                        className={`flex-1 p-3 rounded-xl border-2 transition-colors ${formData.platform === 'instagram'
                                            ? 'border-pink-500 bg-pink-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <span className="text-2xl">📸</span>
                                        <p className="text-sm font-bold mt-1">Instagram</p>
                                    </button>
                                    <button
                                        onClick={() => setFormData({ ...formData, platform: 'web' })}
                                        className={`flex-1 p-3 rounded-xl border-2 transition-colors ${formData.platform === 'web'
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <span className="text-2xl">🌐</span>
                                        <p className="text-sm font-bold mt-1">Web</p>
                                    </button>
                                </div>
                            </div>

                            {/* Channel Value */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">
                                    {formData.platform === 'whatsapp' ? 'Número de WhatsApp' :
                                        formData.platform === 'instagram' ? 'Usuario de Instagram' :
                                            'Nombre del Widget'}
                                </label>
                                <input
                                    type="text"
                                    value={formData.channelValue}
                                    onChange={e => setFormData({ ...formData, channelValue: e.target.value })}
                                    placeholder={
                                        formData.platform === 'whatsapp' ? '+584144314817' :
                                            formData.platform === 'instagram' ? '@usuario' :
                                                'Mi Sitio Web'
                                    }
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                />
                            </div>

                            {/* Mode */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Modo de Operación</label>
                                <div className="space-y-2">
                                    {(['ai-only', 'human-only', 'hybrid'] as const).map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setFormData({ ...formData, mode })}
                                            className={`w-full p-3 rounded-xl border-2 text-left transition-colors ${formData.mode === mode
                                                ? 'border-emerald-500 bg-emerald-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">{modeLabels[mode].icon}</span>
                                                <div>
                                                    <p className="font-bold text-sm">{modeLabels[mode].label}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {mode === 'ai-only' && 'AssistAI responde automáticamente'}
                                                        {mode === 'human-only' && 'Tu equipo responde manualmente'}
                                                        {mode === 'hybrid' && 'IA responde, humano puede intervenir'}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Agent Selection */}
                            {formData.mode !== 'human-only' && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Agente IA Asignado</label>
                                    <select
                                        value={formData.assignedAgentId}
                                        onChange={e => setFormData({ ...formData, assignedAgentId: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                    >
                                        <option value="">Seleccionar agente...</option>
                                        {agents.map(agent => {
                                            const assistaiCode = (agent.config as any)?.assistaiCode || agent.id;
                                            return (
                                                <option key={agent.id} value={assistaiCode}>
                                                    🤖 {agent.name} ({agent.provider})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            )}

                            {/* Takeover Duration */}
                            {formData.mode === 'hybrid' && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">
                                        Duración de control humano (minutos)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.humanTakeoverDuration}
                                        onChange={e => setFormData({ ...formData, humanTakeoverDuration: parseInt(e.target.value) })}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Después de este tiempo, la IA retomará el control automáticamente
                                    </p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold transition-colors"
                                >
                                    {editingChannel ? 'Guardar Cambios' : 'Crear Canal'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Code Modal */}
            {showCodeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-900 text-white">
                            <h3 className="text-lg font-bold">
                                💻 Código de Instalación
                            </h3>
                            <button onClick={() => setShowCodeModal(null)} className="text-white/80 hover:text-white text-xl">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-gray-600">
                                Copia y pega este código en el <code className="bg-gray-100 px-1 rounded">&lt;head&gt;</code> o antes del cierre de <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> de tu sitio web.
                            </p>

                            <div className="bg-gray-900 rounded-xl p-4 relative group">
                                <pre className="text-gray-300 font-mono text-sm overflow-x-auto">
                                    {`<script
  src="https://cdn.assistai.lat/widget/v1.js"
  data-agent-id="${showCodeModal.assignedAgentId || 'YOUR_AGENT_ID'}"
  data-theme="light"
  async
></script>`}
                                </pre>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(`<script src="https://cdn.assistai.lat/widget/v1.js" data-agent-id="${showCodeModal.assignedAgentId || 'YOUR_AGENT_ID'}" data-theme="light" async></script>`);
                                        showToast('Código copiado', 'success');
                                    }}
                                    className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                                >
                                    Copiar
                                </button>
                            </div>

                            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm mb-4">
                                <strong>Nota:</strong> Este widget conectará directamente con el agente seleccionado: <strong>{showCodeModal.assignedAgentName || 'Agente'}</strong>.
                            </div>

                            {/* Direct Link Section */}
                            {(showCodeModal as any).config?.widgetId && (
                                <div>
                                    <h4 className="font-bold text-gray-700 mb-2">Enlace Directo</h4>
                                    <div className="flex gap-2">
                                        <input
                                            readOnly
                                            value={`${window.location.origin}/live-chat/${(showCodeModal as any).config.widgetId}`}
                                            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 outline-none"
                                        />
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${window.location.origin}/live-chat/${(showCodeModal as any).config.widgetId}`);
                                                showToast('Enlace copiado', 'success');
                                            }}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                                        >
                                            Copiar
                                        </button>
                                        <button
                                            onClick={() => {
                                                window.open(`${window.location.origin}/live-chat/${(showCodeModal as any).config.widgetId}`, '_blank');
                                            }}
                                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                                        >
                                            Abrir
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
