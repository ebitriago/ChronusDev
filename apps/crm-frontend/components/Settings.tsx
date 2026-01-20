'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import WhatsAppConfig from './WhatsAppConfig';
import Integrations from './Integrations';

const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://127.0.0.1:3002';

type Tag = {
    id: string;
    name: string;
    color: string;
    category: 'lead' | 'customer' | 'ticket' | 'general';
    createdAt: string;
};

export default function Settings() {
    const [activeTab, setActiveTab] = useState<'profile' | 'tags' | 'whatsapp' | 'integrations' | 'notifications'>('profile');
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(false);
    const [showTagModal, setShowTagModal] = useState(false);
    const [newTag, setNewTag] = useState({ name: '', color: '#10b981', category: 'general' as const });
    const { showToast } = useToast();

    // Profile settings (local storage simulation)
    const [profile, setProfile] = useState({
        companyName: 'Mi Empresa',
        email: 'admin@miempresa.com',
        timezone: 'America/Caracas',
        language: 'es',
        currency: 'USD'
    });

    useEffect(() => {
        if (activeTab === 'tags') {
            fetchTags();
        }
        // Load profile from localStorage
        const saved = localStorage.getItem('crm_profile_settings');
        if (saved) {
            setProfile(JSON.parse(saved));
        }
    }, [activeTab]);

    const fetchTags = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/tags`);
            if (res.ok) {
                const data = await res.json();
                setTags(data);
            }
        } catch (err) {
            console.error('Error loading tags:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTag = async () => {
        if (!newTag.name) return;
        try {
            const res = await fetch(`${API_URL}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTag)
            });
            if (res.ok) {
                setShowTagModal(false);
                setNewTag({ name: '', color: '#10b981', category: 'general' });
                fetchTags();
                showToast('Tag creado exitosamente', 'success');
            }
        } catch (err) {
            console.error(err);
            showToast('Error creando tag', 'error');
        }
    };

    const handleDeleteTag = async (id: string) => {
        if (!confirm('¿Eliminar este tag?')) return;
        try {
            const res = await fetch(`${API_URL}/tags/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchTags();
                showToast('Tag eliminado', 'success');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveProfile = () => {
        localStorage.setItem('crm_profile_settings', JSON.stringify(profile));
        showToast('Configuración guardada', 'success');
    };

    const colorOptions = [
        '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
        '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
        '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
        '#ec4899', '#f43f5e'
    ];

    return (
        <div className="animate-fadeIn">
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                {[
                    { id: 'profile', label: 'Perfil', icon: '👤' },
                    { id: 'tags', label: 'Etiquetas', icon: '🏷️' },
                    { id: 'integrations', label: 'Integraciones', icon: '🔌' },
                    { id: 'whatsapp', label: 'WhatsApp', icon: '📱' },
                    { id: 'notifications', label: 'Notificaciones', icon: '🔔' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${activeTab === tab.id
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                            }`}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Profile Tab */}
            {activeTab === 'profile' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
                    <h3 className="text-lg font-bold text-gray-900">Configuración de la Cuenta</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Empresa</label>
                            <input
                                type="text"
                                value={profile.companyName}
                                onChange={e => setProfile({ ...profile, companyName: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                value={profile.email}
                                onChange={e => setProfile({ ...profile, email: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Zona Horaria</label>
                            <select
                                value={profile.timezone}
                                onChange={e => setProfile({ ...profile, timezone: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                            >
                                <option value="America/Caracas">Venezuela (GMT-4)</option>
                                <option value="America/New_York">Eastern Time (GMT-5)</option>
                                <option value="America/Mexico_City">Mexico City (GMT-6)</option>
                                <option value="America/Bogota">Colombia (GMT-5)</option>
                                <option value="Europe/Madrid">España (GMT+1)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                            <select
                                value={profile.currency}
                                onChange={e => setProfile({ ...profile, currency: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                            >
                                <option value="USD">USD - Dólar Americano</option>
                                <option value="EUR">EUR - Euro</option>
                                <option value="MXN">MXN - Peso Mexicano</option>
                                <option value="COP">COP - Peso Colombiano</option>
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveProfile}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-bold transition-colors shadow-lg shadow-emerald-500/20"
                    >
                        Guardar Cambios
                    </button>
                </div>
            )}

            {/* Tags Tab */}
            {activeTab === 'tags' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Gestión de Etiquetas</h3>
                            <p className="text-sm text-gray-500">Crea y organiza etiquetas para clientes, leads y tickets</p>
                        </div>
                        <button
                            onClick={() => setShowTagModal(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20"
                        >
                            + Nueva Etiqueta
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-center py-10 text-gray-400">Cargando...</div>
                    ) : (
                        <div className="space-y-2">
                            {['lead', 'customer', 'ticket', 'general'].map(category => {
                                const categoryTags = tags.filter(t => t.category === category);
                                if (categoryTags.length === 0) return null;
                                return (
                                    <div key={category} className="mb-4">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                            {category === 'lead' ? '🎯 Leads' :
                                                category === 'customer' ? '👥 Clientes' :
                                                    category === 'ticket' ? '🎫 Tickets' : '📁 General'}
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {categoryTags.map(tag => (
                                                <div
                                                    key={tag.id}
                                                    className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 group"
                                                >
                                                    <div
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: tag.color }}
                                                    />
                                                    <span className="text-sm font-medium text-gray-700">{tag.name}</span>
                                                    <button
                                                        onClick={() => handleDeleteTag(tag.id)}
                                                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Integrations Tab */}
            {activeTab === 'integrations' && <Integrations />}

            {/* WhatsApp Tab */}
            {activeTab === 'whatsapp' && <WhatsAppConfig />}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Preferencias de Notificaciones</h3>

                    <div className="space-y-4">
                        {[
                            { id: 'new_ticket', label: 'Nuevo ticket creado', desc: 'Recibir notificación cuando se crea un ticket' },
                            { id: 'new_message', label: 'Nuevo mensaje en Inbox', desc: 'Notificar mensajes entrantes de WhatsApp/Instagram' },
                            { id: 'lead_hot', label: 'Lead caliente detectado', desc: 'Alertar cuando un lead tiene score alto' },
                            { id: 'churn_risk', label: 'Riesgo de churn', desc: 'Avisar cuando un cliente está en riesgo' },
                        ].map(item => (
                            <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                <div>
                                    <p className="font-medium text-gray-900">{item.label}</p>
                                    <p className="text-sm text-gray-500">{item.desc}</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" defaultChecked className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Tag Modal */}
            {showTagModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Nueva Etiqueta</h3>
                            <button onClick={() => setShowTagModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={newTag.name}
                                    onChange={e => setNewTag({ ...newTag, name: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                    placeholder="Ej: VIP, Urgente, Hot Lead..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {colorOptions.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setNewTag({ ...newTag, color })}
                                            className={`w-8 h-8 rounded-lg transition-transform ${newTag.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                                <select
                                    value={newTag.category}
                                    onChange={e => setNewTag({ ...newTag, category: e.target.value as any })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                                >
                                    <option value="general">General</option>
                                    <option value="lead">Leads</option>
                                    <option value="customer">Clientes</option>
                                    <option value="ticket">Tickets</option>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowTagModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreateTag}
                                    disabled={!newTag.name}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold transition-colors"
                                >
                                    Crear Etiqueta
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
