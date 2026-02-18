'use client';

import { useState, useEffect } from 'react';
import { API_URL, Tag } from '../app/api';
import { useToast } from './Toast';

export default function TagsSettings() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [newTag, setNewTag] = useState({ name: '', color: '#10b981', category: 'general' });
    const { showToast } = useToast();

    useEffect(() => {
        fetchTags();
    }, []);

    const fetchTags = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/tags`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTags(data);
            }
        } catch (error) {
            console.error(error);
            showToast('Error al cargar etiquetas', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTag = async () => {
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/tags`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newTag)
            });

            if (res.ok) {
                const tag = await res.json();
                setTags([...tags, tag]);
                setShowModal(false);
                setNewTag({ name: '', color: '#10b981', category: 'general' });
                showToast('Etiqueta creada', 'success');
            }
        } catch (error) {
            showToast('Error creando etiqueta', 'error');
        }
    };

    const handleDeleteTag = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta etiqueta?')) return;
        try {
            const token = localStorage.getItem('crm_token');
            await fetch(`${API_URL}/tags/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setTags(tags.filter(t => t.id !== id));
            showToast('Etiqueta eliminada', 'success');
        } catch (error) {
            showToast('Error eliminando etiqueta', 'error');
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-4xl animate-fadeIn">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Etiquetas</h2>
                    <p className="text-gray-500 text-sm">Organiza tus clientes y tickets con etiquetas personalizadas.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                    <span>+</span> Nueva Etiqueta
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Cargando etiquetas...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tags.map(tag => (
                        <div key={tag.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-gray-50/50 hover:bg-white hover:shadow-sm transition-all group">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-4 h-4 rounded-full shadow-sm"
                                    style={{ backgroundColor: tag.color }}
                                />
                                <span className="font-medium text-gray-700">{tag.name}</span>
                            </div>
                            <button
                                onClick={() => handleDeleteTag(tag.id)}
                                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                title="Eliminar"
                            >
                                🗑️
                            </button>
                        </div>
                    ))}
                    {tags.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                            <p className="text-gray-400">No hay etiquetas creadas aún.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-scaleIn">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Nueva Etiqueta</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={newTag.name}
                                    onChange={e => setNewTag({ ...newTag, name: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    placeholder="Ej: VIP"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                                <div className="flex gap-2 flex-wrap">
                                    {['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'].map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setNewTag({ ...newTag, color })}
                                            className={`w-8 h-8 rounded-full transition-transform ${newTag.color === color ? 'scale-110 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-105'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateTag}
                                disabled={!newTag.name}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                Crear Etiqueta
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
