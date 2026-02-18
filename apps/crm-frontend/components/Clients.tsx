'use client';

import { useState, useEffect } from 'react';
import { getClients, createClient, updateClient, deleteClient, type Client, API_URL } from '../app/api';
import { useToast } from './Toast';
import { Skeleton } from './Skeleton';
import TagInput from './TagInput';

export default function Clients() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);

    // Filter State
    const [filterTags, setFilterTags] = useState<string[]>([]);
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [showTagFilter, setShowTagFilter] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [contactName, setContactName] = useState('');
    const [phone, setPhone] = useState('');
    const [tags, setTags] = useState<string[]>([]);

    const { showToast } = useToast();

    useEffect(() => {
        loadClients();
        fetchTags();
    }, [filterTags]);

    async function fetchTags() {
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/tags`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAvailableTags(data.map((t: any) => t.name));
            }
        } catch (e) {
            console.error("Error fetching tags", e);
        }
    }

    async function loadClients() {
        try {
            setLoading(true);
            // Custom fetch to support filtering, bypassing getClients simple wrapper if needed, 
            // or we could update getClients. For now, let's call API directly to add query params easily
            // or just use the same pattern as LeadsKanban
            const token = localStorage.getItem('crm_token');
            const query = filterTags.length > 0 ? `?tags=${filterTags.join(',')}` : '';
            const res = await fetch(`${API_URL}/clients${query}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Error cargando clientes');
            const data = await res.json();
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
        setTags(client.tags || []);
        setShowModal(true);
    }

    function handleNew() {
        setEditingClient(null);
        setName('');
        setEmail('');
        setContactName('');
        setPhone('');
        setTags([]);
        setShowModal(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            if (editingClient) {
                // Edit
                const updated = await updateClient(editingClient.id, { name, email, contactName, phone, tags });
                setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
                showToast('Cliente actualizado', 'success');
            } else {
                // Create
                const created = await createClient({ name, email, contactName, phone, tags });
                setClients(prev => [...prev, created]);
                showToast('Cliente creado', 'success');
            }
            setShowModal(false);
        } catch (err: any) {
            console.error(err);
            showToast(err.message || 'Error al guardar cliente', 'error');
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
                <div className="flex gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setShowTagFilter(!showTagFilter)}
                            className={`px-3 py-2 rounded-xl text-sm font-medium border flex items-center gap-2 transition-colors ${filterTags.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50'}`}
                        >
                            🏷️ Filtrar {filterTags.length > 0 && `(${filterTags.length})`}
                        </button>

                        {showTagFilter && (
                            <div className="absolute top-full mt-2 right-0 z-20 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-xl w-64 p-2 animate-fadeIn">
                                <div className="flex flex-wrap gap-1 max-h-60 overflow-y-auto">
                                    {availableTags.map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => {
                                                if (filterTags.includes(tag)) {
                                                    setFilterTags(filterTags.filter(t => t !== tag));
                                                } else {
                                                    setFilterTags([...filterTags, tag]);
                                                }
                                            }}
                                            className={`px-2 py-1 rounded text-xs font-medium border ${filterTags.includes(tag) ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-slate-600'}`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                    {availableTags.length === 0 && <span className="text-xs text-gray-400 p-2">No hay etiquetas disponibles</span>}
                                </div>
                                {filterTags.length > 0 && (
                                    <button
                                        onClick={() => setFilterTags([])}
                                        className="w-full text-center text-xs text-red-500 mt-2 hover:underline"
                                    >
                                        Limpiar filtros
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleNew}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors shadow-lg shadow-blue-500/30 flex items-center gap-2"
                    >
                        <span>+</span> Nuevo Cliente
                    </button>
                </div>
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
                                {client.tags && client.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-3 pt-2 border-t border-gray-100 dark:border-slate-700">
                                        {client.tags.map(tag => (
                                            <span key={tag} className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-xs font-medium">
                                                {tag}
                                            </span>
                                        ))}
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

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Etiquetas</label>
                                <TagInput
                                    selectedTags={tags}
                                    onChange={setTags}
                                    placeholder="Agregar etiqueta..."
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
