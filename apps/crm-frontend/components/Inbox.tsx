'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from './Toast';

const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://127.0.0.1:3002';

type ChatMessage = {
    id: string;
    sessionId: string;
    from: string;
    content: string;
    platform: 'assistai' | 'whatsapp' | 'instagram' | 'messenger';
    sender: 'user' | 'agent';
    mediaUrl?: string;
    mediaType?: 'image' | 'audio' | 'document';
    timestamp: string;
};

type Conversation = {
    sessionId: string;
    platform: 'assistai' | 'whatsapp' | 'instagram' | 'messenger';
    customerName?: string;
    customerContact: string;
    agentCode?: string;
    agentName?: string;
    messages: ChatMessage[];
    status: 'active' | 'resolved';
    updatedAt: string;
};

type Agent = {
    code: string;
    name: string;
    model: string;
    description: string;
};

const PLATFORM_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    assistai: { label: 'AssistAI', color: 'bg-emerald-500', icon: '🤖' },
    whatsapp: { label: 'WhatsApp', color: 'bg-green-500', icon: '📱' },
    instagram: { label: 'Instagram', color: 'bg-pink-500', icon: '📸' },
    messenger: { label: 'Messenger', color: 'bg-blue-500', icon: '💬' },
};

// Helper to render media content
function renderMedia(msg: ChatMessage) {
    if (!msg.mediaUrl) return null;

    if (msg.mediaType === 'image') {
        return <img src={msg.mediaUrl} alt="Imagen" className="max-w-full rounded-lg mt-2 cursor-pointer hover:opacity-90" onClick={() => window.open(msg.mediaUrl, '_blank')} />;
    }
    if (msg.mediaType === 'audio') {
        return <audio controls src={msg.mediaUrl} className="mt-2 max-w-full" />;
    }
    if (msg.mediaType === 'document') {
        return (
            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg text-xs text-blue-600 hover:bg-gray-200">
                📎 Ver documento
            </a>
        );
    }
    return null;
}

