'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { API_URL } from '../app/api';

export default function OrgSettings() {
    const [config, setConfig] = useState({
        apiToken: '',
        organizationCode: '',
        tenantDomain: ''
    });
    const [loading, setLoading] = useState(false);
    const [orgId, setOrgId] = useState<string | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        // Fetch current user details to get Org ID
        fetchUserOrg();
    }, []);

    async function fetchUserOrg() {
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.user?.organizationId) {
                    setOrgId(data.user.organizationId);
                    // Fetch current config? (The backend doesn't expose GET config for security? 
                    // Actually we might want to expose a masked version or just empty for update)
                    // For now, let's leave empty to allow setting new values
                }
            }
        } catch (err) {
            console.error('Error fetching user org', err);
        }
    }

    async function handleSave() {
        if (!orgId) {
            showToast('No perteneces a una organización', 'error');
            return;
        }
        if (!config.apiToken || !config.organizationCode || !config.tenantDomain) {
            showToast('Todos los campos son requeridos', 'error');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/organizations/${orgId}/assistai`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                showToast('Configuración guardada exitosamente', 'success');
                setConfig({ apiToken: '', organizationCode: '', tenantDomain: '' });
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al guardar', 'error');
            }
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    const [seeding, setSeeding] = useState(false);

    async function handleSeedDemo() {
        setSeeding(true);
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/organization/seed-demo`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                showToast('¡Datos de demostración generados con éxito!', 'success');
                // Optional: Trigger a reload of data if context allows, or just tell user to refresh
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showToast(data.error || 'Error al generar datos', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de conexión', 'error');
        } finally {
            setSeeding(false);
        }
    }

    if (!orgId) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <p className="text-gray-500">Cargando información de organización...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Demostración y Pruebas</h3>
                    <p className="text-sm text-gray-500">Herramientas para probar la plataforma.</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-gray-900">Generar Datos de Prueba</h4>
                            <p className="text-sm text-gray-600 mt-1">Crea clientes, tickets y leads ficticios para probar el sistema.</p>
                        </div>
                        <button
                            onClick={handleSeedDemo}
                            disabled={seeding}
                            title="Haz clic para poblar tu organización con datos de ejemplo"
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                        >
                            {seeding ? 'Generando...' : '🎲 Cargar Datos Demo'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Configuración de AssistAI</h3>
                    <p className="text-sm text-gray-500">Credenciales para la integración con el agente de IA</p>
                </div>

                <div className="space-y-4 max-w-2xl">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Token</label>
                        <input
                            type="password"
                            value={config.apiToken}
                            onChange={e => setConfig({ ...config, apiToken: e.target.value })}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500/20 outline-none font-mono"
                            placeholder="eyJhbGciOi..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Code</label>
                            <input
                                type="text"
                                value={config.organizationCode}
                                onChange={e => setConfig({ ...config, organizationCode: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500/20 outline-none font-mono"
                                placeholder="Ej: d59b32ed..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tenant Domain</label>
                            <input
                                type="text"
                                value={config.tenantDomain}
                                onChange={e => setConfig({ ...config, tenantDomain: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500/20 outline-none font-mono"
                                placeholder="Ej: ce230715..."
                            />
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            title="Guarda la configuración de conexión con AssistAI"
                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : 'Guardar Credenciales'}
                        </button>
                        <p className="text-xs text-gray-400 mt-3">
                            Nota: Por seguridad, el token actual no se muestra. Ingresa uno nuevo para actualizar.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
