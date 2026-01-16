'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://127.0.0.1:3002';

export default function PublicChatPage() {
    const [sessionId, setSessionId] = useState<string>('');
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Generate or retrieve session ID
    useEffect(() => {
        let storedSession = localStorage.getItem('chronus_chat_session');
        if (!storedSession) {
            storedSession = `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('chronus_chat_session', storedSession);
        }
        setSessionId(storedSession);

        // Load history
        fetch(`${API_URL}/conversations/${storedSession}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data?.messages) setMessages(data.messages);
            })
            .catch(() => { });
    }, []);

    // Socket connection
    useEffect(() => {
        if (!sessionId) return;

        const newSocket = io(API_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            setConnected(true);
            newSocket.emit('join_conversation', sessionId);
        });

        newSocket.on('new_message', (msg: any) => {
            // Only add agent messages; user messages already added optimistically
            if (msg.sender === 'agent') {
                setMessages(prev => [...prev, msg]);
            }
        });

        newSocket.on('disconnect', () => setConnected(false));

        return () => { newSocket.disconnect(); };
    }, [sessionId]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Send message
    const handleSendMessage = async () => {
        if (!inputText.trim()) return;

        // Optimistic UI
        const tempMsg = { id: `temp-${Date.now()}`, content: inputText, sender: 'user', timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, tempMsg]);
        setInputText('');

        try {
            await fetch(`${API_URL}/webhooks/messages/incoming`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: sessionId,
                    content: inputText,
                    platform: 'assistai',
                    sessionId,
                    customerName: 'Visitante Web'
                })
            });
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                            💬
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">Soporte en Vivo</h1>
                            <p className="text-emerald-100 text-sm flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-300 animate-pulse' : 'bg-gray-400'}`}></span>
                                {connected ? 'Conectado' : 'Conectando...'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="h-96 overflow-y-auto p-4 space-y-3 bg-gray-50">
                    {messages.length === 0 && (
                        <div className="text-center text-gray-400 mt-10">
                            <p className="text-4xl mb-2">👋</p>
                            <p>¡Hola! ¿En qué podemos ayudarte hoy?</p>
                        </div>
                    )}
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'agent' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.sender === 'agent'
                                ? 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm'
                                : 'bg-emerald-500 text-white rounded-br-sm'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-gray-100 bg-white">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Escribe tu mensaje..."
                            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!inputText.trim()}
                            className="px-5 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                            ➤
                        </button>
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-3">
                        Powered by <span className="font-bold text-emerald-600">ChronusCRM</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
