'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { API_URL } from '../app/api';
import AdminBroadcast from './AdminBroadcast';

type NotificationPreferences = {
    email: boolean;
    push: boolean;
    whatsapp: boolean;
};

export default function NotificationSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const { showToast } = useToast();
    const [prefs, setPrefs] = useState<NotificationPreferences>({
        email: true,
        push: true,
        whatsapp: true
    });

    useEffect(() => {
        fetchPrefs();
        // Check if user is admin
        try {
            const userStr = localStorage.getItem('crm_user');
            if (userStr) {
                const user = JSON.parse(userStr);
                setIsAdmin(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');
            }
        } catch (e) { }
    }, []);

    const fetchPrefs = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/notifications/preferences`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setPrefs({
                    email: data.email,
                    push: data.push,
                    whatsapp: data.whatsapp
                });
            }
        } catch (err) {
            console.error(err);
            showToast('Error cargando preferencias', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (newPrefs: NotificationPreferences) => {
        setSaving(true);
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/notifications/preferences`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newPrefs)
            });

            if (res.ok) {
                const data = await res.json();
                setPrefs({
                    email: data.email,
                    push: data.push,
                    whatsapp: data.whatsapp
                });
                showToast('Preferencias actualizadas', 'success');
            } else {
                throw new Error('Error saving');
            }
        } catch (err) {
            console.error(err);
            showToast('Error guardando cambios', 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggle = (key: keyof NotificationPreferences) => {
        const newPrefs = { ...prefs, [key]: !prefs[key] };
        setPrefs(newPrefs);
        handleSave(newPrefs);
    };

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Cargando notificaciones...</div>;

    const channels = [
        { id: 'email', label: 'Email', desc: 'Recibir notificaciones importanes por correo electrónico', icon: '📧' },
        { id: 'push', label: 'Push Notifications', desc: 'Notificaciones en el navegador y móvil', icon: '🔔' },
        { id: 'whatsapp', label: 'WhatsApp', desc: 'Recibir alertas críticas por WhatsApp', icon: '📱' },
    ];

    return (
        <div className="space-y-8">
            {/* Preferences */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-4xl animate-fadeIn">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Preferencias de Notificación</h2>
                <p className="text-gray-500 mb-8">Elige cómo y cuándo quieres que te contactemos.</p>

                <div className="space-y-6">
                    {channels.map((channel) => (
                        <div key={channel.id} className="flex items-start justify-between p-4 border rounded-xl hover:border-emerald-200 hover:bg-emerald-50/10 transition-colors">
                            <div className="flex gap-4">
                                <div className="text-2xl pt-1">{channel.icon}</div>
                                <div>
                                    <h3 className="font-semibold text-gray-800">{channel.label}</h3>
                                    <p className="text-sm text-gray-500">{channel.desc}</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={prefs[channel.id as keyof NotificationPreferences]}
                                    onChange={() => toggle(channel.id as keyof NotificationPreferences)}
                                    disabled={saving}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                        </div>
                    ))}
                </div>

                <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3 text-sm text-blue-700">
                    <span>ℹ️</span>
                    <p>
                        <strong>Nota:</strong> Algunas notificaciones del sistema (como restablecimiento de contraseña)
                        se enviarán independientemente de estas configuraciones por seguridad.
                    </p>
                </div>
            </div>

            {/* Admin Broadcast — only visible to admins */}
            {isAdmin && (
                <div className="max-w-4xl">
                    <AdminBroadcast />
                </div>
            )}
        </div>
    );
}
