'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { Skeleton } from './Skeleton';

// API functions para organizations
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

function getHeaders() {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('authToken');
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

type Organization = {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    owner: { id: string; name: string; email: string } | null;
    memberCount: number;
    projectCount: number;
    createdAt: string;
};

type OrgWithUsers = Organization & {
    users: { id: string; name: string; email: string; role: string; defaultPayRate?: number }[];
};

async function getOrganizations(): Promise<Organization[]> {
    const res = await fetch(`${API_URL}/organizations`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Error loading organizations');
    return res.json();
}

async function getOrganization(id: string): Promise<OrgWithUsers> {
    const res = await fetch(`${API_URL}/organizations/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Error loading organization');
    return res.json();
}

async function createOrganization(data: { name: string; ownerEmail: string; ownerName: string }): Promise<any> {
    const res = await fetch(`${API_URL}/organizations`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error creating organization');
    }
    return res.json();
}

async function updateOrganization(id: string, data: { name?: string; isActive?: boolean }): Promise<any> {
    const res = await fetch(`${API_URL}/organizations/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error updating organization');
    return res.json();
}

async function deleteOrganization(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/organizations/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Error deleting organization');
}

export default function SuperAdminPanel() {
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [showDetail, setShowDetail] = useState<string | null>(null);
    const [detailOrg, setDetailOrg] = useState<OrgWithUsers | null>(null);
    const { showToast } = useToast();

    // Create form
    const [newName, setNewName] = useState('');
    const [newOwnerName, setNewOwnerName] = useState('');
    const [newOwnerEmail, setNewOwnerEmail] = useState('');

    useEffect(() => {
        loadOrgs();
    }, []);

    async function loadOrgs() {
        try {
            setLoading(true);
            const data = await getOrganizations();
            setOrgs(data);
        } catch (err: any) {
            showToast(err.message || 'Error cargando organizaciones', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        try {
            await createOrganization({ name: newName, ownerName: newOwnerName, ownerEmail: newOwnerEmail });
            showToast('Organización creada', 'success');
            setShowCreate(false);
            setNewName('');
            setNewOwnerName('');
            setNewOwnerEmail('');
            loadOrgs();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    }

    async function handleToggleActive(org: Organization) {
        try {
            await updateOrganization(org.id, { isActive: !org.isActive });
            showToast(org.isActive ? 'Organización desactivada' : 'Organización activada', 'success');
            loadOrgs();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    }

    async function handleDelete(org: Organization) {
        if (!confirm(`¿Eliminar "${org.name}" y todos sus usuarios?`)) return;
        try {
            await deleteOrganization(org.id);
            showToast('Organización eliminada', 'success');
            loadOrgs();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    }

    async function handleViewDetail(orgId: string) {
        try {
            const data = await getOrganization(orgId);
            setDetailOrg(data);
            setShowDetail(orgId);
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    }

    if (loading) return (
        <div className="p-6 max-w-7xl mx-auto space-y-4">
            <Skeleton height="40px" width="300px" />
            <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} height="100px" variant="rect" />)}
            </div>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto animate-fadeIn">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        👑 Panel Super Admin
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">Gestiona todas las organizaciones del sistema</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-purple-500/30 flex items-center gap-2 font-medium"
                >
                    + Nueva Organización
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                    <div className="text-3xl font-bold text-purple-600">{orgs.length}</div>
                    <div className="text-gray-500 text-sm">Organizaciones</div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                    <div className="text-3xl font-bold text-green-600">{orgs.filter(o => o.isActive).length}</div>
                    <div className="text-gray-500 text-sm">Activas</div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                    <div className="text-3xl font-bold text-blue-600">{orgs.reduce((acc, o) => acc + o.memberCount, 0)}</div>
                    <div className="text-gray-500 text-sm">Usuarios Totales</div>
                </div>
            </div>

            {/* Organizations Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700 text-left">
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Organización</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Usuarios</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Proyectos</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Estado</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {orgs.map(org => (
                            <tr key={org.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-md">
                                            {org.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900 dark:text-white">{org.name}</span>
                                            <p className="text-xs text-gray-400">{org.slug}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {org.owner ? (
                                        <div>
                                            <span className="font-medium text-gray-900 dark:text-white">{org.owner.name}</span>
                                            <p className="text-xs text-gray-400">{org.owner.email}</p>
                                        </div>
                                    ) : (
                                        <span className="text-gray-400">Sin admin</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                        {org.memberCount}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="text-gray-600 dark:text-gray-300">{org.projectCount}</span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${org.isActive
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                        {org.isActive ? '✓ Activa' : '✕ Inactiva'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleViewDetail(org.id)}
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                            title="Ver usuarios"
                                        >
                                            👥
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(org)}
                                            className={`p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors ${org.isActive ? 'text-orange-500' : 'text-green-500'
                                                }`}
                                            title={org.isActive ? 'Desactivar' : 'Activar'}
                                        >
                                            {org.isActive ? '⏸️' : '▶️'}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(org)}
                                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-red-500"
                                            title="Eliminar"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva Organización</h3>
                            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Nombre de la Organización
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                    placeholder="Ej: Acme Inc"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Nombre del Admin
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newOwnerName}
                                    onChange={e => setNewOwnerName(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                    placeholder="Ej: John Doe"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Email del Admin
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={newOwnerEmail}
                                    onChange={e => setNewOwnerEmail(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                    placeholder="admin@acme.com"
                                />
                            </div>

                            <p className="text-xs text-gray-500">
                                Se creará un usuario Admin con password temporal: <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">demo123</code>
                            </p>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all font-medium"
                                >
                                    Crear Organización
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetail && detailOrg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{detailOrg.name}</h3>
                                <p className="text-gray-500 text-sm">Usuarios de esta organización</p>
                            </div>
                            <button onClick={() => setShowDetail(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="p-6 max-h-96 overflow-y-auto">
                            {detailOrg.users.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No hay usuarios</p>
                            ) : (
                                <div className="space-y-3">
                                    {detailOrg.users.map(user => (
                                        <div key={user.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="font-medium text-gray-900 dark:text-white">{user.name}</span>
                                                <p className="text-xs text-gray-400 truncate">{user.email}</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.role === 'ADMIN'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                {user.role}
                                            </span>
                                            {user.defaultPayRate ? (
                                                <span className="text-sm text-gray-500">${user.defaultPayRate}/hr</span>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
