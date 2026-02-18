'use client';

import { useState, useRef, useEffect } from 'react';
import { Conversation, ChatMessage, TakeoverStatus, MatchedClient, PLATFORM_CONFIG, renderMedia } from './types';
import { API_URL, getHeaders } from '../../app/api';
import EmojiPicker from 'emoji-picker-react';

type ChatAreaProps = {
    selectedConversation: Conversation | null;
    onConversationUpdate: (conv: Conversation) => void;
    matchedClient: MatchedClient | null;
    takeoverStatus: TakeoverStatus | null;
    onTakeover: () => void;
    onRelease: () => void;
    takingOver: boolean;
    onCreateClient: () => void;
    onView360: () => void;
    onCreateTicket?: () => void;
    onCreateLead?: () => void;
    onLinkClient?: () => void;
    showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
    // Mobile props
    onBack?: () => void;
    onToggleInfo?: () => void;
};

export default function ChatArea({
    selectedConversation,
    onConversationUpdate,
    matchedClient,
    takeoverStatus,
    onTakeover,
    onRelease,
    takingOver,
    onCreateClient,
    onView360,
    onCreateTicket,
    onCreateLead,
    onLinkClient,
    showToast,
    onBack,
    onToggleInfo
}: ChatAreaProps) {
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // AI Smart Compose State
    const [showAiMenu, setShowAiMenu] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    // AI Suggestions state
    const [aiSuggestions, setAiSuggestions] = useState<{ text: string; tone: string }[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedConversation?.messages]);

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



    // AI Suggestions
    const handleGetSuggestions = async () => {
        if (!selectedConversation) return;
        setLoadingSuggestions(true);
        setShowSuggestions(true);
        try {
            const res = await fetch(`${API_URL}/ai/suggest-reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
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

    // Media & Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Reusable Send Function
    const sendMessage = async (content: string, mediaUrl?: string, mediaType?: 'image' | 'audio' | 'document') => {
        if (!selectedConversation) return;
        setSending(true);
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/chat/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sessionId: selectedConversation.sessionId,
                    content,
                    mediaUrl,
                    mediaType
                })
            });

            if (res.ok) {
                setReplyText('');
                showToast('Mensaje enviado', 'success');

                // Optimistic Update
                const newMessage: ChatMessage = {
                    id: `msg-${Date.now()}`,
                    sessionId: selectedConversation.sessionId,
                    from: 'agent',
                    platform: selectedConversation.platform,
                    content: content || (mediaUrl ? '📎 Archivo adjunto' : ''),
                    sender: 'agent',
                    timestamp: new Date().toISOString(),
                    mediaUrl,
                    mediaType
                };
                onConversationUpdate({
                    ...selectedConversation,
                    messages: [...selectedConversation.messages, newMessage]
                });
                setShowEmojiPicker(false); // Close on send
            } else {
                showToast('Error al enviar mensaje', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Error de conexión', 'error');
        } finally {
            setSending(false);
        }
    };

    const handleSendReply = () => {
        if (!replyText.trim()) return;
        sendMessage(replyText.trim());
    };

    // File Upload
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            await uploadAndSend(file);
        }
    };

    const uploadAndSend = async (file: File) => {
        setSending(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/chat/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                await sendMessage('', data.url, data.type);
            } else {
                showToast('Error al subir archivo', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Error de subida', 'error');
        } finally {
            setSending(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Recording Logic
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (blob.size > 0) {
                    const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
                    await uploadAndSend(file);
                }
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error(err);
            showToast('No se pudo acceder al micrófono', 'error');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            // Stop but don't send (clear chunks or handle in onstop? simpler to just reset ref before stop?)
            // Actually, verify mediaRecorder.onstop logic. It sends if blob > 0.
            // We can just clear chunks ref before stopping?
            // But ondataavailable might fire.
            // Best way: set a flag or just replace onstop.
            mediaRecorderRef.current.onstop = () => {
                // Do nothing
                mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
    };

    if (!selectedConversation) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-3xl">💬</div>
                <p className="font-medium">Selecciona una conversación</p>
                <p className="text-sm mt-1">Gestiona todos tus canales en un solo lugar</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-white relative w-full h-full">
            {/* Chat Header */}
            <div className="h-16 md:h-20 border-b border-gray-100 flex items-center justify-between px-3 md:px-6 bg-white z-10 sticky top-0">
                <div className="flex items-center gap-2 md:gap-3">
                    {/* Back Button (Mobile) */}
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full md:hidden"
                            title="Volver"
                        >
                            ←
                        </button>
                    )}

                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-md ${PLATFORM_CONFIG[selectedConversation.platform]?.color}`}>
                        {PLATFORM_CONFIG[selectedConversation.platform]?.icon}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-sm md:text-base">{selectedConversation.customerName || selectedConversation.customerContact}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${PLATFORM_CONFIG[selectedConversation.platform]?.color}`}>
                                {PLATFORM_CONFIG[selectedConversation.platform]?.icon} {PLATFORM_CONFIG[selectedConversation.platform]?.label}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Mobile Info Toggle */}
                <div className="flex items-center gap-1 md:hidden">
                    {onToggleInfo && (
                        <button
                            onClick={onToggleInfo}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                            title="Ver información del contacto"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Desktop Actions */}
                <div className="hidden md:flex items-center gap-3">
                    {matchedClient ? (
                        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                            <span className="text-lg">👤</span>
                            <div>
                                <p className="text-xs font-bold text-emerald-700">{matchedClient.name}</p>
                                <button
                                    onClick={onView360}
                                    className="text-[10px] text-emerald-600 hover:underline"
                                >
                                    Ver Cliente 360°
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={onCreateClient}
                            className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-xl border border-amber-200 transition-colors"
                        >
                            <span className="text-lg">➕</span>
                            <div className="text-left">
                                <p className="text-xs font-bold text-amber-700">Crear Cliente</p>
                                <p className="text-[10px] text-amber-500">Nuevo contacto</p>
                            </div>
                        </button>
                    )}

                    {/* Takeover Control */}
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
                                    onClick={onRelease}
                                    className="ml-2 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded-lg transition-colors"
                                    title="Devolver control a la IA"
                                >
                                    🤖 Devolver a IA
                                </button>
                            ) : (
                                <button
                                    onClick={onTakeover}
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

            {/* Mobile Quick Actions Bar */}
            <div className="flex md:hidden items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/80 overflow-x-auto">
                {matchedClient ? (
                    <>
                        <button
                            onClick={onView360}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200"
                        >
                            👤 Vista 360°
                        </button>
                        <button
                            onClick={onCreateTicket}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold border border-orange-200"
                        >
                            🎫 Crear Ticket
                        </button>
                        <button
                            onClick={onCreateLead}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200"
                        >
                            📋 Crear Lead
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={onCreateClient}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold border border-amber-200"
                        >
                            ➕ Crear Cliente
                        </button>
                        {onLinkClient && (
                            <button
                                onClick={onLinkClient}
                                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs font-bold border border-gray-200"
                            >
                                🔗 Vincular
                            </button>
                        )}
                        <button
                            onClick={onCreateLead}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200"
                        >
                            📋 Crear Lead
                        </button>
                    </>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 bg-slate-50/30">
                {selectedConversation.messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%]`}>
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
                                    <button onClick={handleGetSuggestions} className="w-full text-left px-3 py-2 text-sm text-white font-medium bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg flex items-center gap-2 mb-1">
                                        <span>💡</span> Obtener Sugerencias
                                    </button>
                                    <div className="border-t border-gray-100 my-1"></div>
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
                    {/* Hidden File Input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {isRecording ? (
                        <div className="flex-1 flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 animate-pulse">
                            <span className="w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                            <span className="text-red-600 font-bold text-sm flex-1">
                                Grabando... {formatTime(recordingTime)}
                            </span>
                            <button
                                onClick={cancelRecording}
                                className="p-2 hover:bg-red-100 rounded-full text-red-400 hover:text-red-600 transition-colors"
                                title="Cancelar"
                            >
                                ✕
                            </button>
                            <button
                                onClick={stopRecording}
                                className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors shadow-md"
                                title="Enviar Audio"
                            >
                                ✓
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Attachment Button */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={sending}
                                title="Adjuntar archivo"
                                className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors disabled:opacity-50"
                            >
                                📎
                            </button>

                            {/* Emoji Button */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    title="Emoji"
                                    className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors disabled:opacity-50"
                                >
                                    😀
                                </button>
                                {showEmojiPicker && (
                                    <div className="absolute bottom-full mb-2 right-0 z-50 shadow-xl border border-gray-100 rounded-xl overflow-hidden bg-white w-[300px]">
                                        <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-b border-gray-100">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Emojis</span>
                                            <button
                                                onClick={() => setShowEmojiPicker(false)}
                                                className="text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        <EmojiPicker
                                            onEmojiClick={(emojiData) => {
                                                setReplyText(prev => prev + emojiData.emoji);
                                                setShowEmojiPicker(false); // Close on select for better UX
                                            }}
                                            width="100%"
                                            height={300}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Mic Button */}
                            <button
                                onClick={startRecording}
                                disabled={sending}
                                title="Grabar audio"
                                className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors disabled:opacity-50"
                            >
                                🎤
                            </button>

                            <input
                                type="text"
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSendReply()}
                                placeholder="Escribe tu respuesta..."
                                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-all disabled:opacity-50"
                                disabled={sending}
                            />

                            <button
                                onClick={handleSendReply}
                                disabled={sending || !replyText.trim()}
                                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                            >
                                {sending ? '...' : 'Enviar'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
