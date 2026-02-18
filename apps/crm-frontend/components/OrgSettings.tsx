'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { API_URL } from '../app/api';

// In production, ChronusDev backend is accessed through the frontend proxy at /api
// In development, we can call the backend directly
const CHRONUSDEV_API_URL = process.env.NEXT_PUBLIC_CHRONUSDEV_API_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : 'https://chronusdev.assistai.work/api');

if (!CHRONUSDEV_API_URL && typeof window !== 'undefined') {
    console.error('Configuration Error: NEXT_PUBLIC_CHRONUSDEV_API_URL is missing!');
}

type SyncStatus = 'checking' | 'connected' | 'disconnected';

export default function OrgSettings() {
    const [config, setConfig] = useState({
        apiToken: '',
        organizationCode: '',
        tenantDomain: ''
    });
    const [loading, setLoading] = useState(false);
    const [orgId, setOrgId] = useState<string | null>(null);
    const [orgName, setOrgName] = useState<string>('');
    const [devSyncStatus, setDevSyncStatus] = useState<SyncStatus>('checking');
    const [devOrgName, setDevOrgName] = useState<string>('');
    const { showToast } = useToast();

    useEffect(() => {
        // Fetch current user details to get Org ID
        fetchUserOrg();
    }, []);

    // Check ChronusDev sync status when orgId is available
    useEffect(() => {
        if (orgId) {
            checkDevSyncStatus();
        }
    }, [orgId]);

    async function checkDevSyncStatus() {
        try {
            setDevSyncStatus('checking');
            // Check if any ChronusDev org has this CRM org ID linked
            const res = await fetch(`${CHRONUSDEV_API_URL}/organizations/by-crm/${orgId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.linked) {
                    setDevSyncStatus('connected');
                    setDevOrgName(data.devOrgName || 'Organización ChronusDev');
                } else {
                    setDevSyncStatus('disconnected');
                }
            } else {
                setDevSyncStatus('disconnected');
            }
        } catch (err) {
            console.log('ChronusDev not reachable:', err);
            setDevSyncStatus('disconnected');
        }
    }

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
                    // Also fetch organization name
                    if (data.user.organization?.name) {
                        setOrgName(data.user.organization.name);
                    } else {
                        // Try to fetch org details separately
                        const orgRes = await fetch(`${API_URL}/organizations/${data.user.organizationId}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (orgRes.ok) {
                            const orgData = await orgRes.json();
                            setOrgName(orgData.name || 'Sin nombre');
                        }
                    }
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
            {/* Organization ID Card - Para vincular con ChronusDev */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            🏢 {orgName || 'Tu Organización'} (CRM)
                        </h3>
                        <p className="text-blue-100 text-sm mt-1">
                            Usa este ID para vincular con ChronusDev
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <code className="bg-white/20 px-4 py-2 rounded-lg font-mono text-sm backdrop-blur-sm">
                            {orgId}
                        </code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(orgId || '');
                                showToast('ID copiado al portapapeles', 'success');
                            }}
                            className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors"
                            title="Copiar ID"
                        >
                            📋
                        </button>
                    </div>
                </div>
                <p className="text-xs text-blue-200 mt-3">
                    💡 En ChronusDev → Configuración → Vincular CRM, pega este ID para conectar ambas plataformas.
                </p>
            </div>

            {/* ChronusDev Sync Status Card */}
            <div className={`rounded-2xl p-5 border shadow-sm ${devSyncStatus === 'connected'
                ? 'bg-green-50 border-green-200'
                : devSyncStatus === 'checking'
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {/* Animated LED */}
                        <div className={`relative w-4 h-4 rounded-full ${devSyncStatus === 'connected'
                            ? 'bg-green-500'
                            : devSyncStatus === 'checking'
                                ? 'bg-yellow-400'
                                : 'bg-red-500'
                            }`}>
                            {devSyncStatus === 'connected' && (
                                <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75"></span>
                            )}
                            {devSyncStatus === 'checking' && (
                                <span className="absolute inset-0 rounded-full bg-yellow-300 animate-pulse"></span>
                            )}
                        </div>
                        <div>
                            <h4 className={`font-bold ${devSyncStatus === 'connected' ? 'text-green-800'
                                : devSyncStatus === 'checking' ? 'text-gray-600'
                                    : 'text-red-800'
                                }`}>
                                {devSyncStatus === 'connected'
                                    ? '✅ Conectado con ChronusDev'
                                    : devSyncStatus === 'checking'
                                        ? '⏳ Verificando conexión...'
                                        : '❌ No conectado con ChronusDev'
                                }
                            </h4>
                            {devSyncStatus === 'connected' && devOrgName && (
                                <p className="text-sm text-green-700">
                                    Vinculado a: <strong>{devOrgName}</strong>
                                </p>
                            )}
                            {devSyncStatus === 'disconnected' && (
                                <p className="text-sm text-red-600">
                                    Necesitas vincular en ChronusDev → Configuración
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={checkDevSyncStatus}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${devSyncStatus === 'connected'
                            ? 'bg-green-100 hover:bg-green-200 text-green-700'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                    >
                        🔄 Verificar
                    </button>
                </div>
            </div>

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
