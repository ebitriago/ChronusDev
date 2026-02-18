import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { getCurrentUser, type User } from '../app/api';
import ProfileSettings from './ProfileSettings';

// Use the same API proxy pattern as api.ts
const API_URL = typeof window !== 'undefined' ? '/api' : 'http://localhost:3001';
const CRM_API_URL = process.env.NEXT_PUBLIC_CRM_API_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : 'https://chronuscrm.assistai.work');

function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        return localStorage.getItem('crm_token') || localStorage.getItem('authToken');
    } catch {
        return null;
    }
}

interface CrmLinkStatus {
    linked: boolean;
    crmOrganizationId: string | null;
    crmOrganizationName: string | null;
    organizationId: string;
    organizationName: string;
}

export default function Settings() {
    const [activeTab, setActiveTab] = useState<'profile' | 'config'>('profile');
    const [crmLink, setCrmLink] = useState<CrmLinkStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [crmOrgId, setCrmOrgId] = useState('');
    const [linking, setLinking] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            await Promise.all([
                loadCrmLinkStatus(),
                loadUser()
            ]);
        } finally {
            setLoading(false);
        }
    }

    async function loadUser() {
        try {
            const user = await getCurrentUser();
            setCurrentUser(user);
        } catch (e) {
            console.error('Error loading user', e);
        }
    }

    async function loadCrmLinkStatus() {
        try {
            const token = getAuthToken();
            const res = await fetch(`${API_URL}/organizations/current/crm-link`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();

                // If linked, try to fetch CRM org name
                let crmOrgName = null;
                if (data.crmOrganizationId) {
                    try {
                        const crmRes = await fetch(`${CRM_API_URL}/organizations/${data.crmOrganizationId}/public`, {
                            headers: { 'X-Sync-Key': 'dev-sync-key' }
                        });
                        if (crmRes.ok) {
                            const crmData = await crmRes.json();
                            crmOrgName = crmData.name;
                        }
                    } catch (err) {
                        console.log('Could not fetch CRM org name:', err);
                    }
                }

                setCrmLink({ ...data, crmOrganizationName: crmOrgName });
            }
        } catch (err) {
            console.error('Error loading CRM link status:', err);
        }
    }

    async function handleLinkCrm() {
        if (!crmOrgId.trim()) {
            showToast('Ingresa el ID de la organización del CRM', 'error');
            return;
        }

        setLinking(true);
        try {
            const token = getAuthToken();
            const res = await fetch(`${API_URL}/organizations/current/link-crm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ crmOrganizationId: crmOrgId.trim() })
            });

            const data = await res.json();
            if (res.ok) {
                showToast('¡Vinculación exitosa! Ahora los tickets del CRM se sincronizarán con ChronusDev', 'success');
                loadCrmLinkStatus();
                setCrmOrgId('');
            } else {
                showToast(data.error || 'Error al vincular', 'error');
            }
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setLinking(false);
        }
    }

    async function handleUnlinkCrm() {
        if (!confirm('¿Deseas desvincular del CRM? Los tickets ya sincronizados permanecerán.')) return;

        try {
            const token = getAuthToken();
            const res = await fetch(`${API_URL}/organizations/current/link-crm`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                showToast('Desvinculado del CRM', 'info');
                loadCrmLinkStatus();
            }
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    }

    if (loading && !currentUser) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <div className="animate-pulse bg-gray-200 rounded-2xl h-48"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto animate-fadeIn space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Configuración</h2>
                    <p className="text-gray-500 dark:text-gray-400">Gestiona tu perfil y la organización</p>
                </div>

                {/* Tabs */}
                <div className="bg-gray-100 p-1 rounded-xl inline-flex self-start md:self-auto">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'profile'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <span>👤</span> Mi Perfil
                    </button>
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'config'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <span>⚙️</span> Organización
                    </button>
                </div>
            </div>

            {activeTab === 'profile' && currentUser && (
                <ProfileSettings user={currentUser} onUpdate={loadUser} />
            )}

            {activeTab === 'config' && (
                <div className="space-y-6 animate-fadeIn">
                    {/* Organization ID Card */}
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    🔧 ID de tu Organización (ChronusDev)
                                </h3>
                                <p className="text-purple-200 text-sm mt-1">
                                    {crmLink?.organizationName || 'Cargando...'}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <code className="bg-white/20 px-4 py-2 rounded-lg font-mono text-sm backdrop-blur-sm">
                                    {crmLink?.organizationId || '...'}
                                </code>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(crmLink?.organizationId || '');
                                        showToast('ID copiado al portapapeles', 'success');
                                    }}
                                    className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors"
                                    title="Copiar ID"
                                >
                                    📋
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* CRM Integration Card */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 space-y-6">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                🔗 Integración con CRM
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Vincula ChronusDev con el CRM para sincronizar tickets y tareas automáticamente
                            </p>
                        </div>

                        {crmLink?.linked ? (
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white text-xl">
                                            ✓
                                        </div>
                                        <div>
                                            <p className="font-bold text-green-800 dark:text-green-300">¡Vinculado exitosamente!</p>
                                            <p className="text-sm text-green-700 dark:text-green-400">
                                                🏢 {crmLink.crmOrganizationName || 'Organización CRM'}
                                            </p>
                                            <code className="text-xs text-green-600 dark:text-green-400 font-mono">
                                                ID: {crmLink.crmOrganizationId}
                                            </code>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleUnlinkCrm}
                                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                                    >
                                        Desvincular
                                    </button>
                                </div>
                                <p className="text-sm text-green-700 dark:text-green-400 mt-3">
                                    ✨ Los tickets del CRM se convertirán automáticamente en tareas aquí.
                                    Cuando marques una tarea como DONE, el ticket se resuelve en el CRM.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                                        ⚠️ No está vinculado a ninguna organización del CRM
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        ID de la Organización del CRM
                                    </label>
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            value={crmOrgId}
                                            onChange={(e) => setCrmOrgId(e.target.value)}
                                            placeholder="Pega aquí el ID del CRM..."
                                            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                                        />
                                        <button
                                            onClick={handleLinkCrm}
                                            disabled={linking}
                                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-xl font-bold transition-colors shadow-lg shadow-purple-500/20 disabled:opacity-50"
                                        >
                                            {linking ? 'Vinculando...' : '🔗 Vincular'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">
                                        💡 Encuentra el ID en CRM → Configuración → Organización
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* How it works */}
                    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-6">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-4">¿Cómo funciona la sincronización?</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-slate-700 p-4 rounded-xl">
                                <div className="text-2xl mb-2">1️⃣</div>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    <strong>CRM → ChronusDev:</strong> Al hacer clic en "Enviar a desarrollo" en un ticket, se crea una tarea aquí.
                                </p>
                            </div>
                            <div className="bg-white dark:bg-slate-700 p-4 rounded-xl">
                                <div className="text-2xl mb-2">2️⃣</div>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    <strong>Desarrollo:</strong> Trabaja en la tarea y muévela por el Kanban (Backlog → En Progreso → Review → Done).
                                </p>
                            </div>
                            <div className="bg-white dark:bg-slate-700 p-4 rounded-xl">
                                <div className="text-2xl mb-2">3️⃣</div>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    <strong>ChronusDev → CRM:</strong> Al marcar como DONE, el ticket se resuelve automáticamente en el CRM.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
