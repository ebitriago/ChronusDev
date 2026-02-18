'use client';

import { useState, useEffect } from 'react';
import { API_URL, getHeaders } from '../../app/api';
import { Conversation } from './types';

type Client = {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    contacts?: any[];
};

type NewChatModalProps = {
    isOpen: boolean;
    onClose: () => void;
    conversations: Conversation[];
    onConversationFound: (conv: Conversation, isNew: boolean) => void;
    showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
};

export default function NewChatModal({
    isOpen,
    onClose,
    conversations,
    onConversationFound,
    showToast
}: NewChatModalProps) {
    const [phone, setPhone] = useState('');
    const [platform, setPlatform] = useState<'assistai' | 'whatsapp'>('assistai');
    const [initiating, setInitiating] = useState(false);
    const [activeTab, setActiveTab] = useState<'phone' | 'client'>('phone');

    // Client search
    const [clients, setClients] = useState<Client[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loadingClients, setLoadingClients] = useState(false);

    // Load clients when tab is selected
    useEffect(() => {
        if (isOpen && activeTab === 'client' && clients.length === 0) {
            loadClients();
        }
    }, [isOpen, activeTab]);

    const loadClients = async () => {
        setLoadingClients(true);
        try {
            const res = await fetch(`${API_URL}/customers`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setClients(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingClients(false);
        }
    };

    const handleInitiate = async (phoneToUse?: string) => {
        const targetPhone = phoneToUse || phone.trim();
        if (!targetPhone) {
            showToast('Ingresa un número de teléfono', 'error');
            return;
        }
        setInitiating(true);
        try {
            const res = await fetch(`${API_URL}/conversations/lookup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify({ phone: targetPhone, platform })
            });
            const data = await res.json();

            if (res.ok && data.found) {
                const existing = conversations.find(c => c.sessionId === data.sessionId);
                if (existing) {
                    onConversationFound(existing, false);
                } else {
                    onConversationFound(data.conversation, true);
                }
                onClose();
                setPhone('');
                setSearchTerm('');
                showToast('Conversación abierta', 'success');
            } else {
                showToast(data.error || 'No se encontró conversación. Asegúrate que el cliente haya escrito antes.', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Error iniciando chat', 'error');
        } finally {
            setInitiating(false);
        }
    };

    const handleSelectClient = (client: Client) => {
        // Try to find a phone number from the client
        const phoneContact = client.contacts?.find((c: any) =>
            c.type?.toLowerCase() === 'phone' ||
            c.type?.toLowerCase() === 'whatsapp'
        );
        const clientPhone = phoneContact?.value || client.phone;

        if (!clientPhone) {
            showToast(`${client.name} no tiene teléfono registrado`, 'error');
            return;
        }

        // Initiate chat with this phone
        handleInitiate(clientPhone);
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">✨ Nuevo Chat</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                    <button
                        onClick={() => setActiveTab('phone')}
                        className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'phone'
                                ? 'text-emerald-600 border-b-2 border-emerald-600'
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        📱 Por Teléfono
                    </button>
                    <button
                        onClick={() => setActiveTab('client')}
                        className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'client'
                                ? 'text-emerald-600 border-b-2 border-emerald-600'
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        👤 Por Cliente
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {activeTab === 'phone' ? (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Plataforma</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPlatform('assistai')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${platform === 'assistai' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                                    >
                                        🤖 AssistAI
                                    </button>
                                    <button
                                        onClick={() => setPlatform('whatsapp')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${platform === 'whatsapp' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
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
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-medium"
                                    autoFocus
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Incluye el código de país (ej. +58)</p>
                            </div>

                            <button
                                onClick={() => handleInitiate()}
                                disabled={initiating || !phone.trim()}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                            >
                                {initiating ? 'Buscando...' : 'Iniciar Conversación'}
                            </button>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Buscar Cliente</label>
                                <input
                                    type="text"
                                    placeholder="Nombre, email o teléfono..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-medium"
                                    autoFocus
                                />
                            </div>

                            <div className="max-h-64 overflow-y-auto space-y-2">
                                {loadingClients ? (
                                    <div className="text-center py-6 text-gray-400">
                                        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                        Cargando clientes...
                                    </div>
                                ) : filteredClients.length === 0 ? (
                                    <div className="text-center py-6 text-gray-400">
                                        {searchTerm ? 'No se encontraron clientes' : 'Sin clientes registrados'}
                                    </div>
                                ) : (
                                    filteredClients.slice(0, 10).map(client => (
                                        <button
                                            key={client.id}
                                            onClick={() => handleSelectClient(client)}
                                            disabled={initiating}
                                            className="w-full p-3 rounded-xl border border-gray-100 hover:bg-emerald-50 hover:border-emerald-200 transition-all flex items-center gap-3 text-left disabled:opacity-50"
                                        >
                                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold">
                                                {client.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-900 truncate">{client.name}</p>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {client.phone || client.email || 'Sin contacto'}
                                                </p>
                                            </div>
                                            {client.phone && (
                                                <span className="text-emerald-500 text-xs">💬</span>
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>

                            {filteredClients.length > 10 && (
                                <p className="text-xs text-gray-400 text-center">
                                    Mostrando 10 de {filteredClients.length} clientes. Usa el buscador para refinar.
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

