'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_URL, getHeaders } from '../app/api';

type Agent = {
    code: string;
    name: string;
    model: string;
    description: string;
    createdAt: string;
    localConfig?: {
        customName?: string;
        notes?: string;
        assignedToUserId?: string;
    };
};

type Conversation = {
    uuid: string;
    title: string;
    createdAt: string;
    channel?: string;
    agentCode?: string;
};

type AgentDetail = Agent & {
    stats: {
        totalConversations: number;
        recentConversations: Conversation[];
    };
};

export default function AssistAI() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'agents' | 'conversations'>('agents');

    // Modal state
    const [selectedAgent, setSelectedAgent] = useState<AgentDetail | null>(null);
    const [agentModalOpen, setAgentModalOpen] = useState(false);
    const [loadingAgent, setLoadingAgent] = useState(false);
    const [agentError, setAgentError] = useState<string | null>(null);
    const [currentAgentCode, setCurrentAgentCode] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [editNotes, setEditNotes] = useState('');
    const [editCustomName, setEditCustomName] = useState('');

    // Connection status
    const [isConnected, setIsConnected] = useState(false);

    // Fetch agents and conversations
    const loadData = useCallback(async () => {
        setLoadError(null);
        try {
            const headers = getHeaders();
            const [agentsRes, convsRes, configsRes] = await Promise.all([
                fetch(`${API_URL}/assistai/agents`, { headers }),
                fetch(`${API_URL}/assistai/conversations`, { headers }),
                fetch(`${API_URL}/assistai/configs`, { headers })
            ]);

            const agentsData = agentsRes.ok ? await agentsRes.json() : { data: [] };
            const convsData = convsRes.ok ? await convsRes.json() : { data: [] };
            const configs = configsRes.ok ? await configsRes.json() : [];

            // At least one endpoint succeeded = connected
            setIsConnected(agentsRes.ok);

            // Merge local configs with agents
            const configsMap = new Map(configs.map((c: any) => [c.code, c]));
            const enrichedAgents = (agentsData.data || []).map((agent: Agent) => ({
                ...agent,
                localConfig: configsMap.get(agent.code) || null
            }));
            setAgents(enrichedAgents);
            setConversations(convsData.data || []);
        } catch (err) {
            setIsConnected(false);
            setLoadError('Error de conexión con AssistAI');
            console.error('[AssistAI] Load error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Sync all conversations
    const handleSyncAll = async () => {
        setSyncing(true);
        setSyncResult(null);

        // Timeout protection: auto-reset after 60s
        const timeout = setTimeout(() => {
            setSyncing(false);
            setSyncResult('❌ Timeout: La sincronización tardó demasiado');
        }, 60000);

        try {
            const res = await fetch(`${API_URL}/assistai/sync-all`, {
                method: 'POST',
                headers: getHeaders()
            });
            const data = await res.json();
            if (data.success) {
                setSyncResult(`✅ Sincronizadas ${data.synced} nuevas, ${data.updated} actualizadas. Total: ${data.total} conversaciones`);
                // Refresh list
                const convRes = await fetch(`${API_URL}/assistai/conversations`, { headers: getHeaders() });
                if (convRes.ok) {
                    const convData = await convRes.json();
                    setConversations(convData.data || []);
                }
            } else {
                setSyncResult(`❌ Error: ${data.error}`);
            }
        } catch (err) {
            setSyncResult('❌ Error de conexión');
        } finally {
            clearTimeout(timeout);
            setSyncing(false);
        }
    };

    // Open agent detail modal
    const openAgentDetail = async (agentCode: string) => {
        setLoadingAgent(true);
        setAgentModalOpen(true);
        setAgentError(null);
        setSaveError(null);
        setSelectedAgent(null);
        setCurrentAgentCode(agentCode);
        try {
            const res = await fetch(`${API_URL}/assistai/agents/${agentCode}`, {
                headers: getHeaders()
            });
            const data = await res.json();
            if (res.ok) {
                setSelectedAgent(data);
                setEditNotes(data.localConfig?.notes || '');
                setEditCustomName(data.localConfig?.customName || '');
            } else {
                setAgentError(data.error || 'Error cargando agente');
            }
        } catch (err) {
            setAgentError('Error de conexión con el servidor');
        } finally {
            setLoadingAgent(false);
        }
    };

    // Save local config
    const saveAgentConfig = async () => {
        if (!selectedAgent) return;

        setSaving(true);
        setSaveError(null);
        try {
            const res = await fetch(`${API_URL}/assistai/agents/${selectedAgent.code}/config`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({
                    customName: editCustomName,
                    notes: editNotes
                })
            });
            if (res.ok) {
                // Update agent in list
                setAgents(prev => prev.map(a =>
                    a.code === selectedAgent.code
                        ? { ...a, localConfig: { customName: editCustomName, notes: editNotes } }
                        : a
                ));
                setAgentModalOpen(false);
            } else {
                const data = await res.json().catch(() => ({}));
                setSaveError(data.error || 'Error guardando configuración');
            }
        } catch (err) {
            setSaveError('Error de conexión al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-purple-500/30">
                        🤖
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">AssistAI</h2>
                        <p className="text-gray-500">Agentes de IA para WhatsApp & Instagram</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <a
                        href="https://account.assistai.lat"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors flex items-center gap-2"
                    >
                        🔗 Ir a AssistAI
                    </a>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${isConnected
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                            }`}></span>
                        {isConnected ? 'Conectado' : 'Desconectado'}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('agents')}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${activeTab === 'agents' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    🤖 Agentes ({agents.length})
                </button>
                <button
                    onClick={() => setActiveTab('conversations')}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${activeTab === 'conversations' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    💬 Conversaciones ({conversations.length})
                </button>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-400">Cargando datos de AssistAI...</div>
            ) : loadError ? (
                <div className="text-center py-20">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⚠️</div>
                    <p className="text-red-600 font-bold mb-2">{loadError}</p>
                    <button
                        onClick={loadData}
                        className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors"
                    >
                        🔄 Reintentar
                    </button>
                </div>
            ) : (
                <>
                    {/* Agents Tab */}
                    {activeTab === 'agents' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {agents.map(agent => (
                                <div
                                    key={agent.code}
                                    onClick={() => openAgentDetail(agent.code)}
                                    className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-lg hover:border-purple-200 transition-all cursor-pointer group"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:scale-105 transition-transform">
                                            {agent.name.charAt(0)}
                                        </div>
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-mono">
                                            {agent.model}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-gray-900 mb-1">
                                        {agent.localConfig?.customName || agent.name}
                                    </h3>
                                    {agent.localConfig?.customName && (
                                        <p className="text-[10px] text-purple-600 font-bold mb-1">Nombre original: {agent.name}</p>
                                    )}
                                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                                        {agent.description || 'Sin descripción'}
                                    </p>
                                    {agent.localConfig?.notes && (
                                        <p className="text-[10px] text-gray-400 italic line-clamp-1 mb-2">
                                            📝 {agent.localConfig.notes}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-gray-400">
                                            {new Date(agent.createdAt).toLocaleDateString()}
                                        </span>
                                        <span className="px-2 py-1 bg-green-50 text-green-600 rounded text-[10px] font-bold">
                                            ✓ Activo
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {agents.length === 0 && (
                                <div className="col-span-full text-center py-10 text-gray-400">
                                    No hay agentes configurados. Configúralos en <a href="https://account.assistai.lat" target="_blank" className="text-purple-600 underline">AssistAI</a>.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Conversations Tab */}
                    {activeTab === 'conversations' && (
                        <div>
                            {/* Sync Button */}
                            <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100 flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-purple-900">Sincronizar con Inbox</h4>
                                    <p className="text-xs text-purple-700">Importa todas las conversaciones de WhatsApp/Instagram con mensajes completos.</p>
                                </div>
                                <button
                                    onClick={handleSyncAll}
                                    disabled={syncing}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {syncing ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            Sincronizando...
                                        </>
                                    ) : '🔄 Sincronizar Todo'}
                                </button>
                            </div>
                            {syncResult && (
                                <div className={`mb-4 p-3 rounded-xl text-sm ${syncResult.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    {syncResult}
                                </div>
                            )}

                            {/* Conversations List */}
                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50 text-left">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500">Plataforma</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500">Contacto</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500">UUID</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500">Fecha</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {conversations.map(conv => (
                                            <tr key={conv.uuid} className="border-t border-gray-50 hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold text-white ${conv.channel === 'whatsapp' ? 'bg-green-500' :
                                                        conv.channel === 'instagram' ? 'bg-pink-500' : 'bg-emerald-500'
                                                        }`}>
                                                        {conv.channel === 'whatsapp' ? '📱 WhatsApp' :
                                                            conv.channel === 'instagram' ? '📸 Instagram' : '🤖 Chat'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-800">{conv.title || 'Sin título'}</td>
                                                <td className="px-4 py-3 text-xs text-gray-400 font-mono">{conv.uuid.slice(0, 8)}...</td>
                                                <td className="px-4 py-3 text-xs text-gray-500">{new Date(conv.createdAt).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {conversations.length === 0 && (
                                    <div className="text-center py-10 text-gray-400">
                                        No hay conversaciones recientes.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Agent Detail Modal */}
            {agentModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAgentModalOpen(false)}>
                    <div
                        className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-fadeIn"
                        onClick={e => e.stopPropagation()}
                    >
                        {loadingAgent ? (
                            <div className="text-center py-10">
                                <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-gray-500">Cargando agente...</p>
                            </div>
                        ) : selectedAgent ? (
                            <>
                                {/* Header */}
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                                            {selectedAgent.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-xl text-gray-900">{selectedAgent.name}</h3>
                                            <p className="text-xs text-gray-500">{selectedAgent.model}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setAgentModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                                </div>

                                {/* Description */}
                                <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                                    <h4 className="font-bold text-gray-700 text-sm mb-1">Descripción</h4>
                                    <p className="text-sm text-gray-600">{selectedAgent.description || 'Sin descripción'}</p>
                                </div>

                                {/* Stats */}
                                <div className="mb-6 p-4 bg-purple-50 rounded-xl">
                                    <h4 className="font-bold text-purple-900 text-sm mb-2">📊 Estadísticas</h4>
                                    <p className="text-sm text-purple-700">
                                        <strong>{selectedAgent.stats.totalConversations}</strong> conversaciones manejadas
                                    </p>
                                </div>

                                {/* Local Config */}
                                <div className="mb-6">
                                    <h4 className="font-bold text-gray-700 text-sm mb-3">⚙️ Configuración Local (CRM)</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Nombre personalizado</label>
                                            <input
                                                type="text"
                                                value={editCustomName}
                                                onChange={e => setEditCustomName(e.target.value)}
                                                placeholder={selectedAgent.name}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Notas internas</label>
                                            <textarea
                                                value={editNotes}
                                                onChange={e => setEditNotes(e.target.value)}
                                                placeholder="Añade notas sobre este agente..."
                                                rows={3}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-500 resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Save Error */}
                                {saveError && (
                                    <div className="mb-4 p-2 bg-red-50 text-red-600 rounded-lg text-xs">
                                        ❌ {saveError}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <a
                                        href="https://account.assistai.lat"
                                        target="_blank"
                                        className="flex-1 text-center px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
                                    >
                                        ✏️ Editar en AssistAI
                                    </a>
                                    <button
                                        onClick={saveAgentConfig}
                                        disabled={saving}
                                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
                                    >
                                        {saving ? 'Guardando...' : '💾 Guardar Config'}
                                    </button>
                                </div>
                            </>
                        ) : agentError ? (
                            <div className="text-center py-10">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⚠️</div>
                                <p className="text-red-600 font-bold mb-2">{agentError}</p>
                                <p className="text-gray-500 text-sm mb-4">Puede ser un problema temporal con AssistAI</p>
                                <button
                                    onClick={() => openAgentDetail(currentAgentCode)}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors"
                                >
                                    🔄 Reintentar
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-500">Cargando...</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
