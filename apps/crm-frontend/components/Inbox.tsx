'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from './Toast';
import ClientProfile from './ClientProfile';

import { API_URL, getHeaders } from '../app/api';
import { playNotificationSound, showBrowserNotification, requestNotificationPermission } from '../utils/notifications';

// Import sub-components
import ConversationList from './inbox/ConversationList';
import ChatArea from './inbox/ChatArea';
import ContextPanel from './inbox/ContextPanel';
import CreateClientModal from './inbox/CreateClientModal';
import LinkClientModal from './inbox/LinkClientModal';
import NewChatModal from './inbox/NewChatModal';
import CreateLeadModal from './inbox/CreateLeadModal';
import CreateTicketModal from './inbox/CreateTicketModal';
import { Conversation, ChatMessage, Agent, TakeoverStatus, MatchedClient } from './inbox/types';

export default function Inbox({ initialContact }: { initialContact?: string | null }) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState<Socket | null>(null);
    const { showToast } = useToast();

    // Agent subscription
    const [agents, setAgents] = useState<Agent[]>([]);
    const [subscribedAgents, setSubscribedAgents] = useState<string[]>([]);
    const lastPollRef = useRef<string | null>(null);
    const [newMessageCount, setNewMessageCount] = useState(0);
    // Initial Contact handling
    // useEffect moved to bottom to access handleSelectConversation
    const [searchTerm, setSearchTerm] = useState(initialContact || '');
    const [syncing, setSyncing] = useState(false);

    // Client matching state
    const [matchedClient, setMatchedClient] = useState<MatchedClient | null>(null);
    const [allClients, setAllClients] = useState<{ id: string; name: string; email: string }[]>([]);

    // Modals state
    const [showCreateClientModal, setShowCreateClientModal] = useState(false);
    const [showLinkClientModal, setShowLinkClientModal] = useState(false);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [showCreateLeadModal, setShowCreateLeadModal] = useState(false);
    const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
    const [show360View, setShow360View] = useState(false);

    // Takeover state
    const [takeoverStatus, setTakeoverStatus] = useState<TakeoverStatus | null>(null);
    const [takingOver, setTakingOver] = useState(false);

    // Pagination state
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Mobile View State
    const [mobileView, setMobileView] = useState<'list' | 'chat' | 'info'>('list');

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
        const headers = getHeaders();

        Promise.all([
            fetch(`${API_URL}/conversations`, { headers }).then(r => r.ok ? r.json() : []),
            fetch(`${API_URL}/assistai/agents`, { headers }).then(r => r.ok ? r.json() : { data: [] }),
            fetch(`${API_URL}/customers`, { headers }).then(r => r.ok ? r.json() : [])
        ])
            .then(([convData, agentsData, clientsData]) => {
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
                setConversations([]);
                setLoading(false);
            });
    }, []);

    // Auto-poll for new messages
    const pollForUpdates = useCallback(async () => {
        const headers = getHeaders();
        try {
            const url = lastPollRef.current
                ? `${API_URL}/assistai/poll?since=${encodeURIComponent(lastPollRef.current)}`
                : `${API_URL}/assistai/poll`;

            const res = await fetch(url, { headers: headers as HeadersInit });
            const data = await res.json();

            if (data.success) {
                lastPollRef.current = data.now;
                const totalNew = (data.new?.length || 0) + (data.updated?.length || 0);
                if (totalNew > 0) {
                    setNewMessageCount(prev => prev + totalNew);
                    const convRes = await fetch(`${API_URL}/conversations`, { headers: headers as any });
                    if (convRes.ok) {
                        const convData = await convRes.json();
                        if (Array.isArray(convData)) setConversations(convData);
                    }
                }
            }
        } catch (err: any) {
            if (!err?.message?.includes('Failed to fetch')) {
                console.warn('Poll issue:', err?.message || err);
            }
        }
    }, []);

    // Polling interval
    useEffect(() => {
        const interval = setInterval(pollForUpdates, 15000);
        pollForUpdates();
        return () => clearInterval(interval);
    }, [pollForUpdates]);

    // Socket connection
    useEffect(() => {
        const socketUrl = API_URL.startsWith('http') ? API_URL : undefined;
        const token = localStorage.getItem('crm_token');
        const newSocket = io(socketUrl, {
            path: '/socket.io',
            auth: { token },
            transports: ['websocket', 'polling']
        });
        setSocket(newSocket);

        newSocket.on('connect', () => console.log('🔌 Connected to chat server'));

        newSocket.on('inbox_update', async (data: { sessionId: string; message: ChatMessage }) => {
            // Play notification sound for user messages
            if (data.message.sender === 'user') {
                playNotificationSound('message');
                // Show browser notification if page is not focused
                if (document.hidden) {
                    showBrowserNotification(
                        '💬 Nuevo mensaje',
                        data.message.content || 'Has recibido un nuevo mensaje',
                        '/favicon.png'
                    );
                }
            }

            setConversations(prev => {
                const updated = [...prev];
                const idx = updated.findIndex(c => c.sessionId === data.sessionId);

                if (idx >= 0) {
                    updated[idx].messages.push(data.message);
                    updated[idx].updatedAt = new Date().toISOString();
                    const [conv] = updated.splice(idx, 1);
                    updated.unshift(conv);
                    return updated;
                } else {
                    pollForUpdates();
                    return prev;
                }
            });

            if (selectedConversation?.sessionId === data.sessionId) {
                setSelectedConversation(prev => {
                    if (!prev) return null;
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
            const headers = getHeaders() as any;
            fetch(`${API_URL}/conversations`, { headers }).then(r => r.ok ? r.json() : []).then(data => {
                if (Array.isArray(data)) setConversations(data);
            });
        });

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
        const headers = getHeaders() as any;
        try {
            await fetch(`${API_URL}/assistai/sync-recent`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ limit: 20 })
            });
            const convRes = await fetch(`${API_URL}/conversations?page=1&take=25`, { headers });
            if (convRes.ok) {
                const convData = await convRes.json();
                if (Array.isArray(convData)) {
                    setConversations(convData);
                    setPage(1);
                    setHasMore(convData.length === 25);
                    setNewMessageCount(0);
                }
            }
            showToast('Sincronización completada', 'success');
        } catch (err) {
            console.error('Sync failed', err);
            showToast('Error al sincronizar', 'error');
        } finally {
            setSyncing(false);
        }
    };

    // Load more conversations
    const handleLoadMore = async () => {
        const nextPage = page + 1;
        setLoading(true);
        const headers = getHeaders() as any;
        try {
            const res = await fetch(`${API_URL}/conversations?page=${nextPage}&take=25`, { headers });
            const data = await res.json();
            if (Array.isArray(data)) {
                setConversations(prev => [...prev, ...data]);
                setPage(nextPage);
                setHasMore(data.length === 25);
            }
        } catch (err) {
            console.error('Load more failed', err);
        } finally {
            setLoading(false);
        }
    };

    // Check if contact matches a client
    const fetchClientMatch = async (contactValue: string) => {
        try {
            const headers = getHeaders() as any;
            const res = await fetch(`${API_URL}/customers/match?value=${encodeURIComponent(contactValue)}`, { headers });
            if (res.status === 401) {
                console.warn('Unauthorized access to /customers/match');
                return;
            }
            const data = await res.json();
            if (data.matched && data.client) {
                setMatchedClient({ id: data.customerId, name: data.client.name, contacts: [] });
            } else {
                setMatchedClient(null);
            }
        } catch (err) {
            console.error('Error matching client:', err);
            setMatchedClient(null);
        }
    };

    // Check takeover status for a conversation
    const checkTakeoverStatus = async (sessionId: string) => {
        try {
            const res = await fetch(`${API_URL}/conversations/${sessionId}/takeover-status`, { headers: getHeaders() });
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
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
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
                method: 'POST',
                headers: getHeaders()
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
        setMobileView('chat'); // Switch to chat view on mobile
        if (socket) socket.emit('join_conversation', conv.sessionId);
        if (conv.customerContact) {
            fetchClientMatch(conv.customerContact);
        }
        checkTakeoverStatus(conv.sessionId);
    };

    // Handle conversation update from ChatArea
    const handleConversationUpdate = (updatedConv: Conversation) => {
        setSelectedConversation(updatedConv);
        setConversations(prev => prev.map(c =>
            c.sessionId === updatedConv.sessionId ? updatedConv : c
        ));
    };

    // Handle new conversation from NewChatModal
    const handleNewConversationFound = (conv: Conversation, isNew: boolean) => {
        if (isNew) {
            setConversations(prev => [conv, ...prev]);
        }
        setSelectedConversation(conv);
    };

    // Handle client created
    const handleClientCreated = (client: { id: string; name: string; contacts: any[] }) => {
        setMatchedClient(client);
        setAllClients(prev => [...prev, { id: client.id, name: client.name, email: '' }]);
    };

    // Handle initial contact selection
    useEffect(() => {
        if (initialContact && conversations.length > 0 && !selectedConversation) {
            const found = conversations.find(c =>
                c.customerContact === initialContact ||
                (c.customerContact && c.customerContact.includes(initialContact))
            );
            if (found) {
                handleSelectConversation(found);
            }
        }
        // If searching but not found yet, maybe we should trigger a search if filtering is client-side?
        // But passing searchTerm to ConversationList handles filtering.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialContact, conversations, selectedConversation]);

    return (
        <>
            <div className="h-[calc(100vh-180px)] md:h-[calc(100vh-140px)] flex bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeIn relative">
                {/* Left Panel */}
                <div className={`${mobileView === 'list' ? 'flex' : 'hidden md:flex'} w-full md:w-80 flex-col border-r border-gray-100`}>
                    <ConversationList
                        conversations={conversations}
                        selectedConversation={selectedConversation}
                        onSelectConversation={handleSelectConversation}
                        loading={loading}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        agents={agents}
                        subscribedAgents={subscribedAgents}
                        onToggleAgent={toggleAgentSubscription}
                        syncing={syncing}
                        onSync={handleManualSync}
                        newMessageCount={newMessageCount}
                        hasMore={hasMore}
                        onLoadMore={handleLoadMore}
                        onNewChat={() => setShowNewChatModal(true)}
                    />
                </div>

                {/* Center Panel */}
                <div className={`${mobileView === 'chat' ? 'flex' : 'hidden md:flex'} flex-1 flex-col relative`}>
                    <ChatArea
                        selectedConversation={selectedConversation}
                        onConversationUpdate={handleConversationUpdate}
                        matchedClient={matchedClient}
                        takeoverStatus={takeoverStatus}
                        onTakeover={handleTakeover}
                        onRelease={handleRelease}
                        takingOver={takingOver}
                        onCreateClient={() => setShowCreateClientModal(true)}
                        onView360={() => setShow360View(true)}
                        onCreateTicket={() => setShowCreateTicketModal(true)}
                        onCreateLead={() => setShowCreateLeadModal(true)}
                        onLinkClient={() => setShowLinkClientModal(true)}
                        showToast={showToast}
                        onBack={() => setMobileView('list')} // Back to list
                        onToggleInfo={() => setMobileView(prev => prev === 'info' ? 'chat' : 'info')} // Toggle info
                    />
                </div>

                {/* Right Panel */}
                <div className={`${mobileView === 'info' ? 'flex' : 'hidden lg:flex'} flex-col bg-white border-l border-gray-100 absolute inset-0 z-20 w-full md:w-80 md:right-0 md:left-auto lg:static lg:w-72 lg:shadow-none`}>
                    <ContextPanel
                        selectedConversation={selectedConversation}
                        matchedClient={matchedClient}
                        onCreateClient={() => setShowCreateClientModal(true)}
                        onLinkClient={() => setShowLinkClientModal(true)}
                        onView360={() => setShow360View(true)}
                        onCreateLead={() => setShowCreateLeadModal(true)}
                        onCreateTicket={() => setShowCreateTicketModal(true)}
                        showToast={showToast}
                        onBack={() => setMobileView('chat')} // Back to chat
                    />
                </div>
            </div>

            {/* Modals */}
            {selectedConversation && (
                <>
                    <CreateClientModal
                        isOpen={showCreateClientModal}
                        onClose={() => setShowCreateClientModal(false)}
                        conversation={selectedConversation}
                        onSuccess={handleClientCreated}
                        showToast={showToast}
                    />

                    <LinkClientModal
                        isOpen={showLinkClientModal}
                        onClose={() => setShowLinkClientModal(false)}
                        customerContact={selectedConversation.customerContact}
                        platform={selectedConversation.platform}
                        sessionId={selectedConversation.sessionId}
                        allClients={allClients}
                        onSuccess={handleClientCreated}
                        showToast={showToast}
                    />

                    <CreateLeadModal
                        isOpen={showCreateLeadModal}
                        onClose={() => setShowCreateLeadModal(false)}
                        customerName={selectedConversation.customerName}
                        customerContact={selectedConversation.customerContact}
                        platform={selectedConversation.platform}
                        showToast={showToast}
                    />

                    <CreateTicketModal
                        isOpen={showCreateTicketModal}
                        onClose={() => setShowCreateTicketModal(false)}
                        customerName={selectedConversation.customerName}
                        customerContact={selectedConversation.customerContact}
                        platform={selectedConversation.platform}
                        clientId={matchedClient?.id}
                        showToast={showToast}
                    />
                </>
            )}

            <NewChatModal
                isOpen={showNewChatModal}
                onClose={() => setShowNewChatModal(false)}
                conversations={conversations}
                onConversationFound={handleNewConversationFound}
                showToast={showToast}
            />

            {/* Client 360 View Modal */}
            {show360View && matchedClient && (
                <ClientProfile
                    clientId={matchedClient.id}
                    onClose={() => setShow360View(false)}
                    onOpenChat={(contactValue) => {
                        setShow360View(false);
                        const conv = conversations.find(c => c.customerContact === contactValue);
                        if (conv) {
                            setSelectedConversation(conv);
                        }
                    }}
                />
            )}
        </>
    );
}