export default function Inbox() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState<Socket | null>(null);
    const { showToast } = useToast();
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Agent subscription
    const [agents, setAgents] = useState<Agent[]>([]);
    const [subscribedAgents, setSubscribedAgents] = useState<string[]>([]);
    const [showSettings, setShowSettings] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [lastPoll, setLastPoll] = useState<string | null>(null);
    const [newMessageCount, setNewMessageCount] = useState(0);

    // Client matching state
    const [matchedClient, setMatchedClient] = useState<{ id: string; name: string; contacts: any[] } | null>(null);
    const [showCreateClientModal, setShowCreateClientModal] = useState(false);
    const [newClientData, setNewClientData] = useState({
        name: '',
        email: '',
        phone: '',
        company: '',
        notes: ''
    });

    // Load subscribed agents from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('inbox_subscribed_agents');
        if (saved) {
            try {
                setSubscribedAgents(JSON.parse(saved));
            } catch { /* ignore */ }
        }
    }, []);

    // Save subscribed agents to localStorage when changed
    useEffect(() => {
        localStorage.setItem('inbox_subscribed_agents', JSON.stringify(subscribedAgents));
    }, [subscribedAgents]);

    // Fetch conversations and agents
    useEffect(() => {
        Promise.all([
            fetch(`${API_URL}/conversations`).then(r => r.json()),
            fetch(`${API_URL}/assistai/agents`).then(r => r.ok ? r.json() : { data: [] })
        ])
            .then(([convData, agentsData]) => {
                setConversations(convData);
                setAgents(agentsData.data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    // Auto-poll for new messages
    const pollForUpdates = useCallback(async () => {
        try {
            const url = lastPoll
                ? `${API_URL}/assistai/poll?since=${encodeURIComponent(lastPoll)}`
                : `${API_URL}/assistai/poll`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.success) {
                setLastPoll(data.now);
                const totalNew = (data.new?.length || 0) + (data.updated?.length || 0);
                if (totalNew > 0) {
                    setNewMessageCount(prev => prev + totalNew);
                    // Refresh conversations list
                    const convRes = await fetch(`${API_URL}/conversations`);
                    const convData = await convRes.json();
                    setConversations(convData);
                }
            }
        } catch (err) {
            console.error('Poll error:', err);
        }
    }, [lastPoll]);

    // Polling interval (5 seconds for faster real-time updates)
    useEffect(() => {
        const interval = setInterval(pollForUpdates, 5000);
        // Also poll immediately on mount
        pollForUpdates();
        return () => clearInterval(interval);
    }, [pollForUpdates]);

    // Socket connection
    useEffect(() => {
        const newSocket = io(API_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => console.log('🔌 Connected to chat server'));

        newSocket.on('inbox_update', (data: { sessionId: string; message: ChatMessage }) => {
            // Update conversation in list
            setConversations(prev => {
                const updated = [...prev];
                const idx = updated.findIndex(c => c.sessionId === data.sessionId);
                if (idx >= 0) {
                    updated[idx].messages.push(data.message);
                    updated[idx].updatedAt = new Date().toISOString();
                    // Move to top
                    const [conv] = updated.splice(idx, 1);
                    updated.unshift(conv);
                }
                return updated;
            });

            // Update selected if viewing
            if (selectedConversation?.sessionId === data.sessionId) {
                setSelectedConversation(prev => prev ? {
                    ...prev,
                    messages: [...prev.messages, data.message]
                } : null);
            }
        });

        newSocket.on('inbox_refresh', () => {
            // Reload conversations when sync happens
            fetch(`${API_URL}/conversations`).then(r => r.json()).then(setConversations);
        });

        return () => { newSocket.disconnect(); };
    }, [selectedConversation?.sessionId]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedConversation?.messages]);

    // Toggle agent subscription
    const toggleAgentSubscription = (agentCode: string) => {
        setSubscribedAgents(prev =>
            prev.includes(agentCode)
                ? prev.filter(c => c !== agentCode)
                : [...prev, agentCode]
        );
    };

    // Manual sync
    const handleManualSync = async () => {
        setSyncing(true);
        try {
            await fetch(`${API_URL}/assistai/sync-all`, { method: 'POST' });
            const convRes = await fetch(`${API_URL}/conversations`);
            const convData = await convRes.json();
            setConversations(convData);
            setNewMessageCount(0);
        } catch (err) {
            console.error(err);
        } finally {
            setSyncing(false);
        }
    };

    // Check if contact matches a client when selecting conversation
    const fetchClientMatch = async (contactValue: string) => {
        try {
            const res = await fetch(`${API_URL}/contacts/match?value=${encodeURIComponent(contactValue)}`);
            const data = await res.json();
            if (data.matched && data.client) {
                setMatchedClient({ id: data.clientId, name: data.client.name, contacts: [] });
            } else {
                setMatchedClient(null);
            }
        } catch (err) {
            console.error('Error matching client:', err);
            setMatchedClient(null);
        }
    };



    // Create client from chat
    const handleCreateClientFromChat = async () => {
        if (!selectedConversation || !newClientData.name.trim()) return;

        try {
            const res = await fetch(`${API_URL}/clients/from-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newClientData.name,
                    email: newClientData.email,
                    phone: newClientData.phone,
                    company: newClientData.company,
                    notes: newClientData.notes,
                    sessionId: selectedConversation.sessionId,
                    platform: selectedConversation.platform,
                    contactValue: selectedConversation.customerContact
                })
            });

            if (res.ok) {
                const data = await res.json();
                setMatchedClient(data.client);
                setShowCreateClientModal(false);
                setNewClientData({ name: '', email: '', phone: '', company: '', notes: '' });
                showToast('Cliente creado exitosamente', 'success');
            } else {
                showToast('Error al crear cliente', 'error');
            }
        } catch (err) {
            console.error('Error creating client:', err);
            showToast('Error de conexión', 'error');
        }
    };

    // Select conversation
    const handleSelectConversation = async (conv: Conversation) => {
        setSelectedConversation(conv);
        setNewMessageCount(0);
        // Join socket room
        if (socket) socket.emit('join_conversation', conv.sessionId);
        // Check for client match
        if (conv.customerContact) {
            fetchClientMatch(conv.customerContact);
        }
    };

    // Send reply
    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedConversation) return;

        setSending(true);
        try {
            const res = await fetch(`${API_URL}/chat/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: selectedConversation.sessionId,
                    content: replyText.trim()
                })
            });

            if (res.ok) {
                setReplyText('');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
    };

    // Filter conversations by subscribed agents
    const filteredConversations = subscribedAgents.length === 0
        ? conversations
        : conversations.filter(c => subscribedAgents.includes(c.agentCode || ''));

    return (
        <>
            <div className="h-[calc(100vh-140px)] flex bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeIn">
                {/* Left: Conversation List */}
                <div className="w-80 border-r border-gray-100 bg-gray-50/50 flex flex-col">
                    <div className="p-4 border-b border-gray-100 bg-white">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-gray-800">Inbox Unificado</h3>
                            <div className="flex items-center gap-2">
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
                            </div>
                        </div>
                        <p className="text-xs text-gray-400">{filteredConversations.length} conversaciones</p>

                        {/* Sync Button */}
                        <button
                            onClick={handleManualSync}
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
                                                onChange={() => toggleAgentSubscription(agent.code)}
                                                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                            />
                                            <span className="text-xs text-gray-700">{agent.name}</span>
                                        </label>
                                    ))}
                                </div>
                                {subscribedAgents.length > 0 && (
                                    <button
                                        onClick={() => setSubscribedAgents([])}
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
                                    onClick={() => handleSelectConversation(conv)}
                                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-white transition-colors ${selectedConversation?.sessionId === conv.sessionId ? 'bg-white border-l-4 border-l-emerald-500' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-sm text-gray-800">{conv.customerName || conv.customerContact}</span>
                                        <div className="flex items-center gap-1">
                                            <div className={`w-2 h-2 rounded-full ${PLATFORM_CONFIG[conv.platform]?.color || 'bg-gray-400'}`} title={conv.platform}></div>
                                        </div>
                                    </div>
                                    {/* Agent Badge */}
                                    {conv.agentName && (
                                        <p className="text-[10px] text-purple-600 font-bold mb-1">🤖 {conv.agentName}</p>
                                    )}
                                    <p className="text-xs text-gray-500 line-clamp-1">
                                        {conv.messages[conv.messages.length - 1]?.content || 'Sin mensajes'}
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
                    </div>
                </div>

                {/* Middle: Chat Area */}
                <div className="flex-1 flex flex-col bg-white relative">
                    {selectedConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="h-20 border-b border-gray-100 flex items-center justify-between px-6 bg-white z-10">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md ${PLATFORM_CONFIG[selectedConversation.platform]?.color}`}>
                                        {PLATFORM_CONFIG[selectedConversation.platform]?.icon}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">{selectedConversation.customerName || selectedConversation.customerContact}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${PLATFORM_CONFIG[selectedConversation.platform]?.color}`}>
                                                {PLATFORM_CONFIG[selectedConversation.platform]?.icon} {PLATFORM_CONFIG[selectedConversation.platform]?.label}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {selectedConversation.customerContact}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Client Info or Create Button */}
                                <div className="flex items-center gap-3">
                                    {matchedClient ? (
                                        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                                            <span className="text-lg">👤</span>
                                            <div>
                                                <p className="text-xs font-bold text-emerald-700">{matchedClient.name}</p>
                                                <a
                                                    href={`#client-${matchedClient.id}`}
                                                    className="text-[10px] text-emerald-600 hover:underline"
                                                >
                                                    Ver Cliente 360°
                                                </a>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowCreateClientModal(true)}
                                            className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-xl border border-amber-200 transition-colors"
                                        >
                                            <span className="text-lg">➕</span>
                                            <div className="text-left">
                                                <p className="text-xs font-bold text-amber-700">Crear Cliente</p>
                                                <p className="text-[10px] text-amber-500">Nuevo contacto</p>
                                            </div>
                                        </button>
                                    )}

                                    {/* Agent Info */}
                                    {selectedConversation.agentName && (
                                        <div className="flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-xl border border-purple-100">
                                            <span className="text-lg">🤖</span>
                                            <div>
                                                <p className="text-xs font-bold text-purple-700">{selectedConversation.agentName}</p>
                                                <p className="text-[10px] text-purple-500">Agente AssistAI</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
                                {selectedConversation.messages.map((msg) => (
                                    <div key={msg.id} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] ${msg.sender === 'agent' ? '' : ''}`}>
                                            {/* Sender info for user messages */}
                                            {msg.sender === 'user' && (
                                                <div className="flex items-center gap-2 mb-1 ml-1">
                                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white ${PLATFORM_CONFIG[msg.platform]?.color || 'bg-gray-400'}`}>
                                                        {PLATFORM_CONFIG[msg.platform]?.icon}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 font-medium">{msg.from}</span>
                                                </div>
                                            )}
                                            {/* Agent name for bot messages */}
                                            {msg.sender === 'agent' && msg.from !== 'Support Agent' && (
                                                <div className="flex items-center justify-end gap-2 mb-1 mr-1">
                                                    <span className="text-[10px] text-purple-600 font-bold">🤖 {msg.from}</span>
                                                </div>
                                            )}
                                            <div className={`p-4 rounded-2xl text-sm ${msg.sender === 'agent'
                                                ? 'bg-emerald-500 text-white rounded-br-sm'
                                                : 'bg-white border border-gray-100 shadow-sm text-gray-700 rounded-bl-sm'
                                                }`}>
                                                {msg.content && <p>{msg.content}</p>}
                                                {renderMedia(msg)}
                                                <div className={`flex items-center gap-2 mt-1 ${msg.sender === 'agent' ? 'justify-end' : ''}`}>
                                                    <span className={`text-[10px] ${msg.sender === 'agent' ? 'text-emerald-100' : 'text-gray-400'}`}>
                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Reply Input */}
                            <div className="p-4 border-t border-gray-100 bg-white">
                                <div className="flex gap-2 items-center">
                                    {/* Attachment Button */}
                                    <button
                                        title="Adjuntar archivo"
                                        className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors"
                                        onClick={() => {
                                            // TODO: Implement file upload
                                            alert('Próximamente: Subida de archivos. Por ahora, usa URLs de imágenes.');
                                        }}
                                    >
                                        📎
                                    </button>
                                    <input
                                        type="text"
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendReply()}
                                        placeholder="Escribe tu respuesta..."
                                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                        disabled={sending}
                                    />
                                    <button
                                        onClick={handleSendReply}
                                        disabled={sending || !replyText.trim()}
                                        className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                                    >
                                        {sending ? '...' : 'Enviar'}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-3xl">💬</div>
                            <p className="font-medium">Selecciona una conversación</p>
                            <p className="text-sm mt-1">Gestiona todos tus canales en un solo lugar</p>
                        </div>
                    )}
                </div>

                {/* Right: Context Panel */}
                <div className="w-72 border-l border-gray-100 bg-white p-6 hidden xl:flex flex-col">
                    {selectedConversation ? (
                        <>
                            <div className="text-center mb-6">
                                <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl text-white shadow-lg ${PLATFORM_CONFIG[selectedConversation.platform]?.color}`}>
                                    {selectedConversation.customerName?.charAt(0) || '?'}
                                </div>
                                <h3 className="font-bold text-gray-900">{selectedConversation.customerName || 'Visitante'}</h3>
                                <p className="text-xs text-gray-500">{selectedConversation.customerContact}</p>
                            </div>

                            <div className="space-y-3">
                                <div className="p-3 bg-gray-50 rounded-xl">
                                    <h4 className="font-bold text-gray-800 text-xs mb-1">Canal</h4>
                                    <p className="text-sm text-gray-600">{PLATFORM_CONFIG[selectedConversation.platform]?.label}</p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl">
                                    <h4 className="font-bold text-gray-800 text-xs mb-1">Mensajes</h4>
                                    <p className="text-sm text-gray-600">{selectedConversation.messages.length}</p>
                                </div>
                                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                    <h4 className="font-bold text-blue-800 text-xs mb-1">Acciones</h4>
                                    <button className="mt-2 text-xs bg-white text-blue-600 px-3 py-1.5 rounded border border-blue-200 font-bold w-full hover:bg-blue-50 transition-colors">
                                        + Crear Lead
                                    </button>
                                    <button className="mt-2 text-xs bg-white text-orange-600 px-3 py-1.5 rounded border border-orange-200 font-bold w-full hover:bg-orange-50 transition-colors">
                                        + Crear Ticket
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-300">
                            <p className="text-sm">Sin contexto</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Client Modal */}
            {
                showCreateClientModal && selectedConversation && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCreateClientModal(false)}>
                        <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-fadeIn" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <span>👤</span> Crear Cliente desde Chat
                                </h3>
                                <button onClick={() => setShowCreateClientModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                            </div>

                            <div className="mb-6 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3">
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm text-white ${PLATFORM_CONFIG[selectedConversation.platform]?.color || 'bg-gray-500'}`}>
                                    {PLATFORM_CONFIG[selectedConversation.platform]?.icon}
                                </span>
                                <div>
                                    <p className="text-xs text-blue-600 font-bold uppercase">Contacto Vinculado</p>
                                    <p className="font-mono text-sm text-gray-900 font-medium">{selectedConversation.customerContact}</p>
                                </div>
                            </div>

                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={newClientData.name}
                                        onChange={e => setNewClientData({ ...newClientData, name: e.target.value })}
                                        className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                        placeholder="Ej: Juan Pérez"
                                        autoFocus
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={newClientData.email}
                                            onChange={e => setNewClientData({ ...newClientData, email: e.target.value })}
                                            className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="juan@empresa.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Teléfono (Opcional)</label>
                                        <input
                                            type="tel"
                                            value={newClientData.phone}
                                            onChange={e => setNewClientData({ ...newClientData, phone: e.target.value })}
                                            className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="+58..."
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empresa</label>
                                    <input
                                        type="text"
                                        value={newClientData.company}
                                        onChange={e => setNewClientData({ ...newClientData, company: e.target.value })}
                                        className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                        placeholder="Nombre de la empresa..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notas Iniciales</label>
                                    <textarea
                                        value={newClientData.notes}
                                        onChange={e => setNewClientData({ ...newClientData, notes: e.target.value })}
                                        className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none h-20 resize-none"
                                        placeholder="Detalles importantes del cliente..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={handleCreateClientFromChat}
                                    disabled={!newClientData.name.trim()}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
                                >
                                    Guardar Cliente
                                </button>
                                <button
                                    onClick={() => setShowCreateClientModal(false)}
                                    className="px-6 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
        </>
    );
}
