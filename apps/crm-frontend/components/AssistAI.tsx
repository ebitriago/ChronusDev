'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://127.0.0.1:3002';

type Agent = {
    code: string;
    name: string;
    model: string;
    description: string;
    createdAt: string;
};

type Conversation = {
    uuid: string;
    title: string;
    createdAt: string;
};

export default function AssistAI() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'agents' | 'conversations'>('agents');

    // Fetch agents
    useEffect(() => {
        Promise.all([
            fetch(`${API_URL}/assistai/agents`).then(r => r.ok ? r.json() : { data: [] }),
            fetch(`${API_URL}/assistai/conversations`).then(r => r.ok ? r.json() : { data: [] })
        ])
            .then(([agentsData, convsData]) => {
                setAgents(agentsData.data || []);
                setConversations(convsData.data || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    // Sync conversations to Inbox
    const handleSync = async () => {
        setSyncing(true);
        setSyncResult(null);
        try {
            const res = await fetch(`${API_URL}/assistai/sync`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setSyncResult(`✅ Sincronizadas ${data.synced} conversaciones nuevas. Total en Inbox: ${data.total}`);
            } else {
                setSyncResult(`❌ Error: ${data.error}`);
            }
        } catch (err) {
            setSyncResult('❌ Error de conexión');
        } finally {
            setSyncing(false);
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
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Conectado
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
            ) : (
                <>
                    {/* Agents Tab */}
                    {activeTab === 'agents' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {agents.map(agent => (
                                <div key={agent.code} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 font-bold">
                                            {agent.name.charAt(0)}
                                        </div>
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-mono">
                                            {agent.model}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-gray-900 mb-1">{agent.name}</h3>
                                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                                        {agent.description || 'Sin descripción'}
                                    </p>
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
                                    <p className="text-xs text-purple-700">Importa conversaciones de WhatsApp/Instagram a tu bandeja unificada.</p>
                                </div>
                                <button
                                    onClick={handleSync}
                                    disabled={syncing}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
                                >
                                    {syncing ? 'Sincronizando...' : '🔄 Sincronizar'}
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
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500">Contacto</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500">UUID</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500">Fecha</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {conversations.map(conv => (
                                            <tr key={conv.uuid} className="border-t border-gray-50 hover:bg-gray-50">
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
        </div>
    );
}
