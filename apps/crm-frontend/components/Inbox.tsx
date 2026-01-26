'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from './Toast';
import ClientProfile from './ClientProfile';

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
    status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
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
    const lastPollRef = useRef<string | null>(null);
    const [newMessageCount, setNewMessageCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

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

    // Link to existing client state
    const [showLinkClientModal, setShowLinkClientModal] = useState(false);
    const [clientSearchTerm, setClientSearchTerm] = useState('');

    // New Chat State
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [newChatPhone, setNewChatPhone] = useState('');
    const [newChatPlatform, setNewChatPlatform] = useState<'assistai' | 'whatsapp'>('assistai');
    const [initiatingChat, setInitiatingChat] = useState(false);
    const [clientSearchResults, setClientSearchResults] = useState<{ id: string; name: string; email: string }[]>([]);
    const [allClients, setAllClients] = useState<{ id: string; name: string; email: string }[]>([]);

    // Client 360 View state
    const [show360View, setShow360View] = useState(false);

    // Takeover state (hybrid AI/human control)
    const [takeoverStatus, setTakeoverStatus] = useState<{
        active: boolean;
        takenBy?: string;
        remainingMinutes?: number;
        expiresAt?: string;
    } | null>(null);
    const [takingOver, setTakingOver] = useState(false);

    // AI Suggestions state
    const [aiSuggestions, setAiSuggestions] = useState<{ text: string; tone: string }[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    // AI Smart Compose State
    const [showAiMenu, setShowAiMenu] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    const handleAiAction = async (task: 'rewrite' | 'grammar' | 'tone_formal' | 'tone_friendly' | 'expand' | 'translate_en') => {
        if (!replyText.trim()) {
            showToast('Escribe algo primero para que la IA lo procese', 'error');
            return;
        }

        setAiLoading(true);
        setShowAiMenu(false);

        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/ai/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                } as HeadersInit,
                body: JSON.stringify({
                    prompt: replyText,
                    task: task,
                    context: `Customer: ${selectedConversation?.customerName || 'User'}. Latest message: ${selectedConversation?.messages[selectedConversation.messages.length - 1]?.content || ''}`
                })
            });

            const data = await res.json();
            if (res.ok && data.result) {
                setReplyText(data.result);
                showToast('Texto actualizado por IA', 'success');
            } else if (res.status === 429) {
                showToast(data.error || 'Cuota de IA excedida. Espera un momento.', 'error');
            } else {
                showToast(data.error || 'Error al procesar con IA', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Error de conexión con IA', 'error');
        } finally {
            setAiLoading(false);
        }
    };

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

    // Helper for auth headers
    function getAuthHeaders() {
        const token = localStorage.getItem('crm_token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    // Fetch conversations and agents
    useEffect(() => {
        const token = localStorage.getItem('crm_token');
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

        Promise.all([
            fetch(`${API_URL}/conversations`, { headers }).then(r => r.ok ? r.json() : []),
            fetch(`${API_URL}/assistai/agents`, { headers }).then(r => r.ok ? r.json() : { data: [] }),
            fetch(`${API_URL}/clients`, { headers }).then(r => r.ok ? r.json() : [])
        ])
            .then(([convData, agentsData, clientsData]) => {
                // Ensure convData is array
                if (Array.isArray(convData)) {
                    setConversations(convData);
                } else {
                    console.error('Conversations format invalid:', convData);
                    setConversations([]);
                }
                setAgents(agentsData.data || []);
                setAllClients(Array.isArray(clientsData) ? clientsData : []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setConversations([]); // Fallback
                setLoading(false);
            });
    }, []);

    // Auto-poll for new messages
    const pollForUpdates = useCallback(async () => {
        const headers = getAuthHeaders();
        try {
            const url = lastPollRef.current
                ? `${API_URL}/assistai/poll?since=${encodeURIComponent(lastPollRef.current)}`
                : `${API_URL}/assistai/poll`;

            const res = await fetch(url, { headers });
            const data = await res.json();

            if (data.success) {
                lastPollRef.current = data.now;
                const totalNew = (data.new?.length || 0) + (data.updated?.length || 0);
                if (totalNew > 0) {
                    setNewMessageCount(prev => prev + totalNew);
                    // Refresh conversations list
                    const convRes = await fetch(`${API_URL}/conversations`, { headers: headers as any });
                    if (convRes.ok) {
                        const convData = await convRes.json();
                        if (Array.isArray(convData)) setConversations(convData);
                    }
                }
            }
        } catch (err: any) {
            // Suppress noisy network errors 
            if (err?.message?.includes('Failed to fetch')) {
                // Silent
            } else {
                console.warn('Poll issue:', err?.message || err);
            }
        }
    }, []);

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

        newSocket.on('inbox_update', async (data: { sessionId: string; message: ChatMessage }) => {
            // Update conversation in list
            setConversations(prev => {
                const updated = [...prev];
                const idx = updated.findIndex(c => c.sessionId === data.sessionId);

                if (idx >= 0) {
                    // Update existing
                    updated[idx].messages.push(data.message);
                    updated[idx].updatedAt = new Date().toISOString();
                    // Move to top
                    const [conv] = updated.splice(idx, 1);
                    updated.unshift(conv);
                    return updated;
                } else {
                    // New conversation, we need to fetch it if we don't have it
                    // We can't do async inside setState updater properly, so we return prev
                    // and trigger a fetch outside
                    return prev;
                }
            });

            // Handle new conversation fetching outside state updater
            setConversations(prev => {
                const exists = prev.some(c => c.sessionId === data.sessionId);
                if (!exists) {
                    // Fetch generic info for this conversation
                    // Since we don't have a single conversation fetch endpoint yet that returns one conv fully formatted
                    // we will trigger a quick refresh of the list or implement a fetch

                    // Option A: Just trigger poll immediately
                    pollForUpdates();
                    return prev;
                }
                return prev;
            });

            // Update selected if viewing
            if (selectedConversation?.sessionId === data.sessionId) {
                setSelectedConversation(prev => {
                    if (!prev) return null;
                    // Check if message already exists by ID or similar content/timestamp to avoid duplication
                    // Relaxed window to 60s to account for latency
                    const exists = prev.messages.some(m =>
                        m.id === data.message.id ||
                        (m.content === data.message.content &&
                            Math.abs(new Date(m.timestamp).getTime() - new Date(data.message.timestamp).getTime()) < 60000)
                    );

                    if (exists) return prev;

                    return {
                        ...prev,
                        messages: [...prev.messages, data.message]
                    };
                });
            }
        });

        newSocket.on('inbox_refresh', () => {
            // Reload conversations when sync happens
            const headers = getAuthHeaders() as any;
            fetch(`${API_URL}/conversations`, { headers }).then(r => r.ok ? r.json() : []).then(data => {
                if (Array.isArray(data)) setConversations(data);
            });
        });

        // Takeover events
        newSocket.on('takeover_started', ({ sessionId: sid, takeover }) => {
            if (selectedConversation?.sessionId === sid) {
                setTakeoverStatus({
                    active: true,
                    takenBy: takeover.takenBy,
                    remainingMinutes: Math.round((new Date(takeover.expiresAt).getTime() - Date.now()) / 60000),
                    expiresAt: takeover.expiresAt
                });
            }
        });

        newSocket.on('takeover_ended', ({ sessionId: sid }) => {
            if (selectedConversation?.sessionId === sid) {
                setTakeoverStatus({ active: false });
            }
        });

        return () => { newSocket.disconnect(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const headers = getAuthHeaders() as any;
        try {
            await fetch(`${API_URL}/assistai/sync-all`, { method: 'POST', headers });
            const convRes = await fetch(`${API_URL}/conversations`, { headers });
            if (convRes.ok) {
                const convData = await convRes.json();
                if (Array.isArray(convData)) {
                    setConversations(convData);
                    setNewMessageCount(0);
                }
            }
        } catch (err) {
            console.error('Sync failed', err);
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
        console.log('[DEBUG] handleCreateClientFromChat called');
        console.log('[DEBUG] selectedConversation:', selectedConversation);
        console.log('[DEBUG] newClientData:', newClientData);

        if (!selectedConversation || !newClientData.name.trim()) {
            console.log('[DEBUG] Early return - missing data');
            return;
        }

        try {
            console.log('[DEBUG] Sending POST request to /clients/from-chat');
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

            console.log('[DEBUG] Response status:', res.status);
            if (res.ok) {
                const data = await res.json();
                console.log('[DEBUG] Success:', data);
                setMatchedClient(data.client);
                setShowCreateClientModal(false);
                setNewClientData({ name: '', email: '', phone: '', company: '', notes: '' });
                showToast('Cliente creado exitosamente', 'success');
            } else {
                console.log('[DEBUG] Error response:', await res.text());
                showToast('Error al crear cliente', 'error');
            }
        } catch (err) {
            console.error('[DEBUG] Error creating client:', err);
            showToast('Error de conexión', 'error');
        }
    };

    // Link conversation contact to existing client
    const handleLinkToClient = async (clientId: string) => {
        if (!selectedConversation) return;

        try {
            const res = await fetch(`${API_URL}/clients/${clientId}/contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: selectedConversation.platform,
                    value: selectedConversation.customerContact
                })
            });

            if (res.ok) {
                const data = await res.json();
                setMatchedClient(data.client);
                setShowLinkClientModal(false);
                setClientSearchTerm('');
                showToast(`Contacto vinculado a ${data.client.name}`, 'success');
            } else {
                showToast('Error al vincular contacto', 'error');
            }
        } catch (err) {
            console.error('Error linking contact:', err);
            showToast('Error de conexión', 'error');
        }
    };

    // Filter clients for search
    const filteredClients = clientSearchTerm.trim()
        ? allClients.filter(c =>
            c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
            c.email?.toLowerCase().includes(clientSearchTerm.toLowerCase())
        )
        : allClients;

    // Check takeover status for a conversation
    const checkTakeoverStatus = async (sessionId: string) => {
        try {
            const res = await fetch(`${API_URL}/conversations/${sessionId}/takeover-status`);
            const data = await res.json();
            setTakeoverStatus(data);
        } catch (err) {
            console.error('Error checking takeover status:', err);
            setTakeoverStatus({ active: false });
        }
    };

    // Take control from AI
    const handleTakeover = async () => {
        if (!selectedConversation) return;
        setTakingOver(true);
        try {
            const res = await fetch(`${API_URL}/conversations/${selectedConversation.sessionId}/takeover`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 'admin', durationMinutes: 60 })
            });
            if (res.ok) {
                await checkTakeoverStatus(selectedConversation.sessionId);
                showToast('Has tomado el control de la conversación', 'success');
            } else {
                showToast('Error al tomar control', 'error');
            }
        } catch (err) {
            console.error('Error taking over:', err);
            showToast('Error de conexión', 'error');
        } finally {
            setTakingOver(false);
        }
    };

    // Release control back to AI
    const handleRelease = async () => {
        if (!selectedConversation) return;
        try {
            const res = await fetch(`${API_URL}/conversations/${selectedConversation.sessionId}/release`, {
                method: 'POST'
            });
            if (res.ok) {
                setTakeoverStatus({ active: false });
                showToast('IA retomó el control de la conversación', 'info');
            }
        } catch (err) {
            console.error('Error releasing:', err);
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
        // Check takeover status
        checkTakeoverStatus(conv.sessionId);
    };

    // Send reply
    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedConversation) return;

        setSending(true);
        try {
            // Unified Send: Use /chat/send for ALL platforms (AssistAI, WhatsApp, Instagram, etc.)
            const res = await fetch(`${API_URL}/chat/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: selectedConversation.sessionId,
                    content: replyText.trim()
                })
            });

            if (res.ok) {
                const data = await res.json();
                setReplyText('');
                showToast('Mensaje enviado a AssistAI', 'success');

                // Add message to local state for immediate feedback
                const newMessage: ChatMessage = {
                    id: `msg-${Date.now()}`,
                    sessionId: selectedConversation.sessionId,
                    from: 'agent',
                    platform: selectedConversation.platform,
                    content: replyText.trim(),
                    sender: 'agent',
                    timestamp: new Date().toISOString()
                };
                setSelectedConversation({
                    ...selectedConversation,
                    messages: [...selectedConversation.messages, newMessage]
                });
            } else {
                const errData = await res.json().catch(() => ({}));
                showToast(`Error: ${errData.error || 'No se pudo enviar'}`, 'error');
            }
        } catch (err: any) {
            console.error(err);
            showToast('Error enviando mensaje', 'error');
        } finally {
            setSending(false);
        }
    };

    // AI Suggestions - fetch contextual reply suggestions
    const handleGetSuggestions = async () => {
        if (!selectedConversation) return;
        setLoadingSuggestions(true);
        setShowSuggestions(true);
        try {
            const res = await fetch(`${API_URL}/ai/suggest-reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: selectedConversation.sessionId,
                    lastMessages: selectedConversation.messages.slice(-5)
                })
            });
            if (res.ok) {
                const data = await res.json();
                setAiSuggestions(data.suggestions || []);
            }
        } catch (err) {
            console.error('Error getting suggestions:', err);
            setAiSuggestions([]);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const handleUseSuggestion = (text: string) => {
        setReplyText(text);
        setShowSuggestions(false);
    };

    // Initiate Chat
    const handleInitiateChat = async () => {
        if (!newChatPhone.trim()) {
            showToast('Ingresa un número de teléfono', 'error');
            return;
        }
        setInitiatingChat(true);
        try {
            const res = await fetch(`${API_URL}/conversations/lookup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: newChatPhone.trim(), platform: newChatPlatform })
            });
            const data = await res.json();

            if (res.ok && data.found) {
                const existing = conversations.find(c => c.sessionId === data.sessionId);
                if (existing) {
                    setSelectedConversation(existing);
                } else {
                    setConversations(prev => [data.conversation, ...prev]);
                    setSelectedConversation(data.conversation);
                }
                setShowNewChatModal(false);
                setNewChatPhone('');
                showToast('Conversación abierta', 'success');
            } else {
                showToast(data.error || 'No se encontró conversación. Asegúrate que el cliente haya escrito antes.', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Error iniciando chat', 'error');
        } finally {
            setInitiatingChat(false);
        }
    };

    // Filter conversations by subscribed agents AND search term
    const filteredConversations = conversations.filter(c => {
        // Agent filter
        if (subscribedAgents.length > 0 && !subscribedAgents.includes(c.agentCode || '')) {
            return false;
        }
        // Search filter (fast client-side)
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
        <>
            <div className="h-[calc(100vh-140px)] flex bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeIn">
                {/* Left: Conversation List */}
                <div className="w-80 border-r border-gray-100 bg-gray-50/50 flex flex-col">
                    <div className="p-4 border-b border-gray-100 bg-white">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-gray-800">Inbox Unificado</h3>
                            <div className="flex items-center gap-2">
                                {/* Search Input */}
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Buscar..."
                                        className="w-32 sm:w-40 pl-7 pr-6 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                    />
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                                    {searchTerm && (
                                        <button
                                            onClick={() => setSearchTerm('')}
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
                                    onClick={() => setShowNewChatModal(true)}
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

                                    {/* Takeover Control - AI/Human Indicator */}
                                    {selectedConversation.agentName && (
                                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${takeoverStatus?.active
                                            ? 'bg-orange-50 border-orange-200'
                                            : 'bg-purple-50 border-purple-100'
                                            }`}>
                                            <span className="text-lg">{takeoverStatus?.active ? '👤' : '🤖'}</span>
                                            <div>
                                                <p className={`text-xs font-bold ${takeoverStatus?.active ? 'text-orange-700' : 'text-purple-700'}`}>
                                                    {takeoverStatus?.active ? 'Control Humano' : selectedConversation.agentName}
                                                </p>
                                                <p className={`text-[10px] ${takeoverStatus?.active ? 'text-orange-500' : 'text-purple-500'}`}>
                                                    {takeoverStatus?.active
                                                        ? `${takeoverStatus.remainingMinutes || 0} min restantes`
                                                        : 'IA Activa'
                                                    }
                                                </p>
                                            </div>
                                            {takeoverStatus?.active ? (
                                                <button
                                                    onClick={handleRelease}
                                                    className="ml-2 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded-lg transition-colors"
                                                    title="Devolver control a la IA"
                                                >
                                                    🤖 Devolver a IA
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={handleTakeover}
                                                    disabled={takingOver}
                                                    className="ml-2 px-2.5 py-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg transition-colors"
                                                    title="Tomar control de la conversación"
                                                >
                                                    {takingOver ? '...' : '👤 Tomar Control'}
                                                </button>
                                            )}
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
                                                <div className={`flex items-center gap-1 ${msg.sender === 'agent' ? 'justify-end' : ''}`}>
                                                    <span className={`text-[10px] ${msg.sender === 'agent' ? 'text-emerald-100' : 'text-gray-400'}`}>
                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {msg.sender === 'agent' && (
                                                        <span className={`text-[10px] font-bold ${msg.status === 'read' ? 'text-blue-200' : 'text-emerald-200'}`} title={msg.status}>
                                                            {msg.status === 'read' || msg.status === 'delivered' ? '✓✓' : (msg.status === 'sent' ? '✓' : '🕒')}
                                                            {msg.status === 'failed' && '❌'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Reply Input */}
                            <div className="p-4 border-t border-gray-100 bg-white">
                                {/* AI Suggestions Panel */}
                                {showSuggestions && (
                                    <div className="mb-3 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-purple-700">✨ Sugerencias IA</span>
                                            <button onClick={() => setShowSuggestions(false)} className="text-purple-400 hover:text-purple-600 text-xs">✕</button>
                                        </div>
                                        {loadingSuggestions ? (
                                            <div className="text-center py-4">
                                                <span className="inline-block w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></span>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {aiSuggestions.map((s, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => handleUseSuggestion(s.text)}
                                                        className="w-full text-left p-2.5 bg-white hover:bg-purple-100 rounded-lg border border-purple-100 transition-colors group"
                                                    >
                                                        <p className="text-sm text-gray-700">{s.text}</p>
                                                        <span className="text-[10px] text-purple-500 font-medium mt-1 inline-block capitalize">{s.tone}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="flex gap-2 items-center">
                                    {/* AI Tools Button */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowAiMenu(!showAiMenu)}
                                            disabled={loadingSuggestions || aiLoading}
                                            title="Herramientas de IA"
                                            className="p-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 rounded-xl text-white transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50"
                                        >
                                            {aiLoading ? '...' : '✨'}
                                        </button>

                                        {/* AI Menu */}
                                        {showAiMenu && (
                                            <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-xl shadow-xl border border-purple-100 overflow-hidden z-20 animate-fadeIn">
                                                <div className="p-2 border-b border-gray-100 bg-purple-50">
                                                    <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Asistente IA</span>
                                                </div>
                                                <div className="p-1">
                                                    <button onClick={() => handleAiAction('rewrite')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 rounded-lg flex items-center gap-2">
                                                        <span>✍️</span> Mejorar redacción
                                                    </button>
                                                    <button onClick={() => handleAiAction('grammar')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 rounded-lg flex items-center gap-2">
                                                        <span>📝</span> Corregir gramática
                                                    </button>
                                                    <button onClick={() => handleAiAction('tone_formal')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 rounded-lg flex items-center gap-2">
                                                        <span>👔</span> Hacer más formal
                                                    </button>
                                                    <button onClick={() => handleAiAction('tone_friendly')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 rounded-lg flex items-center gap-2">
                                                        <span>👋</span> Hacer más amable
                                                    </button>
                                                    <button onClick={() => handleAiAction('expand')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 rounded-lg flex items-center gap-2">
                                                        <span>➕</span> Expandir texto
                                                    </button>
                                                    <button onClick={() => handleAiAction('translate_en')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 rounded-lg flex items-center gap-2">
                                                        <span>🇬🇧</span> Traducir a Inglés
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {/* Attachment Button */}
                                    <button
                                        title="Adjuntar archivo"
                                        className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors"
                                        onClick={() => {
                                            alert('Próximamente: Subida de archivos.');
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
                <div className="w-64 xl:w-72 border-l border-gray-100 bg-white p-4 xl:p-5 hidden lg:flex flex-col overflow-y-auto">
                    {selectedConversation ? (
                        <>
                            {/* Contact Avatar & Info */}
                            <div className="text-center mb-4 pb-4 border-b border-gray-100">
                                <div className={`w-14 h-14 xl:w-16 xl:h-16 rounded-full mx-auto mb-2 flex items-center justify-center text-xl xl:text-2xl text-white shadow-lg ${PLATFORM_CONFIG[selectedConversation.platform]?.color}`}>
                                    {selectedConversation.customerName?.charAt(0) || '?'}
                                </div>
                                <h3 className="font-bold text-gray-900 text-sm">{selectedConversation.customerName || 'Visitante'}</h3>
                                <p className="text-xs text-gray-500 truncate">{selectedConversation.customerContact}</p>
                            </div>

                            {/* Client Status */}
                            <div className="mb-4">
                                {matchedClient ? (
                                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg">✅</span>
                                            <span className="text-xs font-bold text-emerald-700">Cliente Vinculado</span>
                                        </div>
                                        <p className="text-sm font-bold text-emerald-800">{matchedClient.name}</p>
                                        <button
                                            onClick={() => setShow360View(true)}
                                            className="mt-2 text-xs text-emerald-600 hover:text-emerald-700 font-bold underline"
                                        >
                                            Ver Vista 360° →
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg">❓</span>
                                            <span className="text-xs font-bold text-amber-700">Contacto Nuevo</span>
                                        </div>
                                        <button
                                            onClick={() => setShowCreateClientModal(true)}
                                            className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-bold w-full hover:bg-amber-600 transition-colors"
                                        >
                                            + Crear Cliente
                                        </button>
                                        <button
                                            onClick={() => setShowLinkClientModal(true)}
                                            className="mt-2 text-xs bg-white text-amber-600 px-3 py-1.5 rounded-lg border border-amber-300 font-bold w-full hover:bg-amber-50 transition-colors"
                                        >
                                            🔗 Vincular a Cliente
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Channel & Stats */}
                            <div className="space-y-2 mb-4">
                                <div className="p-2.5 bg-gray-50 rounded-lg flex justify-between items-center">
                                    <span className="text-xs text-gray-600">Canal</span>
                                    <span className="text-xs font-bold text-gray-800">{PLATFORM_CONFIG[selectedConversation.platform]?.label}</span>
                                </div>
                                <div className="p-2.5 bg-gray-50 rounded-lg flex justify-between items-center">
                                    <span className="text-xs text-gray-600">Mensajes</span>
                                    <span className="text-xs font-bold text-gray-800">{selectedConversation.messages.length}</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <h4 className="font-bold text-blue-800 text-xs mb-2">Acciones</h4>
                                <button className="text-xs bg-white text-blue-600 px-3 py-1.5 rounded border border-blue-200 font-bold w-full hover:bg-blue-50 transition-colors">
                                    + Crear Lead
                                </button>
                                <button className="mt-2 text-xs bg-white text-orange-600 px-3 py-1.5 rounded border border-orange-200 font-bold w-full hover:bg-orange-50 transition-colors">
                                    + Crear Ticket
                                </button>
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

            {/* Link to Existing Client Modal */}
            {showLinkClientModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">🔗 Vincular a Cliente Existente</h3>
                            <button onClick={() => setShowLinkClientModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>
                        <div className="p-5">
                            <p className="text-sm text-gray-600 mb-4">
                                Busca un cliente existente para vincular el contacto
                                <span className="font-bold text-gray-800 ml-1">{selectedConversation?.customerContact}</span>
                            </p>
                            <input
                                type="text"
                                value={clientSearchTerm}
                                onChange={e => setClientSearchTerm(e.target.value)}
                                placeholder="Buscar por nombre o email..."
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm mb-4"
                                autoFocus
                            />
                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {filteredClients.length === 0 ? (
                                    <p className="text-center text-gray-400 py-6 text-sm">No hay clientes</p>
                                ) : (
                                    filteredClients.map(client => (
                                        <button
                                            key={client.id}
                                            onClick={() => handleLinkToClient(client.id)}
                                            className="w-full p-3 text-left bg-gray-50 hover:bg-amber-50 hover:border-amber-200 border border-gray-200 rounded-xl transition-all flex items-center gap-3"
                                        >
                                            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                                                {client.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 text-sm">{client.name}</p>
                                                <p className="text-xs text-gray-500">{client.email || 'Sin email'}</p>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Client 360 View Modal */}
            {show360View && matchedClient && (
                <ClientProfile
                    clientId={matchedClient.id}
                    onClose={() => setShow360View(false)}
                    onOpenChat={(contactValue) => {
                        setShow360View(false);
                        // Find and select conversation with this contact
                        const conv = conversations.find(c => c.customerContact === contactValue);
                        if (conv) {
                            setSelectedConversation(conv);
                        }
                    }}
                />
            )}
            {/* New Chat Modal */}
            {showNewChatModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">✨ Nuevo Chat</h3>
                            <button onClick={() => setShowNewChatModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Plataforma</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setNewChatPlatform('assistai')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${newChatPlatform === 'assistai' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                                    >
                                        🤖 AssistAI
                                    </button>
                                    <button
                                        onClick={() => setNewChatPlatform('whatsapp')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${newChatPlatform === 'whatsapp' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                                    >
                                        📱 WhatsApp
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Número de Teléfono</label>
                                <input
                                    type="text"
                                    placeholder="+58414..."
                                    value={newChatPhone}
                                    onChange={e => setNewChatPhone(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-medium"
                                    autoFocus
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Incluye el código de país (ej. +58)</p>
                            </div>

                            <button
                                onClick={handleInitiateChat}
                                disabled={initiatingChat || !newChatPhone.trim()}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                            >
                                {initiatingChat ? 'Buscando...' : 'Iniciar Conversación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
