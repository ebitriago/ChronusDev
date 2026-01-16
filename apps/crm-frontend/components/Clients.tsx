'use client';

import { useState, useEffect } from 'react';
import { getClients, createClient, updateClient, deleteClient, type Client } from '../app/api';
import { useToast } from './Toast';
import { Skeleton } from './Skeleton';

export default function Clients() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [contactName, setContactName] = useState('');
    const [phone, setPhone] = useState('');

    const { showToast } = useToast();

    useEffect(() => {
        loadClients();
    }, []);

    async function loadClients() {
        try {
            setLoading(true);
            const data = await getClients();
            setClients(data);
        } catch (err: any) {
            setError(err.message || 'Error loading clients');
        } finally {
            setLoading(false);
        }
    }

    function handleEdit(client: Client) {
        setEditingClient(client);
        setName(client.name);
        setEmail(client.email || '');
        setContactName(client.contactName || '');
        setPhone(client.phone || '');
        setShowModal(true);
    }

    function handleNew() {
        setEditingClient(null);
        setName('');
        setEmail('');
        setContactName('');
        setPhone('');
        setShowModal(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            if (editingClient) {
                // Edit
                const updated = await updateClient(editingClient.id, { name, email, contactName, phone });
                setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
                showToast('Cliente actualizado', 'success');
            } else {
                // Create
                const created = await createClient({ name, email, contactName, phone });
                setClients(prev => [...prev, created]);
                showToast('Cliente creado', 'success');
            }
            setShowModal(false);
        } catch (err: any) {
            console.error(err);
            showToast('Error al guardar cliente', 'error');
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Estás seguro de eliminar este cliente?')) return;
        try {
            await deleteClient(id);
            setClients(prev => prev.filter(c => c.id !== id));
            showToast('Cliente eliminado', 'info');
        } catch (err) {
            showToast('Error al eliminar', 'error');
        }
    }

    if (loading) return (
        <div className="p-6 max-w-7xl mx-auto space-y-4">
            <Skeleton height="40px" width="200px" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => <Skeleton key={i} height="150px" variant="rect" />)}
            </div>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto animate-fadeIn">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Clientes</h2>
                    <p className="text-gray-500 dark:text-gray-400">Gestiona las empresas para las que trabajas</p>
                </div>
                <button
                    onClick={handleNew}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors shadow-lg shadow-blue-500/30 flex items-center gap-2"
                >
                    <span>+</span> Nuevo Cliente
                </button>
            </div>

            {clients.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700">
                    <p className="text-gray-500 dark:text-gray-400">No hay clientes aún. ¡Crea el primero!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clients.map(client => (
                        <div key={client.id} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow group relative">
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(client)} className="text-blue-500 hover:text-blue-700 mr-2">✏️</button>
                                <button onClick={() => handleDelete(client.id)} className="text-red-500 hover:text-red-700">🗑️</button>
                            </div>

                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center text-white text-xl font-bold mb-4 shadow-lg shadow-emerald-500/20">
                                {client.name.charAt(0).toUpperCase()}
                            </div>

                            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{client.name}</h3>

                            <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                                {client.contactName && (
                                    <div className="flex items-center gap-2">
                                        <span className="w-4 text-center">👤</span> {client.contactName}
                                    </div>
                                )}
                                {client.email && (
                                    <div className="flex items-center gap-2">
                                        <span className="w-4 text-center">✉️</span> {client.email}
                                    </div>
                                )}
                                {client.phone && (
                                    <div className="flex items-center gap-2">
                                        <span className="w-4 text-center">📞</span> {client.phone}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre Empresa *</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="Ej: Acme Corp"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contacto Principal</label>
                                <input
                                    type="text"
                                    value={contactName}
                                    onChange={e => setContactName(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="Ej: John Doe"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="contacto@empresa.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="+1 234 567 890"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-xl hover:shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
