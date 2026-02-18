import { useState, useEffect } from 'react';
import { API_URL } from '../app/api';

export default function EmailSettings() {
    const [config, setConfig] = useState({
        host: 'smtp.gmail.com',
        port: 587,
        user: '',
        pass: '',
        from: '"ChronusCRM" <alerts@chronus.com>'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');



    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/settings/smtp`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.host) {
                    setConfig(prev => ({ ...prev, ...data }));
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/settings/smtp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                setSuccess('Configuración guardada correctamente.');
            } else {
                const err = await res.json();
                setError(err.error || 'Error al guardar');
            }
        } catch (e) {
            setError('Error de conexión');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-4">Cargando configuración...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-3xl">
            <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600 text-2xl">
                    📧
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Configuración SMTP</h2>
                    <p className="text-sm text-gray-500">Servidor de correo saliente para notificaciones y facturas.</p>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 flex items-start gap-3">
                <span className="text-blue-600 mt-0.5">ℹ️</span>
                <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Importante para usuarios de Gmail</p>
                    <p>Debes usar una <strong>Contraseña de Aplicación</strong> si tienes la verificación en dos pasos activada. No uses tu contraseña habitual.</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2 animate-fadeIn">
                    <span>❌</span> {error}
                </div>
            )}
            {success && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2 animate-fadeIn">
                    <span>✅</span> {success}
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Servidor SMTP</label>
                        <input
                            type="text"
                            value={config.host}
                            onChange={e => setConfig({ ...config, host: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                            placeholder="smtp.gmail.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Puerto</label>
                        <input
                            type="number"
                            value={config.port}
                            onChange={e => setConfig({ ...config, port: parseInt(e.target.value) })}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                            placeholder="587"
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Usuario / Email</label>
                        <input
                            type="email"
                            value={config.user}
                            onChange={e => setConfig({ ...config, user: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                            placeholder="tu-email@empresa.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">App Password</label>
                        <input
                            type="password"
                            value={config.pass}
                            onChange={e => setConfig({ ...config, pass: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                            placeholder="••••••••••••"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Nombre del Remitente</label>
                    <input
                        type="text"
                        value={config.from}
                        onChange={e => setConfig({ ...config, from: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                        placeholder='"Mi Empresa" <alerts@empresa.com>'
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Así aparecerá en la bandeja de entrada de tus clientes.</p>
                </div>

                <div className="pt-6 border-t border-gray-100 flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-gray-900 text-white px-8 py-2.5 rounded-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg shadow-gray-200 transition-all hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </form>
        </div>
    );
}
