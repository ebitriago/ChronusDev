'use client';

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../app/api';

// Simple Auth context consumer if useAuth isn't globally available or suitable
// Assuming API_URL is defined in app/api.ts

interface ChatMessage {
    id: string;
    content: string;
    sender: 'user' | 'agent';
    timestamp: string;
    agentName?: string;
}

export default function SupportChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [socket, setSocket] = useState<Socket | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isSending, setIsSending] = useState(false);

    // We need user info. Accessing from localStorage for simplicity if context is complex
    const [user, setUser] = useState<any>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Load user from storage
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        if (storedUser && token) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);

            // Connect Socket
            const socketUrl = API_URL.replace('/api', ''); // Adjust if needed
            const newSocket = io(socketUrl, {
                path: '/socket.io',
                auth: { token },
                transports: ['websocket', 'polling']
            });

            newSocket.on('connect', () => {
                console.log('🔌 [SupportChat] Connected to socket');
            });

            newSocket.on('chat_reply', (data: any) => {
                console.log('📩 [SupportChat] Received reply:', data);
                const newMessage: ChatMessage = {
                    id: Math.random().toString(36).substr(2, 9),
                    content: data.content,
                    sender: 'agent',
                    timestamp: data.timestamp,
                    agentName: data.agentName
                };
                setMessages(prev => [...prev, newMessage]);
                if (!isOpen) {
                    setUnreadCount(prev => prev + 1);
                }
                // Haptic feedback
                import('../services/capacitor').then(({ triggerHaptic }) => {
                    triggerHaptic('medium');
                });
            });

            setSocket(newSocket);

            return () => {
                newSocket.disconnect();
            };
        }
    }, [isOpen]);

    // Auto-scroll
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setUnreadCount(0);
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || !user) return;

        const text = input.trim();
        setInput('');
        setIsSending(true);

        try {
            const res = await fetch(`${API_URL}/chat/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ content: text })
            });

            if (res.ok) {
                const myMsg: ChatMessage = {
                    id: Date.now().toString(),
                    content: text,
                    sender: 'user',
                    timestamp: new Date().toISOString()
                };
                setMessages(prev => [...prev, myMsg]);
            } else {
                console.error('Failed to send message');
                // Optional: Show error toast
            }
        } catch (err) {
            console.error('Error sending message:', err);
        } finally {
            setIsSending(false);
        }
    };

    if (!user) return null; // Don't show if not logged in

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-80 sm:w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden pointer-events-auto animate-fadeIn scale-100 origin-bottom-right transition-all">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex items-center justify-between text-white shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                💬
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">Soporte ChronusDev</h3>
                                <div className="flex items-center gap-1.5 opacity-90">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    <span className="text-[10px] font-medium">En línea</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 space-y-4">
                        {messages.length === 0 ? (
                            <div className="text-center text-gray-400 py-10">
                                <p className="text-4xl mb-2">👋</p>
                                <p className="text-sm">¡Hola! ¿En qué podemos ayudarte?</p>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.sender === 'user'
                                            ? 'bg-blue-600 text-white rounded-tr-sm'
                                            : 'bg-white border border-gray-100 text-gray-700 rounded-tl-sm'
                                            }`}
                                    >
                                        {msg.agentName && (
                                            <p className="text-[10px] font-bold opacity-70 mb-0.5 mb-1">{msg.agentName}</p>
                                        )}
                                        <p className="leading-relaxed">{msg.content}</p>
                                        <p className={`text-[10px] mt-1 text-right ${msg.sender === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t border-gray-100">
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                            className="flex items-center gap-2"
                        >
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Escribe un mensaje..."
                                className="flex-1 bg-gray-100 border-0 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none text-gray-700 placeholder-gray-400"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isSending}
                                className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                            >
                                {isSending ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                ) : (
                                    <span>➤</span>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Float Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="pointer-events-auto h-14 w-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 hover:scale-110 active:scale-95 transition-all flex items-center justify-center relative group"
            >
                {isOpen ? (
                    <span className="text-xl">✕</span>
                ) : (
                    <span className="text-2xl transform group-hover:rotate-12 transition-transform">💬</span>
                )}

                {unreadCount > 0 && !isOpen && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white animate-bounce">
                        {unreadCount}
                    </span>
                )}
            </button>
        </div>
    );
}
