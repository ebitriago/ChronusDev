'use client';

import { useState } from 'react';
import { Conversation, Agent, PLATFORM_CONFIG } from './types';

type ConversationListProps = {
    conversations: Conversation[];
    selectedConversation: Conversation | null;
    onSelectConversation: (conv: Conversation) => void;
    loading: boolean;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    agents: Agent[];
    subscribedAgents: string[];
    onToggleAgent: (code: string) => void;
    syncing: boolean;
    onSync: () => void;
    newMessageCount: number;
    hasMore: boolean;
    onLoadMore: () => void;
    onNewChat: () => void;
};

export default function ConversationList({
    conversations,
    selectedConversation,
    onSelectConversation,
    loading,
    searchTerm,
    onSearchChange,
    agents,
    subscribedAgents,
    onToggleAgent,
    syncing,
    onSync,
    newMessageCount,
    hasMore,
    onLoadMore,
    onNewChat
}: ConversationListProps) {
    const [showSettings, setShowSettings] = useState(false);

    // Filter conversations
    const filteredConversations = conversations.filter(c => {
        if (subscribedAgents.length > 0 && !subscribedAgents.includes(c.agentCode || '')) {
            return false;
        }
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            const matchesName = c.customerName?.toLowerCase().includes(term);
            const matchesContact = c.customerContact?.toLowerCase().includes(term);
            const matchesAgent = c.agentName?.toLowerCase().includes(term);
            const matchesMessage = c.messages.some(m => m.content.toLowerCase().includes(term));
            return matchesName || matchesContact || matchesAgent || matchesMessage;
        }
        return true;
    });

    return (
        <div className="w-full md:w-80 border-r border-gray-100 bg-gray-50/50 flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-white">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-800">Inbox Unificado</h3>
                    <div className="flex items-center gap-2">
                        {/* Search Input */}
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => onSearchChange(e.target.value)}
                                placeholder="Buscar..."
                                className="w-32 sm:w-40 pl-7 pr-6 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            />
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                            {searchTerm && (
                                <button
                                    onClick={() => onSearchChange('')}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        {newMessageCount > 0 && (
                            <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-[10px] font-bold animate-pulse">
                                {newMessageCount} nuevo{newMessageCount > 1 ? 's' : ''}
                            </span>
                        )}
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            title="Configurar agentes"
                        >
                            ⚙️
                        </button>
                        <button
                            onClick={onNewChat}
                            className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors"
                            title="Nuevo Chat"
                        >
                            ➕
                        </button>
                    </div>
                </div>
                <p className="text-xs text-gray-400">{filteredConversations.length} conversaciones</p>

                {/* Sync Button */}
                <button
                    onClick={onSync}
                    disabled={syncing}
                    className="mt-2 w-full px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {syncing ? (
                        <>
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            Sincronizando...
                        </>
                    ) : '🔄 Sincronizar AssistAI'}
                </button>

                {/* Copy Widget Link Button */}
                <button
                    onClick={async () => {
                        // Get organization ID from logged user
                        const userStr = localStorage.getItem('crm_user');
                        let orgId = 'default';
                        if (userStr) {
                            try {
                                const user = JSON.parse(userStr);
                                orgId = user.organizationId || user.organization?.id || 'default';
                            } catch { }
                        }
                        const baseUrl = window.location.origin.replace('3003', '3002');
                        const chatUrl = `${baseUrl}/chat.html?org=${orgId}`;
                        try {
                            await navigator.clipboard.writeText(chatUrl);
                            alert('✅ Enlace copiado: ' + chatUrl);
                        } catch {
                            prompt('Copia este enlace:', chatUrl);
                        }
                    }}
                    className="mt-2 w-full px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg text-xs font-bold hover:from-indigo-600 hover:to-purple-700 transition-colors flex items-center justify-center gap-2"
                    title="Copiar enlace del widget de chat"
                >
                    🔗 Copiar Enlace Chat Web
                </button>

                {/* Settings Panel */}
                {showSettings && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <h4 className="text-xs font-bold text-gray-700 mb-2">🤖 Agentes a monitorear</h4>
                        <p className="text-[10px] text-gray-500 mb-2">
                            {subscribedAgents.length === 0 ? 'Todos los agentes' : `${subscribedAgents.length} seleccionado(s)`}
                        </p>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                            {agents.map(agent => (
                                <label
                                    key={agent.code}
                                    className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-100 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={subscribedAgents.includes(agent.code)}
                                        onChange={() => onToggleAgent(agent.code)}
                                        className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                    />
                                    <span className="text-xs text-gray-700">{agent.name}</span>
                                </label>
                            ))}
                        </div>
                        {subscribedAgents.length > 0 && (
                            <button
                                onClick={() => agents.forEach(a => onToggleAgent(a.code))}
                                className="mt-2 w-full text-[10px] text-purple-600 hover:text-purple-700 font-bold"
                            >
                                Limpiar selección (ver todos)
                            </button>
                        )}
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center text-gray-400 text-sm">Cargando...</div>
                ) : (
                    filteredConversations.map(conv => (
                        <div
                            key={conv.sessionId}
                            onClick={() => onSelectConversation(conv)}
                            className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-white transition-colors ${selectedConversation?.sessionId === conv.sessionId ? 'bg-white border-l-4 border-l-emerald-500' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-sm text-gray-800">{conv.customerName || conv.customerContact}</span>
                                <div className="flex items-center gap-1">
                                    <div className={`w-2 h-2 rounded-full ${PLATFORM_CONFIG[conv.platform]?.color || 'bg-gray-400'}`} title={conv.platform}></div>
                                </div>
                            </div>
                            {conv.agentName && (
                                <p className="text-[10px] text-purple-600 font-bold mb-1">🤖 {conv.agentName}</p>
                            )}
                            <p className="text-xs text-gray-500 line-clamp-1">
                                {conv.messages?.slice(-1)[0]?.content || 'Sin mensajes'}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${PLATFORM_CONFIG[conv.platform]?.color} text-white`}>
                                    {PLATFORM_CONFIG[conv.platform]?.icon} {PLATFORM_CONFIG[conv.platform]?.label}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                    {new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))
                )}
                {hasMore && !loading && !searchTerm && (
                    <div className="p-4 text-center">
                        <button
                            onClick={onLoadMore}
                            className="text-xs text-purple-600 hover:text-purple-800 font-bold hover:underline"
                        >
                            Cargar más conversaciones
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
