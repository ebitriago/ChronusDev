'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

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
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Agent filter
    const [agents, setAgents] = useState<Agent[]>([]);
    const [selectedAgentCode, setSelectedAgentCode] = useState<string>('all');

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

        return () => { newSocket.disconnect(); };
    }, [selectedConversation?.sessionId]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedConversation?.messages]);

    // Select conversation
    const handleSelectConversation = async (conv: Conversation) => {
        setSelectedConversation(conv);
        // Join socket room
        if (socket) socket.emit('join_conversation', conv.sessionId);
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

    // Filter conversations by selected agent
    const filteredConversations = selectedAgentCode === 'all'
        ? conversations
        : conversations.filter(c => c.agentCode === selectedAgentCode);

    return (
        <div className="h-[calc(100vh-140px)] flex bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeIn">
            {/* Left: Conversation List */}
            <div className="w-80 border-r border-gray-100 bg-gray-50/50 flex flex-col">
                <div className="p-4 border-b border-gray-100 bg-white">
                    <h3 className="font-bold text-gray-800">Inbox Unificado</h3>
                    <p className="text-xs text-gray-400">{filteredConversations.length} conversaciones</p>

                    {/* Agent Selector */}
                    {agents.length > 0 && (
                        <select
                            value={selectedAgentCode}
                            onChange={(e) => setSelectedAgentCode(e.target.value)}
                            className="mt-2 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-purple-500"
                        >
                            <option value="all">🤖 Todos los agentes</option>
                            {agents.map(agent => (
                                <option key={agent.code} value={agent.code}>
                                    🤖 {agent.name}
                                </option>
                            ))}
                        </select>
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
                        <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white z-10">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md ${PLATFORM_CONFIG[selectedConversation.platform]?.color}`}>
                                    {PLATFORM_CONFIG[selectedConversation.platform]?.icon}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-sm">{selectedConversation.customerName || selectedConversation.customerContact}</h3>
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                        {PLATFORM_CONFIG[selectedConversation.platform]?.label}
                                    </p>
                                </div>
                            </div>
                            <div className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
                                Session: {selectedConversation.sessionId.slice(0, 12)}...
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
                            {selectedConversation.messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] p-4 rounded-2xl text-sm ${msg.sender === 'agent'
                                        ? 'bg-emerald-500 text-white rounded-br-sm'
                                        : 'bg-white border border-gray-100 shadow-sm text-gray-700 rounded-bl-sm'
                                        }`}>
                                        {msg.content && <p>{msg.content}</p>}
                                        {renderMedia(msg)}
                                        <p className={`text-[10px] mt-1 ${msg.sender === 'agent' ? 'text-emerald-100' : 'text-gray-400'}`}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
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
    );
}
