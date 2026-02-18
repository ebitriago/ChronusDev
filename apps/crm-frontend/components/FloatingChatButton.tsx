'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL, getHeaders } from '../app/api';
import { playNotificationSound } from '../utils/notifications';

type ChatMessage = {
    id: string;
    sessionId: string;
    from: string;
    content: string;
    platform: string;
    sender: 'user' | 'agent';
    timestamp: string;
    status?: string;
    mediaUrl?: string;
    mediaType?: string;
};

type Conversation = {
    sessionId: string;
    platform: string;
    customerName: string;
    customerContact: string;
    agentName?: string;
    status: string;
    updatedAt: string;
    messages: ChatMessage[];
    unreadCount?: number;
};

const PLATFORM_ICONS: Record<string, string> = {
    web: '🌐',
    whatsapp: '📱',
    assistai: '🤖',
    instagram: '📸',
    messenger: '💬',
};

const PLATFORM_COLORS: Record<string, string> = {
    web: 'bg-purple-500',
    whatsapp: 'bg-green-500',
    assistai: 'bg-blue-500',
    instagram: 'bg-pink-500',
    messenger: 'bg-indigo-500',
};

/**
 * FloatingChatButton - Functional quick-access chat widget
 * Shows recent conversations, allows inline chat & quick replies from ANY page
 */
