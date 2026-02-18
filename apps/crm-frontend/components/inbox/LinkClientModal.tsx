'use client';

import { useState } from 'react';
import { API_URL, getHeaders } from '../../app/api';

type LinkClientModalProps = {
    isOpen: boolean;
    onClose: () => void;
    customerContact: string;
    platform: string;
    sessionId: string;
    allClients: { id: string; name: string; email: string }[];
    onSuccess: (client: { id: string; name: string; contacts: any[] }) => void;
    showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
};

export default function LinkClientModal({
    isOpen,
    onClose,
    customerContact,
    platform,
    sessionId,
    allClients,
    onSuccess,
    showToast
}: LinkClientModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [linking, setLinking] = useState(false);

    const filteredClients = searchTerm.trim()
        ? allClients.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : allClients;

    const handleLink = async (clientId: string) => {
        setLinking(true);
        try {
            const res = await fetch(`${API_URL}/customers/${clientId}/contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify({
                    type: platform,
                    value: customerContact,
                    sessionId: sessionId
                })
            });

            if (res.ok) {
                const data = await res.json();
                onSuccess(data.client);
                onClose();
                setSearchTerm('');
                showToast(`Contacto vinculado a ${data.client.name}`, 'success');
            } else {
                showToast('Error al vincular contacto', 'error');
            }
        } catch (err) {
            console.error('Error linking contact:', err);
            showToast('Error de conexión', 'error');
        } finally {
            setLinking(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">🔗 Vincular a Cliente Existente</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>
                <div className="p-5">
                    <p className="text-sm text-gray-600 mb-4">
                        Busca un cliente existente para vincular el contacto
                        <span className="font-bold text-gray-800 ml-1">{customerContact}</span>
                    </p>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
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
                                    onClick={() => handleLink(client.id)}
                                    disabled={linking}
                                    className="w-full p-3 text-left bg-gray-50 hover:bg-amber-50 hover:border-amber-200 border border-gray-200 rounded-xl transition-all flex items-center gap-3 disabled:opacity-50"
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
    );
}
