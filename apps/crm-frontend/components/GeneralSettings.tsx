'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { API_URL } from '../app/api';

export default function GeneralSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();

    // User Profile logic
    const [profile, setProfile] = useState({
        name: '',
        email: '',
        phone: '',
        avatar: '',
        role: ''
    });

    // Preferences (Local Storage)
    const [preferences, setPreferences] = useState({
        timezone: 'America/Caracas',
        language: 'es',
        currency: 'USD'
    });

    // Organization (Admin only)
    const [orgName, setOrgName] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('crm_token');
            const headers = { 'Authorization': `Bearer ${token}` };

            // 1. Fetch User Profile
            const userRes = await fetch(`${API_URL}/auth/me`, { headers });
            if (userRes.ok) {
                const data = await userRes.json();
                setProfile({
                    name: data.user.name || '',
                    email: data.user.email || '',
                    phone: data.user.phone || '',
                    avatar: data.user.avatar || '',
                    role: data.user.role || ''
                });
                setIsAdmin(data.user.role === 'ADMIN' || data.user.role === 'SUPER_ADMIN');

                // If Admin, try to fetch Org info (via organization list or just stored elsewhere?)
                // Since we don't have a direct GET /organization/profile, we might rely on the side-effect
                // of login or just assume the user knows the name, OR we can add GET.
                // For now, let's just use what we have or skip org name edit if we can't fetch it easily.
                // Wait, I can add GET /organization/profile easily or use /auth/me payload if I update it.
                // Let's check if stored in localStorage from login
                const userStr = localStorage.getItem('crm_user');
                if (userStr) {
                    const u = JSON.parse(userStr);
                    if (u.organization) setOrgName(u.organization.name);
                }
            }

            // 2. Load Preferences
            const savedPrefs = localStorage.getItem('crm_preferences');
            if (savedPrefs) {
                setPreferences(JSON.parse(savedPrefs));
            }

        } catch (err) {
            console.error(err);
            showToast('Error cargando perfil', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('crm_token');
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            // 1. Save User Profile
            const userRes = await fetch(`${API_URL}/auth/me`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    name: profile.name,
                    email: profile.email,
                    phone: profile.phone,
                    avatar: profile.avatar
                })
            });

            if (!userRes.ok) throw new Error('Error guardando perfil');

            // 2. Save Organization Name (if Admin and changed)
            if (isAdmin && orgName) {
                await fetch(`${API_URL}/organization/profile`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ name: orgName })
                });
            }

            // 3. Save Preferences
            localStorage.setItem('crm_preferences', JSON.stringify(preferences));

            showToast('Configuración guardada exitosamente', 'success');

            // Update local user object for other components
            const userStr = localStorage.getItem('crm_user');
            if (userStr) {
                const u = JSON.parse(userStr);
                u.name = profile.name;
                u.email = profile.email;
                if (orgName) u.organization.name = orgName;
                localStorage.setItem('crm_user', JSON.stringify(u));
                // Force reload to update UI components relying on localStorage? 
                // Better to just let them react or rely on context.
                window.dispatchEvent(new Event('storage'));
            }

        } catch (err) {
            console.error(err);
            showToast('Error al guardar cambios', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando perfil...</div>;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-4xl animate-fadeIn">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Configuración General</h2>

            {/* Profile Section */}
            <div className="space-y-8">
                <section>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Perfil de Usuario</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                            <input
                                type="text"
                                value={profile.name}
                                onChange={e => setProfile({ ...profile, name: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                value={profile.email}
                                onChange={e => setProfile({ ...profile, email: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                            <input
                                type="tel"
                                value={profile.phone}
                                onChange={e => setProfile({ ...profile, phone: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                            <input
                                type="text"
                                value={profile.role}
                                disabled
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Avatar</label>
                            <div className="flex items-center gap-4">
                                <div className="relative group cursor-pointer w-16 h-16 rounded-full overflow-hidden border border-gray-200">
                                    {profile.avatar ? (
                                        <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-2xl">👤</div>
                                    )}
                                    <div
                                        onClick={() => document.getElementById('avatar-upload')?.click()}
                                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <span className="text-white font-bold text-xs">Cambiar</span>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        id="avatar-upload"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;

                                            const formData = new FormData();
                                            formData.append('file', file);

                                            try {
                                                setSaving(true);
                                                const token = localStorage.getItem('crm_token');
                                                const res = await fetch(`${API_URL}/upload`, {
                                                    method: 'POST',
                                                    headers: { 'Authorization': `Bearer ${token}` },
                                                    body: formData
                                                });

                                                if (!res.ok) throw new Error('Error subiendo imagen');

                                                const data = await res.json();
                                                setProfile({ ...profile, avatar: data.url });
                                                showToast('Imagen subida correctamente', 'success');
                                            } catch (error) {
                                                console.error(error);
                                                showToast('Error al subir imagen', 'error');
                                            } finally {
                                                setSaving(false);
                                            }
                                        }}
                                    />
                                    <input
                                        type="text"
                                        value={profile.avatar}
                                        onChange={e => setProfile({ ...profile, avatar: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm text-gray-500"
                                        placeholder="O pega una URL externa..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Organization Section (Admin only) */}
                {isAdmin && (
                    <section>
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Organización</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Empresa</label>
                            <input
                                type="text"
                                value={orgName}
                                onChange={e => setOrgName(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                            />
                            <p className="text-xs text-gray-500 mt-1">Este nombre aparecerá en facturas y comunicaciones.</p>
                        </div>
                    </section>
                )}

                {/* Preferences Section */}
                <section>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Preferencias Regionales</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Zona Horaria</label>
                            <select
                                value={preferences.timezone}
                                onChange={e => setPreferences({ ...preferences, timezone: e.target.value })}
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda Principal</label>
                            <select
                                value={preferences.currency}
                                onChange={e => setPreferences({ ...preferences, currency: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                            >
                                <option value="USD">USD - Dólar Americano</option>
                                <option value="EUR">EUR - Euro</option>
                                <option value="MXN">MXN - Peso Mexicano</option>
                                <option value="COP">COP - Peso Colombiano</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Idioma</label>
                            <select
                                value={preferences.language}
                                onChange={e => setPreferences({ ...preferences, language: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                            >
                                <option value="es">Español</option>
                                <option value="en">English</option>
                            </select>
                        </div>
                    </div>
                </section>

                <div className="pt-6 flex justify-end gap-3 sticky bottom-0 bg-white/80 backdrop-blur-sm p-4 border-t border-gray-50 -mx-8 -mb-8 rounded-b-2xl">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
}
