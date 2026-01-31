'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { Skeleton } from './Skeleton';
import { API_URL } from '../app/api';

function getHeaders() {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('crm_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

type Organization = {
    id: string;
    name: string;
    slug: string;
    isActive?: boolean;
    users?: any[];
    _count?: { users: number };
    createdAt?: string;
};

type User = {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive?: boolean;
    organizationId?: string;
    organization?: { id: string; name: string };
    createdAt: string;
};

export default function SuperAdminPanel() {
    const [activeTab, setActiveTab] = useState<'orgs' | 'users' | 'stats'>('orgs');
    const { showToast } = useToast();

    // Data State
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Modals
    const [showOrgModal, setShowOrgModal] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Form State (Org)
    const [orgForm, setOrgForm] = useState({ name: '', slug: '', isActive: true });

    // Form State (User)
    const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'ADMIN', organizationId: '' });

    useEffect(() => {
        loadData();
    }, [activeTab]);

    async function loadData() {
        setLoading(true);
        try {
            if (activeTab === 'orgs') {
                const res = await fetch(`${API_URL}/organizations`, { headers: getHeaders() });
                if (res.ok) setOrgs(await res.json());
            } else if (activeTab === 'users') {
                const res = await fetch(`${API_URL}/admin/users`, { headers: getHeaders() });
                if (res.ok) setUsers(await res.json());
                // Ensure orgs are loaded for dropdown
                if (orgs.length === 0) {
                    const resOrgs = await fetch(`${API_URL}/organizations`, { headers: getHeaders() });
                    if (resOrgs.ok) setOrgs(await resOrgs.json());
                }
            } else if (activeTab === 'stats') {
                // Load comprehensive SaaS dashboard stats
                const res = await fetch(`${API_URL}/admin/saas-metrics`, { headers: getHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            }
        } catch (err) {
            console.error(err);
            showToast('Error cargando datos', 'error');
        } finally {
            setLoading(false);
        }
    }

    // ========== ORGANIZATION ACTIONS ==========
    async function handleSaveOrg() {
        try {
            const method = editingOrg ? 'PUT' : 'POST';
            const url = editingOrg ? `${API_URL}/organizations/${editingOrg.id}` : `${API_URL}/organizations`;

            const res = await fetch(url, {
                method,
                headers: getHeaders(),
                body: JSON.stringify(orgForm),
            });
            if (res.ok) {
                showToast(editingOrg ? 'Organización actualizada' : 'Organización creada', 'success');
                closeOrgModal();
                loadData();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error', 'error');
            }
        } catch (e) { showToast('Error de conexión', 'error'); }
    }

    async function handleToggleOrgStatus(org: Organization) {
        try {
            const res = await fetch(`${API_URL}/organizations/${org.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ isActive: !org.isActive }),
            });
            if (res.ok) {
                showToast(org.isActive ? 'Organización suspendida' : 'Organización activada', 'success');
                loadData();
            } else {
                showToast('Error al cambiar estado', 'error');
            }
        } catch (e) { showToast('Error de conexión', 'error'); }
    }

    async function handleDeleteOrg(org: Organization) {
        if (!confirm(`¿Eliminar organización "${org.name}"? Esta acción no se puede deshacer.`)) return;
        try {
            const res = await fetch(`${API_URL}/organizations/${org.id}`, {
                method: 'DELETE',
                headers: getHeaders(),
            });
            if (res.ok) {
                showToast('Organización eliminada', 'success');
                loadData();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al eliminar', 'error');
            }
        } catch (e) { showToast('Error de conexión', 'error'); }
    }

    function openEditOrg(org: Organization) {
        setEditingOrg(org);
        setOrgForm({ name: org.name, slug: org.slug, isActive: org.isActive !== false });
        setShowOrgModal(true);
    }

    function closeOrgModal() {
        setShowOrgModal(false);
        setEditingOrg(null);
        setOrgForm({ name: '', slug: '', isActive: true });
    }

    // ========== USER ACTIONS ==========
    async function handleSaveUser() {
        try {
            const method = editingUser ? 'PATCH' : 'POST';
            const url = editingUser ? `${API_URL}/admin/users/${editingUser.id}` : `${API_URL}/admin/users`;

            const payload = editingUser
                ? { name: userForm.name, role: userForm.role, organizationId: userForm.organizationId || null }
                : userForm;

            const res = await fetch(url, {
                method,
                headers: getHeaders(),
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                showToast(editingUser ? 'Usuario actualizado' : 'Usuario creado', 'success');
                closeUserModal();
                loadData();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error', 'error');
            }
        } catch (e) { showToast('Error de conexión', 'error'); }
    }

    async function handleToggleUserStatus(user: User) {
        try {
            const res = await fetch(`${API_URL}/admin/users/${user.id}/suspend`, {
                method: 'POST',
                headers: getHeaders(),
            });
            if (res.ok) {
                showToast(user.isActive !== false ? 'Usuario suspendido' : 'Usuario activado', 'success');
                loadData();
            } else {
                showToast('Error al cambiar estado', 'error');
            }
        } catch (e) { showToast('Error de conexión', 'error'); }
    }

    async function handleResetPassword(user: User) {
        const newPassword = prompt(`Nueva contraseña para ${user.email}:`);
        if (!newPassword) return;

        try {
            const res = await fetch(`${API_URL}/admin/users/${user.id}`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ password: newPassword }),
            });
            if (res.ok) {
                showToast('Contraseña actualizada', 'success');
            } else {
                showToast('Error al cambiar contraseña', 'error');
            }
        } catch (e) { showToast('Error de conexión', 'error'); }
    }

    function openEditUser(user: User) {
        setEditingUser(user);
        setUserForm({
            name: user.name,
            email: user.email,
            password: '',
            role: user.role,
            organizationId: user.organizationId || ''
        });
        setShowUserModal(true);
    }

    function closeUserModal() {
        setShowUserModal(false);
        setEditingUser(null);
        setUserForm({ name: '', email: '', password: '', role: 'ADMIN', organizationId: '' });
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">🛡️ Super Admin Panel</h2>
                    <p className="text-gray-500 text-sm">Gestión completa de la plataforma SaaS</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`px-4 py-2 rounded-xl font-bold transition-all ${activeTab === 'stats' ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        📊 Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('orgs')}
                        className={`px-4 py-2 rounded-xl font-bold transition-all ${activeTab === 'orgs' ? 'bg-slate-900 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        🏢 Organizaciones
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 rounded-xl font-bold transition-all ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        👥 Usuarios
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[500px]">
                {loading ? (
                    <div className="p-10 space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : activeTab === 'stats' ? (
                    // COMPREHENSIVE SAAS METRICS DASHBOARD
                    <div className="p-6 space-y-6">
                        {/* Overview Section */}
                        <div>
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                📊 Resumen de la Plataforma
                                <span className="text-xs font-normal text-gray-400">
                                    {stats?.generatedAt ? `Actualizado: ${new Date(stats.generatedAt).toLocaleTimeString()}` : ''}
                                </span>
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-2xl">
                                    <p className="text-3xl font-bold text-blue-600">{stats?.overview?.totalOrganizations || 0}</p>
                                    <p className="text-sm text-blue-700 font-medium">Organizaciones</p>
                                </div>
                                <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-2xl">
                                    <p className="text-3xl font-bold text-green-600">{stats?.overview?.activeOrganizations || 0}</p>
                                    <p className="text-sm text-green-700 font-medium">Orgs Activas</p>
                                    <p className="text-xs text-green-600 mt-1">{stats?.overview?.suspendedOrganizations || 0} suspendidas</p>
                                </div>
                                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-2xl">
                                    <p className="text-3xl font-bold text-purple-600">{stats?.overview?.totalUsers || 0}</p>
                                    <p className="text-sm text-purple-700 font-medium">Usuarios Totales</p>
                                    <p className="text-xs text-purple-600 mt-1">+{stats?.overview?.newUsersThisMonth || 0} este mes</p>
                                </div>
                                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-5 rounded-2xl">
                                    <p className="text-3xl font-bold text-amber-600">{stats?.overview?.totalCustomers || 0}</p>
                                    <p className="text-sm text-amber-700 font-medium">Clientes Totales</p>
                                    <p className="text-xs text-amber-600 mt-1">+{stats?.overview?.newCustomersThisMonth || 0} este mes</p>
                                </div>
                            </div>
                        </div>

                        {/* Revenue & Support Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Revenue Card */}
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-100 p-6 rounded-2xl">
                                <h4 className="text-sm font-bold text-emerald-800 mb-4">💰 Ingresos Recurrentes (MRR)</h4>
                                <p className="text-4xl font-black text-emerald-600">
                                    ${stats?.revenue?.estimatedMRR?.toLocaleString() || 0}
                                    <span className="text-lg font-medium">/mes</span>
                                </p>
                                <div className="mt-4 space-y-2">
                                    <p className="text-xs font-medium text-emerald-700">Clientes por Plan:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {stats?.revenue?.customersByPlan?.map((p: any) => (
                                            <span key={p.plan} className="bg-white/60 px-3 py-1 rounded-full text-xs font-medium text-emerald-800">
                                                {p.plan}: {p.count} (${p.revenue})
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Support Card */}
                            <div className="bg-gradient-to-br from-rose-50 to-pink-100 p-6 rounded-2xl">
                                <h4 className="text-sm font-bold text-rose-800 mb-4">🎫 Tickets de Soporte</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-3xl font-bold text-rose-600">{stats?.support?.totalTickets || 0}</p>
                                        <p className="text-xs text-rose-700">Total Tickets</p>
                                    </div>
                                    <div>
                                        <p className="text-3xl font-bold text-orange-600">{stats?.support?.openTickets || 0}</p>
                                        <p className="text-xs text-orange-700">Abiertos</p>
                                    </div>
                                    <div>
                                        <p className="text-3xl font-bold text-pink-600">{stats?.support?.ticketsThisMonth || 0}</p>
                                        <p className="text-xs text-pink-700">Este Mes</p>
                                    </div>
                                    <div>
                                        <p className="text-3xl font-bold text-green-600">{stats?.support?.resolutionRate || 0}%</p>
                                        <p className="text-xs text-green-700">Tasa Resolución</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Projects & Users Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Projects Card */}
                            <div className="bg-gradient-to-br from-indigo-50 to-violet-100 p-6 rounded-2xl">
                                <h4 className="text-sm font-bold text-indigo-800 mb-4">🚀 Proyectos (ChronusDev)</h4>
                                <div className="flex items-end gap-6">
                                    <div>
                                        <p className="text-4xl font-bold text-indigo-600">{stats?.projects?.total || 0}</p>
                                        <p className="text-xs text-indigo-700">Total Proyectos</p>
                                    </div>
                                    <div>
                                        <p className="text-3xl font-bold text-violet-600">{stats?.projects?.active || 0}</p>
                                        <p className="text-xs text-violet-700">Activos</p>
                                    </div>
                                </div>
                            </div>

                            {/* Users by Role Card */}
                            <div className="bg-gradient-to-br from-slate-50 to-gray-100 p-6 rounded-2xl">
                                <h4 className="text-sm font-bold text-slate-800 mb-4">👥 Usuarios por Rol</h4>
                                <div className="flex flex-wrap gap-3">
                                    {stats?.usersByRole && Object.entries(stats.usersByRole).map(([role, count]) => (
                                        <div key={role} className="bg-white/70 px-4 py-2 rounded-xl border border-gray-200">
                                            <p className="text-lg font-bold text-gray-800">{count as number}</p>
                                            <p className="text-xs text-gray-600">{role}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'orgs' ? (
                    // ORGANIZATIONS VIEW
                    <div className="p-6">
                        <div className="flex justify-between mb-6">
                            <h3 className="text-lg font-bold">Listado de Organizaciones</h3>
                            <button
                                onClick={() => { setEditingOrg(null); setOrgForm({ name: '', slug: '', isActive: true }); setShowOrgModal(true); }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md"
                            >
                                + Nueva Organización
                            </button>
                        </div>
                        <table className="w-full">
                            <thead className="bg-gray-50 text-left">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Nombre</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Slug</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Estado</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Usuarios</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {orgs.map(org => (
                                    <tr key={org.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900">{org.name}</td>
                                        <td className="px-6 py-4 text-gray-600 font-mono text-xs">{org.slug}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${org.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {org.isActive !== false ? 'Activa' : 'Suspendida'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-sm">{org._count?.users || org.users?.length || 0}</td>
                                        <td className="px-6 py-4 flex gap-2">
                                            <button onClick={() => openEditOrg(org)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Editar</button>
                                            <button onClick={() => handleToggleOrgStatus(org)} className={`text-sm font-medium ${org.isActive !== false ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'}`}>
                                                {org.isActive !== false ? 'Suspender' : 'Activar'}
                                            </button>
                                            <button onClick={() => handleDeleteOrg(org)} className="text-red-600 hover:text-red-800 text-sm font-medium">Eliminar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {orgs.length === 0 && <p className="text-center text-gray-400 py-10">No hay organizaciones registradas</p>}
                    </div>
                ) : (
                    // USERS VIEW
                    <div className="p-6">
                        <div className="flex justify-between mb-6">
                            <h3 className="text-lg font-bold">Usuarios de la Plataforma</h3>
                            <button
                                onClick={() => { setEditingUser(null); setUserForm({ name: '', email: '', password: '', role: 'ADMIN', organizationId: '' }); setShowUserModal(true); }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md"
                            >
                                + Crear Usuario
                            </button>
                        </div>
                        <table className="w-full">
                            <thead className="bg-gray-50 text-left">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Usuario</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Rol</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Organización</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Estado</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {users.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600 text-xs">
                                                    {u.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 text-sm">{u.name}</p>
                                                    <p className="text-xs text-gray-400">{u.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${u.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' : u.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {u.organization ? (
                                                <span className="flex items-center gap-1 text-sm text-gray-700 font-medium">🏢 {u.organization.name}</span>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">Sin organización</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${u.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {u.isActive !== false ? 'Activo' : 'Suspendido'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 flex gap-2">
                                            <button onClick={() => openEditUser(u)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Editar</button>
                                            <button onClick={() => handleResetPassword(u)} className="text-purple-600 hover:text-purple-800 text-sm font-medium">Contraseña</button>
                                            <button onClick={() => handleToggleUserStatus(u)} className={`text-sm font-medium ${u.isActive !== false ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'}`}>
                                                {u.isActive !== false ? 'Suspender' : 'Activar'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {users.length === 0 && <p className="text-center text-gray-400 py-10">No hay usuarios registrados</p>}
                    </div>
                )}
            </div>

            {/* ORG MODAL (Create/Edit) */}
            {showOrgModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fadeIn">
                        <h3 className="text-xl font-bold mb-4">{editingOrg ? 'Editar Organización' : 'Nueva Organización'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre Empresa</label>
                                <input
                                    className="w-full p-2 border rounded-lg"
                                    value={orgForm.name}
                                    onChange={e => setOrgForm({ ...orgForm, name: e.target.value })}
                                    placeholder="Ej: Acme Corp"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Slug (URL)</label>
                                <input
                                    className="w-full p-2 border rounded-lg"
                                    value={orgForm.slug}
                                    onChange={e => setOrgForm({ ...orgForm, slug: e.target.value })}
                                    placeholder="ej: acme-corp"
                                />
                            </div>
                            {editingOrg && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="orgActive"
                                        checked={orgForm.isActive}
                                        onChange={e => setOrgForm({ ...orgForm, isActive: e.target.checked })}
                                        className="rounded"
                                    />
                                    <label htmlFor="orgActive" className="text-sm font-medium">Organización Activa</label>
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button onClick={closeOrgModal} className="flex-1 py-2 border rounded-xl">Cancelar</button>
                                <button onClick={handleSaveOrg} className="flex-1 py-2 bg-slate-900 text-white rounded-xl font-bold">{editingOrg ? 'Guardar' : 'Crear'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* USER MODAL (Create/Edit) */}
            {showUserModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fadeIn">
                        <h3 className="text-xl font-bold mb-4">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre Completo</label>
                                <input
                                    className="w-full p-2 border rounded-lg"
                                    value={userForm.name}
                                    onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                                />
                            </div>
                            {!editingUser && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Email</label>
                                        <input
                                            className="w-full p-2 border rounded-lg"
                                            type="email"
                                            value={userForm.email}
                                            onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Contraseña Inicial</label>
                                        <input
                                            className="w-full p-2 border rounded-lg"
                                            type="password"
                                            value={userForm.password}
                                            onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                                        />
                                    </div>
                                </>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Rol</label>
                                    <select
                                        className="w-full p-2 border rounded-lg bg-white"
                                        value={userForm.role}
                                        onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                                    >
                                        <option value="AGENT">Agente</option>
                                        <option value="MANAGER">Manager</option>
                                        <option value="ADMIN">Admin</option>
                                        <option value="SUPER_ADMIN">Super Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Organización</label>
                                    <select
                                        className="w-full p-2 border rounded-lg bg-white"
                                        value={userForm.organizationId}
                                        onChange={e => setUserForm({ ...userForm, organizationId: e.target.value })}
                                    >
                                        <option value="">-- Sin Org --</option>
                                        {orgs.map(o => (
                                            <option key={o.id} value={o.id}>{o.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={closeUserModal} className="flex-1 py-2 border rounded-xl">Cancelar</button>
                                <button onClick={handleSaveUser} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-bold">{editingUser ? 'Guardar' : 'Crear'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