export default function FloatingChatButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
    const [replyText, setReplyText] = useState('');
    const [socket, setSocket] = useState<Socket | null>(null);
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(false);
    const [unreadSessions, setUnreadSessions] = useState<Set<string>>(new Set());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedConv?.messages]);

    // Focus input when selecting a conversation
    useEffect(() => {
        if (selectedConv) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [selectedConv]);

    // Fetch conversations
    const fetchConversations = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/conversations`, { headers: getHeaders() });
            if (res.ok) {
                const data: Conversation[] = await res.json();
                // Sort by last message time, only show active/recent
                const sorted = data
                    .filter((c: Conversation) => c.messages && c.messages.length > 0)
                    .sort((a: Conversation, b: Conversation) => {
                        const aLast = a.messages[a.messages.length - 1]?.timestamp || a.updatedAt;
                        const bLast = b.messages[b.messages.length - 1]?.timestamp || b.updatedAt;
                        return new Date(bLast).getTime() - new Date(aLast).getTime();
                    })
                    .slice(0, 15); // Show top 15

                setConversations(sorted);

                // If we have a selected conversation, update it
                if (selectedConv) {
                    const updated = sorted.find(c => c.sessionId === selectedConv.sessionId);
                    if (updated) setSelectedConv(updated);
                }
            }
        } catch (err) {
            console.error('Error fetching conversations:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedConv]);

    // Fetch on open
    useEffect(() => {
        if (isOpen) {
            fetchConversations();
        }
    }, [isOpen]);

    // Socket.IO connection for real-time updates
    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : null;
        if (!token) return;

        const socketUrl = API_URL.replace('/api', '') || '';
        const newSocket = io(socketUrl, {
            path: '/socket.io',
            auth: { token },
            transports: ['websocket', 'polling']
        });

        newSocket.on('connect', () => {
            console.log('🔌 QuickChat connected');
        });

        newSocket.on('inbox_update', (data: { sessionId: string; message: ChatMessage }) => {
            if (data.message.sender === 'user') {
                playNotificationSound('message');

                // Mark session as unread
                setUnreadSessions(prev => new Set(prev).add(data.sessionId));

                // Update conversation list with new message
                setConversations(prev => {
                    const idx = prev.findIndex(c => c.sessionId === data.sessionId);
                    if (idx >= 0) {
                        const updated = [...prev];
                        updated[idx] = {
                            ...updated[idx],
                            messages: [...updated[idx].messages, data.message]
                        };
                        // Move to top
                        const [moved] = updated.splice(idx, 1);
                        updated.unshift(moved);
                        return updated;
                    }
                    // New conversation - add to top
                    return [{
                        sessionId: data.sessionId,
                        platform: data.message.platform || 'web',
                        customerName: data.message.from || 'Usuario',
                        customerContact: '',
                        status: 'ACTIVE',
                        updatedAt: data.message.timestamp,
                        messages: [data.message]
                    }, ...prev];
                });

                // Update selected conversation if viewing it
                setSelectedConv(prev => {
                    if (prev && prev.sessionId === data.sessionId) {
                        return {
                            ...prev,
                            messages: [...prev.messages, data.message]
                        };
                    }
                    return prev;
                });
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, []);

    // Send reply
    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedConv) return;

        setSending(true);
        try {
            const res = await fetch(`${API_URL}/chat/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify({
                    sessionId: selectedConv.sessionId,
                    content: replyText.trim()
                })
            });

            if (res.ok) {
                // Optimistic update: add agent message locally
                const newMsg: ChatMessage = {
                    id: `temp-${Date.now()}`,
                    sessionId: selectedConv.sessionId,
                    from: 'Tú',
                    content: replyText.trim(),
                    platform: selectedConv.platform,
                    sender: 'agent',
                    timestamp: new Date().toISOString(),
                    status: 'sent'
                };

                setSelectedConv(prev => prev ? {
                    ...prev,
                    messages: [...prev.messages, newMsg]
                } : null);

                // Update in conversation list too
                setConversations(prev => prev.map(c =>
                    c.sessionId === selectedConv.sessionId
                        ? { ...c, messages: [...c.messages, newMsg] }
                        : c
                ));

                setReplyText('');
                inputRef.current?.focus();
            }
        } catch (err) {
            console.error('Error sending reply:', err);
        } finally {
            setSending(false);
        }
    };

    // Select conversation & mark as read
    const handleSelectConv = (conv: Conversation) => {
        setSelectedConv(conv);
        setUnreadSessions(prev => {
            const next = new Set(prev);
            next.delete(conv.sessionId);
            return next;
        });
    };

    const unreadCount = unreadSessions.size;

    // Get last message for a conversation
    const getLastMessage = (conv: Conversation) => {
        if (conv.messages.length === 0) return { content: 'Sin mensajes', time: '' };
        const last = conv.messages[conv.messages.length - 1];
        return {
            content: last.content || '📎 Archivo adjunto',
            time: new Date(last.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isAgent: last.sender === 'agent'
        };
    };

    // Format relative time
    const formatTime = (ts: string) => {
        const now = new Date();
        const date = new Date(ts);
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'ahora';
        if (diffMins < 60) return `${diffMins}m`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h`;
        return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    };

    // Don't render if not authenticated
    if (typeof window !== 'undefined' && !localStorage.getItem('crm_token')) {
        return null;
    }

    return (
        <div className="fixed bottom-6 right-6 z-[9999]">
            {/* Chat Panel */}
            {isOpen && (
                <div className="absolute bottom-16 right-0 w-[360px] h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200/60 overflow-hidden flex flex-col animate-slideUp"
                    style={{ boxShadow: '0 25px 60px -12px rgba(0,0,0,0.25)' }}>

                    {/* Header */}
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
                        {selectedConv ? (
                            <>
                                <div className="flex items-center gap-2 min-w-0">
                                    <button
                                        onClick={() => setSelectedConv(null)}
                                        className="p-1 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                                        title="Volver"
                                    >
                                        ←
                                    </button>
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${PLATFORM_COLORS[selectedConv.platform] || 'bg-gray-500'} flex-shrink-0`}>
                                        {PLATFORM_ICONS[selectedConv.platform] || '💬'}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-sm truncate">{selectedConv.customerName}</h3>
                                        <p className="text-[10px] opacity-80 truncate">{selectedConv.platform.toUpperCase()}</p>
                                    </div>
                                </div>
                                <a
                                    href="/inbox"
                                    className="text-[10px] bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-colors flex-shrink-0"
                                    title="Abrir en Inbox completo"
                                >
                                    Expandir ↗
                                </a>
                            </>
                        ) : (
                            <>
                                <div>
                                    <h3 className="font-bold text-sm">💬 Mensajes Rápidos</h3>
                                    <p className="text-[10px] opacity-80">
                                        {conversations.length} conversaciones • {unreadCount} nuevos
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={fetchConversations}
                                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-sm"
                                        title="Actualizar"
                                    >
                                        🔄
                                    </button>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-lg leading-none"
                                    >
                                        ×
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Content */}
                    {selectedConv ? (
                        /* ========== Chat View ========== */
                        <>
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
                                {selectedConv.messages.slice(-30).map((msg) => (
                                    <div key={msg.id} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${msg.sender === 'agent'
                                            ? 'bg-emerald-500 text-white rounded-br-sm'
                                            : 'bg-white border border-gray-100 shadow-sm text-gray-700 rounded-bl-sm'
                                            }`}>
                                            {msg.content && <p className="break-words">{msg.content}</p>}
                                            {msg.mediaUrl && (
                                                <p className="text-[10px] opacity-80 mt-1">📎 Archivo adjunto</p>
                                            )}
                                            <p className={`text-[9px] mt-1 ${msg.sender === 'agent' ? 'text-emerald-100' : 'text-gray-400'}`}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {msg.sender === 'agent' && (
                                                    <span className="ml-1">
                                                        {msg.status === 'read' || msg.status === 'delivered' ? '✓✓' : '✓'}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Reply Input */}
                            <div className="p-2 border-t border-gray-100 bg-white flex-shrink-0">
                                <div className="flex gap-1.5">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendReply()}
                                        placeholder="Escribe una respuesta..."
                                        className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 bg-gray-50"
                                        disabled={sending}
                                    />
                                    <button
                                        onClick={handleSendReply}
                                        disabled={sending || !replyText.trim()}
                                        className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 disabled:opacity-40 transition-colors shadow-sm"
                                    >
                                        {sending ? (
                                            <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                        ) : '➤'}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* ========== Conversation List ========== */
                        <>
                            <div className="flex-1 overflow-y-auto">
                                {loading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="text-center">
                                            <span className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                            <p className="text-xs text-gray-400 mt-2">Cargando...</p>
                                        </div>
                                    </div>
                                ) : conversations.length === 0 ? (
                                    <div className="flex items-center justify-center h-full p-6">
                                        <div className="text-center text-gray-400">
                                            <p className="text-3xl mb-2">💬</p>
                                            <p className="text-sm font-medium">Sin conversaciones</p>
                                            <p className="text-xs mt-1">Los mensajes aparecerán aquí</p>
                                        </div>
                                    </div>
                                ) : (
                                    conversations.map((conv) => {
                                        const last = getLastMessage(conv);
                                        const isUnread = unreadSessions.has(conv.sessionId);
                                        const lastMsgTime = conv.messages[conv.messages.length - 1]?.timestamp || conv.updatedAt;

                                        return (
                                            <div
                                                key={conv.sessionId}
                                                onClick={() => handleSelectConv(conv)}
                                                className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-all border-b border-gray-50 ${isUnread
                                                    ? 'bg-emerald-50/80 hover:bg-emerald-50'
                                                    : 'hover:bg-gray-50'
                                                    }`}
                                            >
                                                {/* Platform Avatar */}
                                                <div className="relative flex-shrink-0">
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm text-white shadow-sm ${PLATFORM_COLORS[conv.platform] || 'bg-gray-400'}`}>
                                                        {PLATFORM_ICONS[conv.platform] || '💬'}
                                                    </div>
                                                    {isUnread && (
                                                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
                                                    )}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className={`text-xs truncate ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                                            {conv.customerName || conv.customerContact}
                                                        </span>
                                                        <span className={`text-[10px] flex-shrink-0 ${isUnread ? 'text-emerald-600 font-bold' : 'text-gray-400'}`}>
                                                            {formatTime(lastMsgTime)}
                                                        </span>
                                                    </div>
                                                    <p className={`text-[11px] truncate mt-0.5 ${isUnread ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                                                        {last.isAgent && <span className="text-emerald-500">Tú: </span>}
                                                        {last.content}
                                                    </p>
                                                </div>

                                                {/* Unread badge */}
                                                {isUnread && (
                                                    <div className="flex-shrink-0 mt-1">
                                                        <span className="w-5 h-5 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                                            •
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Footer: Link to full inbox */}
                            <a
                                href="/inbox"
                                className="block p-2.5 text-center text-xs font-medium text-emerald-600 hover:bg-emerald-50 border-t border-gray-100 transition-colors flex-shrink-0"
                            >
                                📥 Ver Inbox Completo →
                            </a>
                        </>
                    )}
                </div>
            )}

            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 ${isOpen
                    ? 'bg-gradient-to-r from-gray-700 to-gray-800 rotate-0'
                    : unreadCount > 0
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                        : 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-emerald-500 hover:to-teal-500'
                    }`}
                style={unreadCount > 0 && !isOpen ? {
                    boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.3), 0 10px 25px -5px rgba(0,0,0,0.2)'
                } : {
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)'
                }}
            >
                <span className="text-2xl text-white transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}>
                    {isOpen ? '✕' : '💬'}
                </span>
                {unreadCount > 0 && !isOpen && (
                    <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md animate-bounce">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            <style jsx>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-slideUp {
                    animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                }
            `}</style>
        </div>
    );
}
