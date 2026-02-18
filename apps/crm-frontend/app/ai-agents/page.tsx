'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '../../components/Toast';
import { API_URL } from '../../app/api';

interface AiAgent {
    id: string;
    name: string;
    description?: string;
    provider: 'OPENAI' | 'GEMINI' | 'ELEVENLABS' | 'ASSISTAI';
    model: string;
    systemPrompt?: string;
    apiKey?: string;
    config?: any;
    isEnabled: boolean;
}

export default function AiAgentsPage() {
    const router = useRouter();
    const [agents, setAgents] = useState<AiAgent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAgent, setEditingAgent] = useState<AiAgent | null>(null);
    const [testMode, setTestMode] = useState<{ active: boolean, agentId: string | null, agentCode: string | null, agentName: string | null, provider: string | null, history: any[], conversationId: string | null }>({ active: false, agentId: null, agentCode: null, agentName: null, provider: null, history: [], conversationId: null });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<AiAgent>>({
        provider: 'OPENAI',
        model: 'gpt-4',
        name: '',
        isEnabled: true
    });

    const { showToast } = useToast();

    useEffect(() => {
        fetchAgents();
    }, []);

    const fetchAgents = async () => {
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/ai-agents`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAgents(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSyncAssistAI = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/ai-agents/sync-assistai`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                showToast(`Sincronizados ${data.count} agentes`, 'success');
                fetchAgents();
            } else {
                showToast('Error al sincronizar con AssistAI', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('crm_token');
        const url = editingAgent
            ? `${API_URL}/ai-agents/${editingAgent.id}`
            : `${API_URL}/ai-agents`;

        const method = editingAgent ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                showToast(editingAgent ? 'Agente actualizado' : 'Agente creado', 'success');
                setShowModal(false);
                fetchAgents();
            } else {
                showToast('Error al guardar agente', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este agente?')) return;

        try {
            const token = localStorage.getItem('crm_token');
            await fetch(`${API_URL}/ai-agents/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            showToast('Agente eliminado', 'success');
            fetchAgents();
        } catch (error) {
            showToast('Error al eliminar', 'error');
        }
    };

    // Test Agent
    const [testInput, setTestInput] = useState('');
    const [testLoading, setTestLoading] = useState(false);

    // Call Modal for ElevenLabs
    const [callModal, setCallModal] = useState<{ open: boolean, agentId: string | null, agentName: string }>({ open: false, agentId: null, agentName: '' });
    const [phoneNumber, setPhoneNumber] = useState('');
    const [callLoading, setCallLoading] = useState(false);

    const initiateCall = async () => {
        if (!phoneNumber.trim() || !callModal.agentId) return;

        setCallLoading(true);
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/ai-agents/${callModal.agentId}/call`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ to: phoneNumber })
            });

            const data = await res.json();
            if (res.ok) {
                showToast(`Llamada iniciada correctamente`, 'success');
                setCallModal({ open: false, agentId: null, agentName: '' });
                setPhoneNumber('');
            } else {
                showToast(data.error || 'Error al iniciar llamada', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        } finally {
            setCallLoading(false);
        }
    };

    const runTest = async () => {
        if (!testInput.trim()) return;

        const userMsg = { role: 'user', content: testInput };
        setTestMode(prev => ({ ...prev, history: [...prev.history, userMsg] }));
        setTestInput('');
        setTestLoading(true);

        try {
            const token = localStorage.getItem('crm_token');

            // For ASSISTAI agents, use the preview endpoint
            if (testMode.provider === 'ASSISTAI' && testMode.agentCode) {
                const res = await fetch(`${API_URL}/assistai/preview/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        agentCode: testMode.agentCode,
                        message: userMsg.content,
                        conversationId: testMode.conversationId
                    })
                });

                const data = await res.json();
                if (res.ok) {
                    // Update conversationId for future messages
                    setTestMode(prev => ({
                        ...prev,
                        conversationId: data.conversationId,
                        history: [...prev.history, { role: 'assistant', content: data.agentResponse }]
                    }));
                } else {
                    setTestMode(prev => ({
                        ...prev,
                        history: [...prev.history, { role: 'system', content: data.error || 'Error ejecutando prueba.' }]
                    }));
                }
            } else {
                // For other providers (OpenAI, Gemini, ElevenLabs), use the existing test endpoint
                const res = await fetch(`${API_URL}/ai-agents/${testMode.agentId}/test`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ message: userMsg.content })
                });

                const data = await res.json();
                setTestMode(prev => ({
                    ...prev,
                    history: [...prev.history, { role: 'assistant', content: data.response }]
                }));
            }
        } catch (error) {
            setTestMode(prev => ({
                ...prev,
                history: [...prev.history, { role: 'system', content: 'Error ejecutando prueba.' }]
            }));
        } finally {
            setTestLoading(false);
        }
    };

    return (
        <div className="h-full bg-gray-50 overflow-y-auto">
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">Agentes IA</h1>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSyncAssistAI}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                        >
                            🔄 Sincronizar AssistAI
                        </button>
                        <button
                            onClick={() => {
                                setEditingAgent(null);
                                setFormData({ provider: 'OPENAI', model: 'gpt-4', isEnabled: true });
                                setShowModal(true);
                            }}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                        >
                            + Crear Agente
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {loading ? (
                    <div className="flex justify-center py-10">Cargando agentes...</div>
                ) : agents.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-lg shadow">
                        <h3 className="text-lg font-medium text-gray-900">No hay agentes creados</h3>
                        <p className="mt-2 text-gray-500">Crea tu primer agente para empezar.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {agents.map(agent => (
                            <div key={agent.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`px-3 py-1 rounded-full text-xs font-semibold 
                                            ${agent.provider === 'OPENAI' ? 'bg-green-100 text-green-800' :
                                            agent.provider === 'GEMINI' ? 'bg-blue-100 text-blue-800' :
                                                agent.provider === 'ASSISTAI' ? 'bg-orange-100 text-orange-800' :
                                                    'bg-purple-100 text-purple-800'}`}>
                                        {agent.provider}
                                    </div>
                                    <div className="flex space-x-2">
                                        {agent.provider === 'ELEVENLABS' && (
                                            <button
                                                onClick={() => setCallModal({ open: true, agentId: agent.id, agentName: agent.name })}
                                                className="text-gray-400 hover:text-green-600" title="Llamar"
                                            >
                                                📞
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                // Get agentCode from config for ASSISTAI agents
                                                const agentCode = agent.config?.assistaiCode || agent.config?.code;
                                                setTestMode({
                                                    active: true,
                                                    agentId: agent.id,
                                                    agentCode: agentCode,
                                                    agentName: agent.name,
                                                    provider: agent.provider,
                                                    history: [],
                                                    conversationId: null
                                                });
                                            }}
                                            className="text-gray-400 hover:text-indigo-600" title="Probar"
                                        >
                                            ▶️
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingAgent(agent);
                                                setFormData(agent);
                                                setShowModal(true);
                                            }}
                                            className="text-gray-400 hover:text-yellow-600" title="Editar"
                                        >
                                            ✎
                                        </button>
                                        <button
                                            onClick={() => handleDelete(agent.id)}
                                            className="text-gray-400 hover:text-red-600" title="Eliminar"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">{agent.name}</h3>
                                <p className="text-sm text-gray-500 mb-4 h-10 overflow-hidden">{agent.description || 'Sin descripción'}</p>

                                <div className="text-xs text-gray-400 font-mono bg-gray-50 p-2 rounded truncate">
                                    Model: {agent.model}
                                </div>
                                {agent.systemPrompt && (
                                    <div className="mt-2 text-xs text-gray-500 italic truncate">
                                        "{agent.systemPrompt.substring(0, 50)}..."
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>


            {/* Create/Edit Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                            <h2 className="text-xl font-bold mb-4">
                                {editingAgent ? 'Editar Agente' : 'Nuevo Agente IA'}
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Nombre</label>
                                        <input
                                            type="text"
                                            required
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Proveedor</label>
                                        <select
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                                            value={formData.provider}
                                            onChange={e => setFormData({ ...formData, provider: e.target.value as any })}
                                        >
                                            <option value="OPENAI">OpenAI (GPT)</option>
                                            <option value="GEMINI">Google Gemini</option>
                                            <option value="ELEVENLABS">ElevenLabs (Voz)</option>
                                            <option value="ASSISTAI">AssistAI (Agente Externo)</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Modelo</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                                        placeholder="ej. gpt-4, gemini-pro, eleven_turbo_v2"
                                        value={formData.model}
                                        onChange={e => setFormData({ ...formData, model: e.target.value })}
                                    />
                                </div>

                                {formData.provider !== 'ELEVENLABS' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">System Prompt</label>
                                        <textarea
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2 h-32"
                                            placeholder="Instrucciones para la IA..."
                                            value={formData.systemPrompt || ''}
                                            onChange={e => setFormData({ ...formData, systemPrompt: e.target.value })}
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">API Key (Opcional - usa env si vacío)</label>
                                    <input
                                        type="password"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                                        placeholder="sk-..."
                                        value={formData.apiKey || ''}
                                        onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Descripción</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                                        value={formData.description || ''}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                <div className="flex justify-end space-x-3 pt-4 border-t">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Test Simulation Modal */}
            {
                testMode.active && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl flex flex-col" style={{ height: 'min(90vh, 800px)' }}>
                            {/* Header */}
                            <div className="relative px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-center bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl">
                                <div className="text-center">
                                    <h3 className="font-bold text-white text-lg">{testMode.agentName || 'Agente'}</h3>
                                    <span className="text-xs text-white/70 block mt-0.5">
                                        {testMode.provider === 'ASSISTAI' ? 'Preview de AssistAI' : testMode.provider}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setTestMode({ active: false, agentId: null, agentCode: null, agentName: null, provider: null, history: [], conversationId: null })}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* ASSISTAI Agent: Show embedded widget */}
                            {testMode.provider === 'ASSISTAI' && testMode.agentCode ? (
                                <div className="flex-1 overflow-hidden rounded-b-2xl">
                                    <iframe
                                        src={`https://account.assistai.lat/${testMode.agentCode}`}
                                        className="w-full h-full border-0"
                                        allow="microphone"
                                        title="AssistAI Chat Widget"
                                        style={{ minHeight: '100%' }}
                                    />
                                </div>
                            ) : (
                                /* Other providers: Show custom chat UI */
                                <>
                                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gray-50">
                                        {testMode.history.length === 0 && (
                                            <div className="text-center text-gray-400 text-sm mt-10">
                                                <div className="text-4xl mb-3">💬</div>
                                                Escribe un mensaje para probar el agente...
                                            </div>
                                        )}
                                        {testMode.history.map((msg, idx) => (
                                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user'
                                                    ? 'bg-indigo-600 text-white rounded-br-md'
                                                    : msg.role === 'system' ? 'bg-red-100 text-red-800' : 'bg-white text-gray-800 rounded-bl-md'
                                                    }`}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        ))}
                                        {testLoading && (
                                            <div className="flex justify-start">
                                                <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 text-sm shadow-sm">
                                                    <div className="flex gap-1">
                                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-4 border-t bg-white rounded-b-2xl">
                                        <form onSubmit={(e) => { e.preventDefault(); runTest(); }} className="flex gap-2">
                                            <input
                                                type="text"
                                                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                                placeholder="Escribe un mensaje..."
                                                value={testInput}
                                                onChange={e => setTestInput(e.target.value)}
                                                autoFocus
                                            />
                                            <button
                                                type="submit"
                                                disabled={testLoading}
                                                className="bg-indigo-600 text-white px-5 py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                                            >
                                                <span className="hidden sm:inline">Enviar</span>
                                                <span>→</span>
                                            </button>
                                        </form>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Call Modal for ElevenLabs */}
            {
                callModal.open && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                            <h2 className="text-xl font-bold mb-4">Iniciar Llamada</h2>
                            <p className="text-sm text-gray-600 mb-4">Agente: <strong>{callModal.agentName}</strong></p>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Número de teléfono</label>
                                <input
                                    type="tel"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                                    placeholder="+1234567890"
                                    value={phoneNumber}
                                    onChange={e => setPhoneNumber(e.target.value)}
                                    autoFocus
                                />
                                <p className="mt-1 text-xs text-gray-500">Incluye el código de país (ej: +52 para México)</p>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => { setCallModal({ open: false, agentId: null, agentName: '' }); setPhoneNumber(''); }}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={initiateCall}
                                    disabled={callLoading || !phoneNumber.trim()}
                                    className="px-4 py-2 bg-green-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {callLoading ? 'Iniciando...' : '📞 Llamar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
