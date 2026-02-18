'use client';

import { useState } from 'react';
import { API_URL, getHeaders } from '../../app/api';

type AiToolsMenuProps = {
    replyText: string;
    onTextUpdate: (text: string) => void;
    selectedConversation: {
        customerName?: string;
        sessionId: string;
        messages: { content: string }[];
    } | null;
    showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
};

export default function AiToolsMenu({
    replyText,
    onTextUpdate,
    selectedConversation,
    showToast
}: AiToolsMenuProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [loading, setLoading] = useState(false);

    // AI Suggestions state
    const [suggestions, setSuggestions] = useState<{ text: string; tone: string }[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    const handleAiAction = async (task: 'rewrite' | 'grammar' | 'tone_formal' | 'tone_friendly' | 'expand' | 'translate_en') => {
        if (!replyText.trim()) {
            showToast('Escribe algo primero para que la IA lo procese', 'error');
            return;
        }

        setLoading(true);
        setShowMenu(false);

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
                onTextUpdate(data.result);
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
            setLoading(false);
        }
    };

    const handleGetSuggestions = async () => {
        if (!selectedConversation) return;
        setLoadingSuggestions(true);
        setShowSuggestions(true);
        setShowMenu(false);
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
                setSuggestions(data.suggestions || []);
            }
        } catch (err) {
            console.error('Error getting suggestions:', err);
            setSuggestions([]);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const handleUseSuggestion = (text: string) => {
        onTextUpdate(text);
        setShowSuggestions(false);
    };

    return (
        <>
            {/* AI Suggestions Panel */}
            {showSuggestions && (
                <div className="absolute bottom-full left-0 right-0 mb-3 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 mx-4 z-30 animate-fadeIn">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-purple-700">✨ Sugerencias IA</span>
                        <button onClick={() => setShowSuggestions(false)} className="text-purple-400 hover:text-purple-600 text-xs">✕</button>
                    </div>
                    {loadingSuggestions ? (
                        <div className="text-center py-4">
                            <span className="inline-block w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></span>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {suggestions.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-2">No hay sugerencias disponibles</p>
                            ) : (
                                suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleUseSuggestion(s.text)}
                                        className="w-full text-left p-2.5 bg-white hover:bg-purple-100 rounded-lg border border-purple-100 transition-colors"
                                    >
                                        <p className="text-sm text-gray-700">{s.text}</p>
                                        <span className="text-[10px] text-purple-500 font-medium mt-1 inline-block capitalize">{s.tone}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* AI Tools Button */}
            <div className="relative">
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    disabled={loadingSuggestions || loading}
                    title="Herramientas de IA"
                    className="p-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 rounded-xl text-white transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50"
                >
                    {loading ? '...' : '✨'}
                </button>

                {/* AI Menu */}
                {showMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-xl shadow-xl border border-purple-100 overflow-hidden z-20 animate-fadeIn">
                        <div className="p-2 border-b border-gray-100 bg-purple-50">
                            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Asistente IA</span>
                        </div>
                        <div className="p-1">
                            {/* Suggestions button */}
                            <button
                                onClick={handleGetSuggestions}
                                className="w-full text-left px-3 py-2 text-sm text-white font-medium bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg flex items-center gap-2 mb-1"
                            >
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
        </>
    );
}
