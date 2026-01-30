'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { API_URL } from '../app/api';

type Contact = {
    id: string;
    type: 'whatsapp' | 'instagram' | 'phone' | 'email';
    value: string;
};

type Ticket = {
    id: string;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
};

type Note = {
    id: string;
    content: string;
    createdAt: string;
};

type ClientData = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    company?: string;
    plan?: string;
    status?: string;
    notes?: string;
    contacts: Contact[];
    tickets: Ticket[];
    invoices: any[];
    communications: any[];
};

type Props = {
    clientId: string;
    onClose: () => void;
    onOpenChat?: (contactValue: string) => void;
};

export default function ClientProfile({ clientId, onClose, onOpenChat }: Props) {
    const [client, setClient] = useState<ClientData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'info' | 'tickets' | 'notes' | 'invoices'>('info');
    const { showToast } = useToast();

    // Form states
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', company: '', notes: '' });
    const [newNote, setNewNote] = useState('');
    const [showTicketForm, setShowTicketForm] = useState(false);
    const [newTicket, setNewTicket] = useState({ title: '', description: '', priority: 'MEDIUM' });

    useEffect(() => {
        fetchClientData();
    }, [clientId]);

    async function fetchClientData() {
        try {
            const res = await fetch(`${API_URL}/customers/${clientId}`);
            if (res.ok) {
                const data = await res.json();
                setClient(data);
                setEditForm({
                    name: data.name || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    company: data.company || '',
                    notes: data.notes || ''
                });
            }
        } catch (err) {
            console.error('Error fetching client:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveEdit() {
        try {
            const res = await fetch(`${API_URL}/customers/${clientId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });
            if (res.ok) {
                const updated = await res.json();
                setClient(prev => prev ? { ...prev, ...updated } : null);
                setIsEditing(false);
                showToast('Cliente actualizado', 'success');
            }
        } catch (err) {
            showToast('Error al guardar', 'error');
        }
    }

    async function handleCreateTicket() {
        if (!newTicket.title) return;
        try {
            const res = await fetch(`${API_URL}/tickets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newTicket,
                    customerId: clientId
                })
            });
            if (res.ok) {
                const ticket = await res.json();
                setClient(prev => prev ? { ...prev, tickets: [...(prev.tickets || []), ticket] } : null);
                setNewTicket({ title: '', description: '', priority: 'MEDIUM' });
                setShowTicketForm(false);
                showToast('Ticket creado', 'success');
            }
        } catch (err) {
            showToast('Error al crear ticket', 'error');
        }
    }

    async function handleCreateChronusTask() {
        try {
            const res = await fetch(`${API_URL}/customers/${clientId}/chronus-task`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Tarea para ${client?.name}`,
                    description: `Tarea creada desde CRM para el cliente ${client?.name}`
                })
            });
            if (res.ok) {
                showToast('Tarea enviada a ChronusDev', 'success');
            } else {
                showToast('Error al crear tarea', 'error');
            }
        } catch (err) {
            showToast('Error de conexión', 'error');
        }
    }

    const platformIcons: Record<string, string> = {
        whatsapp: '📱',
        instagram: '📸',
        phone: '📞',
        email: '✉️'
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-2xl p-8">
                    <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto"></div>
                </div>
            </div>
        );
    }

    if (!client) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-bold backdrop-blur">
                                {client.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">{client.name}</h2>
                                <p className="text-emerald-100">{client.email}</p>
                                <div className="flex gap-2 mt-2">
                                    {client.plan && (
                                        <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-bold">{client.plan}</span>
                                    )}
                                    {client.status && (
                                        <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-bold">{client.status}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">✕</button>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2 mt-4 flex-wrap">
                        {client.contacts?.length > 0 && (
                            <button
                                onClick={() => onOpenChat?.(client.contacts[0].value)}
                                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                            >
                                💬 Abrir Chat
                            </button>
                        )}
                        <button
                            onClick={() => setShowTicketForm(true)}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                        >
                            🎫 Crear Ticket
                        </button>
                        <button
                            onClick={handleCreateChronusTask}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                        >
                            📋 Crear Tarea ChronusDev
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 bg-gray-50">
                    {(['info', 'tickets', 'notes', 'invoices'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 px-4 py-3 text-sm font-bold transition-colors ${activeTab === tab
                                ? 'text-emerald-600 border-b-2 border-emerald-600 bg-white'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {tab === 'info' && '👤 Información'}
                            {tab === 'tickets' && `🎫 Tickets (${client.tickets?.length || 0})`}
                            {tab === 'notes' && '📝 Notas'}
                            {tab === 'invoices' && `💰 Facturas (${client.invoices?.length || 0})`}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'info' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Contact Channels */}
                            <div className="bg-gray-50 rounded-xl p-4">
                                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    📱 Canales de Contacto
                                </h3>
                                <div className="space-y-2">
                                    {client.contacts?.length > 0 ? (
                                        client.contacts.map(contact => (
                                            <div key={contact.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200">
                                                <span>{platformIcons[contact.type] || '📞'}</span>
                                                <span className="text-sm text-gray-700">{contact.value}</span>
                                                <span className="text-xs text-gray-400 ml-auto">{contact.type}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-400 text-sm">Sin canales vinculados</p>
                                    )}
                                </div>
                            </div>

                            {/* Edit Form */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-gray-800">Datos del Cliente</h3>
                                    <button
                                        onClick={() => isEditing ? handleSaveEdit() : setIsEditing(true)}
                                        className={`text-sm font-bold px-3 py-1 rounded-lg transition-colors ${isEditing
                                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                            : 'text-emerald-600 hover:bg-emerald-50'
                                            }`}
                                    >
                                        {isEditing ? '💾 Guardar' : '✏️ Editar'}
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <input
                                        disabled={!isEditing}
                                        value={editForm.name}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                                        placeholder="Nombre"
                                    />
                                    <input
                                        disabled={!isEditing}
                                        value={editForm.email}
                                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                                        placeholder="Email"
                                    />
                                    <input
                                        disabled={!isEditing}
                                        value={editForm.phone}
                                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                                        placeholder="Teléfono"
                                    />
                                    <input
                                        disabled={!isEditing}
                                        value={editForm.company}
                                        onChange={e => setEditForm({ ...editForm, company: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                                        placeholder="Empresa"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'tickets' && (
                        <div className="space-y-4">
                            {showTicketForm && (
                                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                                    <h4 className="font-bold text-blue-800 mb-3">Nuevo Ticket</h4>
                                    <input
                                        value={newTicket.title}
                                        onChange={e => setNewTicket({ ...newTicket, title: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-blue-200 text-sm mb-2"
                                        placeholder="Título del ticket"
                                    />
                                    <textarea
                                        value={newTicket.description}
                                        onChange={e => setNewTicket({ ...newTicket, description: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-blue-200 text-sm mb-2 resize-none"
                                        rows={3}
                                        placeholder="Descripción"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCreateTicket}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
                                        >
                                            Crear Ticket
                                        </button>
                                        <button
                                            onClick={() => setShowTicketForm(false)}
                                            className="px-4 py-2 text-gray-600 text-sm"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {client.tickets?.length > 0 ? (
                                <div className="space-y-2">
                                    {client.tickets.map(ticket => (
                                        <div key={ticket.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-gray-800">{ticket.title}</p>
                                                <p className="text-xs text-gray-500">#{ticket.id}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-1 text-xs font-bold rounded ${ticket.status === 'OPEN' ? 'bg-red-100 text-red-700' :
                                                    ticket.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-green-100 text-green-700'
                                                    }`}>
                                                    {ticket.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <p>No hay tickets para este cliente</p>
                                    <button
                                        onClick={() => setShowTicketForm(true)}
                                        className="mt-2 text-emerald-600 font-bold text-sm"
                                    >
                                        + Crear primer ticket
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div className="space-y-4">
                            <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                                <h4 className="font-bold text-yellow-800 mb-2">Notas del Cliente</h4>
                                <textarea
                                    value={editForm.notes}
                                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                    className="w-full px-4 py-3 rounded-lg border border-yellow-200 text-sm resize-none"
                                    rows={6}
                                    placeholder="Escribe notas sobre este cliente..."
                                />
                                <button
                                    onClick={handleSaveEdit}
                                    className="mt-2 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-bold hover:bg-yellow-600"
                                >
                                    💾 Guardar Notas
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'invoices' && (
                        <div className="space-y-4">
                            {client.invoices?.length > 0 ? (
                                client.invoices.map((inv: any) => (
                                    <div key={inv.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex justify-between">
                                        <div>
                                            <p className="font-bold text-gray-800">{inv.concept || 'Factura'}</p>
                                            <p className="text-xs text-gray-500">#{inv.id}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-gray-800">${inv.amount?.toFixed(2)}</p>
                                            <span className={`px-2 py-0.5 text-xs font-bold rounded ${inv.status === 'PAID' ? 'bg-green-100 text-green-700' :
                                                inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {inv.status}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <p>No hay facturas para este cliente</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
