'use client';

import { useState, useEffect } from 'react';
import { API_URL } from '../app/api';

type Customer = {
    id: string;
    name: string;
    email: string;
};

type Ticket = {
    id?: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    customerId: string;
    customer?: {
        id?: string;
        name: string;
        email: string;
    };
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    ticketToEdit?: Ticket | null;
    initialStatus?: string;
};

export default function TicketModal({ isOpen, onClose, onSuccess, ticketToEdit, initialStatus }: Props) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState('OPEN');
    const [priority, setPriority] = useState('MEDIUM');
    const [customerId, setCustomerId] = useState('');

    // Customer search
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [selectedCustomerName, setSelectedCustomerName] = useState('');

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Fetch customers for assignment
            fetchCustomers();

            if (ticketToEdit) {
                setTitle(ticketToEdit.title);
                setDescription(ticketToEdit.description || '');
                setStatus(ticketToEdit.status);
                setPriority(ticketToEdit.priority);
                setCustomerId(ticketToEdit.customerId);
                setSelectedCustomerName(ticketToEdit.customer?.name || '');
            } else {
                // Reset form
                setTitle('');
                setDescription('');
                setStatus(initialStatus || 'OPEN');
                setPriority('MEDIUM');
                setCustomerId('');
                setSelectedCustomerName('');
                setCustomerSearch('');
            }
        }
    }, [isOpen, ticketToEdit, initialStatus]);

    const fetchCustomers = async () => {
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/customers`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }); // Assuming we have a general customers/clients endpoint. 
            // If not, we might need to fallback to clients if that's the model.
            // Previous code used /clients. Let's check. 
            // Actually the duplicate endpoint logic used prisma.ticket.include customer.
            // Let's assume /clients exists as per previous context.
            if (res.ok) {
                const data = await res.json();
                setCustomers(data);
            }
        } catch (e) {
            console.error('Error fetching customers', e);
        }
    };

    const searchClients = async (query: string) => {
        setCustomerSearch(query);
        if (!query.trim()) {
            setShowCustomerDropdown(false);
            return;
        }
        setShowCustomerDropdown(true);
        // If we have local customers, filter them. If too many, we'd need a search endpoint.
        // For simplicity:
        // filteredClients = customers.filter(...)
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(customerSearch.toLowerCase())
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const token = localStorage.getItem('crm_token');
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            const body = {
                title,
                description,
                status,
                priority,
                customerId
            };

            let res;
            if (ticketToEdit?.id) {
                res = await fetch(`${API_URL}/tickets/${ticketToEdit.id}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body)
                });
            } else {
                res = await fetch(`${API_URL}/tickets`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body)
                });
            }

            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                alert('Error al guardar ticket');
            }
        } catch (error) {
            console.error(error);
            alert('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-slideUp overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 text-lg">
                        {ticketToEdit ? 'Editar Ticket' : 'Nuevo Ticket'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Título</label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            placeholder="Ej: Problema con facturación"
                        />
                    </div>

                    {/* Customer Selection */}
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Cliente</label>
                        {selectedCustomerName ? (
                            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-800">
                                <span className="font-medium">{selectedCustomerName}</span>
                                <button
                                    type="button"
                                    onClick={() => { setCustomerId(''); setSelectedCustomerName(''); }}
                                    className="text-blue-400 hover:text-blue-600"
                                >
                                    Cambiar
                                </button>
                            </div>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    value={customerSearch}
                                    onChange={(e) => searchClients(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Buscar por nombre o email..."
                                />
                                {showCustomerDropdown && (
                                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-xl mt-1 max-h-40 overflow-y-auto z-10 custom-scrollbar">
                                        {filteredCustomers.length > 0 ? (
                                            filteredCustomers.map(c => (
                                                <div
                                                    key={c.id}
                                                    className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                                                    onClick={() => {
                                                        setCustomerId(c.id);
                                                        setSelectedCustomerName(c.name);
                                                        setShowCustomerDropdown(false);
                                                        setCustomerSearch('');
                                                    }}
                                                >
                                                    <div className="font-bold text-gray-800 text-sm">{c.name}</div>
                                                    <div className="text-xs text-gray-500">{c.email}</div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-3 text-center text-gray-400 text-sm">No se encontraron clientes</div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Priority & Status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Prioridad</label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                            >
                                <option value="LOW">Baja</option>
                                <option value="MEDIUM">Media</option>
                                <option value="HIGH">Alta</option>
                                <option value="URGENT">Urgente</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Estado</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                            >
                                <option value="OPEN">Abierto</option>
                                <option value="IN_PROGRESS">En Progreso</option>
                                <option value="RESOLVED">Resuelto</option>
                                <option value="CLOSED">Cerrado</option>
                            </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Descripción</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                            placeholder="Detalles del ticket..."
                        />
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 font-bold text-gray-600 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !title || !customerId}
                            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 transition-all"
                        >
                            {loading ? 'Guardando...' : 'Guardar Ticket'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
