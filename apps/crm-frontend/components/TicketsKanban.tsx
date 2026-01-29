'use client';

import { useState, useEffect } from 'react';
import TicketModal from './TicketModal';

import { API_URL } from '../app/api';

type Ticket = {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    customerId: string;
    customer?: {
        name: string;
        email: string;
    };
    createdAt: string;
};

const STAGES = {
    'OPEN': { label: 'Abierto', color: 'bg-blue-50 text-blue-700 border-blue-100' },
    'IN_PROGRESS': { label: 'En Progreso', color: 'bg-amber-50 text-amber-700 border-amber-100' },
    'RESOLVED': { label: 'Resuelto', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    'CLOSED': { label: 'Cerrado', color: 'bg-gray-50 text-gray-500 border-gray-100' },
};

const PRIORITY_LABELS: Record<string, string> = {
    'LOW': 'Baja',
    'MEDIUM': 'Media',
    'HIGH': 'Alta',
    'URGENT': 'Urgente'
};

const PRIORITY_COLORS: Record<string, string> = {
    'LOW': 'bg-gray-100 text-gray-700',
    'MEDIUM': 'bg-blue-100 text-blue-700',
    'HIGH': 'bg-orange-100 text-orange-700',
    'URGENT': 'bg-red-100 text-red-700'
};

export default function TicketsKanban() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('crm_token');
            const headers: any = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_URL}/tickets`, { headers });
            if (res.ok) {
                const data = await res.json();
                setTickets(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('ticketId', id);
    };

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
        const id = e.dataTransfer.getData('ticketId');
        if (!id) return;

        // Optimistic update
        const originalTickets = [...tickets];
        const updatedTickets = tickets.map(t => t.id === id ? { ...t, status: newStatus } : t);
        setTickets(updatedTickets);

        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/tickets/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error('Failed to update');
        } catch (err) {
            console.error(err);
            setTickets(originalTickets); // Revert
            alert("Error actualizando el estado");
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const getTicketsByStatus = (status: string) => tickets.filter(t => t.status === status);

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col animate-fadeIn">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Tickets de Soporte</h2>
                    <p className="text-sm text-gray-500">Gestión de incidencias y solicitudes</p>
                </div>
                <button
                    onClick={() => { setEditingTicket(null); setShowModal(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors text-sm font-bold shadow-lg shadow-blue-500/20"
                >
                    + Nuevo Ticket
                </button>
            </div>

            {loading ? (
                <div className="text-center text-gray-400 mt-20">Cargando tickets...</div>
            ) : (
                <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
                    {Object.entries(STAGES).map(([status, config]) => (
                        <div
                            key={status}
                            className="w-80 flex-shrink-0 bg-gray-50 rounded-2xl flex flex-col max-h-full border border-gray-200/50"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, status)}
                        >
                            <div className={`p-4 border-b border-gray-100 rounded-t-2xl font-bold text-sm flex justify-between items-center bg-white sticky top-0 z-10`}>
                                <span className={`px-2 py-1 rounded-md text-xs ${config.color.replace('bg-', 'bg-opacity-20 ')}`}>
                                    {config.label}
                                </span>
                                <span className="text-gray-400 text-xs">{getTicketsByStatus(status).length}</span>
                            </div>

                            <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                {getTicketsByStatus(status).map(ticket => (
                                    <div
                                        key={ticket.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, ticket.id)}
                                        onClick={() => { setEditingTicket(ticket); setShowModal(true); }}
                                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md cursor-grab active:cursor-grabbing transition-all hover:border-blue-200 group"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-gray-800 text-sm line-clamp-2">{ticket.title}</h4>
                                        </div>

                                        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{ticket.description || 'Sin descripción'}</p>

                                        <div className="flex items-center gap-2 mb-3">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${PRIORITY_COLORS[ticket.priority] || 'bg-gray-100 text-gray-600'}`}>
                                                {PRIORITY_LABELS[ticket.priority] || ticket.priority}
                                            </span>
                                            {/* Send to Dev Button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('¿Enviar a ChronusDev?')) {
                                                        const token = localStorage.getItem('crm_token');
                                                        fetch(`${API_URL}/tickets/${ticket.id}/send-to-chronusdev`, {
                                                            method: 'POST',
                                                            headers: {
                                                                'Content-Type': 'application/json',
                                                                'Authorization': `Bearer ${token}`
                                                            },
                                                            body: JSON.stringify({})
                                                        }).then(res => {
                                                            if (res.ok) {
                                                                alert('Enviado a desarrollo');
                                                                fetchTickets();
                                                            } else {
                                                                alert('Error enviando a desarrollo');
                                                            }
                                                        });
                                                    }
                                                }}
                                                className="ml-auto text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 transition-colors"
                                                title="Crear tarea en ChronusDev"
                                            >
                                                🚀 Dev
                                            </button>
                                        </div>

                                        <div className="border-t border-gray-50 pt-2 mt-2 flex justify-between items-center">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-[10px] font-bold text-white">
                                                    {ticket.customer?.name?.charAt(0) || '?'}
                                                </div>
                                                <span className="text-xs text-gray-600 font-medium truncate max-w-[100px]" title={ticket.customer?.email}>
                                                    {ticket.customer?.name || 'Desconocido'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(ticket.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <TicketModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={fetchTickets}
                ticketToEdit={editingTicket}
            />
        </div>
    );
}
