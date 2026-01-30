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
    users?: any[]; // Simplified for list
};

type User = {
    id: string;
    name: string;
    email: string;
    role: string;
    organizationId?: string;
    organization?: { id: string; name: string };
    createdAt: string;
};

export default function SuperAdminPanel() {
    const [activeTab, setActiveTab] = useState<'orgs' | 'users'>('orgs');
    const { showToast } = useToast();

    // Data State
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);

    // Modals
    const [showOrgModal, setShowOrgModal] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);

    // Form State (Org)
    const [newOrgName, setNewOrgName] = useState('');
    const [newOrgSlug, setNewOrgSlug] = useState('');

    // Form State (User)
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'ADMIN', organizationId: '' });

    useEffect(() => {
        loadData();
    }, [activeTab]);

    async function loadData() {
        setLoading(true);
        try {
            if (activeTab === 'orgs') {
                const res = await fetch(`${API_URL}/organizations`, { headers: getHeaders() });
                if (res.ok) setOrgs(await res.json());
            } else {
                const res = await fetch(`${API_URL}/admin/users`, { headers: getHeaders() });
                if (res.ok) setUsers(await res.json());

                // Ensure orgs are loaded for dropdown
                if (orgs.length === 0) {
                    const resOrgs = await fetch(`${API_URL}/organizations`, { headers: getHeaders() });
                    if (resOrgs.ok) setOrgs(await resOrgs.json());
                }
            }
        } catch (err) {
            console.error(err);
            showToast('Error cargando datos', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateOrg() {
        try {
            const res = await fetch(`${API_URL}/organizations`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ name: newOrgName, slug: newOrgSlug }),
            });
            if (res.ok) {
                showToast('Organización creada', 'success');
                setShowOrgModal(false);
                setNewOrgName('');
                setNewOrgSlug('');
                loadData();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error', 'error');
            }
        } catch (e) { showToast('Error de conexión', 'error'); }
    }

    async function handleCreateUser() {
        try {
            const res = await fetch(`${API_URL}/admin/users`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(newUser),
            });
            if (res.ok) {
                showToast('Usuario creado exitosamente', 'success');
                setShowUserModal(false);
                setNewUser({ name: '', email: '', password: '', role: 'ADMIN', organizationId: '' });
                loadData();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error', 'error');
            }
        } catch (e) { showToast('Error de conexión', 'error'); }
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">SaaS Admin Panel</h2>
                    <p className="text-gray-500 text-sm">Gestiona organizaciones y usuarios de la plataforma</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('orgs')}
                        className={`px-4 py-2 rounded-xl font-bold transition-all ${activeTab === 'orgs' ? 'bg-slate-900 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        🏢 Organizaciones
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 rounded-xl font-bold transition-all ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        👥 Usuarios Globales
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
                ) : activeTab === 'orgs' ? (
                    // ORGANIZATIONS VIEW
                    <div className="p-6">
                        <div className="flex justify-between mb-6">
                            <h3 className="text-lg font-bold">Listado de Empresas</h3>
                            <button
                                onClick={() => setShowOrgModal(true)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md"
                            >
                                + Nueva Organización
                            </button>
                        </div>
                        <table className="w-full">
                            <thead className="bg-gray-50 text-left">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Nombre</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Slug / Subdominio</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">ID</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {orgs.map(org => (
                                    <tr key={org.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900">{org.name}</td>
                                        <td className="px-6 py-4 text-gray-600 font-mono text-xs">{org.slug}</td>
                                        <td className="px-6 py-4 text-gray-400 text-xs font-mono">{org.id}</td>
                                        <td className="px-6 py-4">
                                            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Editar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    // USERS VIEW
                    <div className="p-6">
                        <div className="flex justify-between mb-6">
                            <h3 className="text-lg font-bold">Usuarios de la Plataforma</h3>
                            <button
                                onClick={() => setShowUserModal(true)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md"
                            >
                                + Crear Usuario / Invitar
                            </button>
                        </div>
                        <table className="w-full">
                            <thead className="bg-gray-50 text-left">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Usuario</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Rol</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Organización</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Fecha Registro</th>
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
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${u.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                                                u.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {u.organization ? (
                                                <span className="flex items-center gap-1 text-sm text-gray-700 font-medium">
                                                    🏢 {u.organization.name}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">Sin organización</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-gray-500">
                                            {new Date(u.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* CREATE ORG MODAL */}
            {showOrgModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fadeIn">
                        <h3 className="text-xl font-bold mb-4">Nueva Organización</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre Empresa</label>
                                <input
                                    className="w-full p-2 border rounded-lg"
                                    value={newOrgName}
                                    onChange={e => setNewOrgName(e.target.value)}
                                    placeholder="Ej: Acme Corp"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Slug (URL)</label>
                                <input
                                    className="w-full p-2 border rounded-lg"
                                    value={newOrgSlug}
                                    onChange={e => setNewOrgSlug(e.target.value)}
                                    placeholder="ej: acme-corp"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowOrgModal(false)} className="flex-1 py-2 border rounded-xl">Cancelar</button>
                                <button onClick={handleCreateOrg} className="flex-1 py-2 bg-slate-900 text-white rounded-xl font-bold">Crear</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE USER MODAL */}
            {showUserModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fadeIn">
                        <h3 className="text-xl font-bold mb-4">Nuevo Usuario / Invitación</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre Completo</label>
                                <input
                                    className="w-full p-2 border rounded-lg"
                                    value={newUser.name}
                                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input
                                    className="w-full p-2 border rounded-lg"
                                    type="email"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Contraseña Inicial</label>
                                <input
                                    className="w-full p-2 border rounded-lg"
                                    type="password"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Rol</label>
                                    <select
                                        className="w-full p-2 border rounded-lg bg-white"
                                        value={newUser.role}
                                        onChange={e => setNewUser({ ...newUser, role: e.target.value })}
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
                                        value={newUser.organizationId}
                                        onChange={e => setNewUser({ ...newUser, organizationId: e.target.value })}
                                    >
                                        <option value="">-- Sin Org --</option>
                                        {orgs.map(o => (
                                            <option key={o.id} value={o.id}>{o.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowUserModal(false)} className="flex-1 py-2 border rounded-xl">Cancelar</button>
                                <button onClick={handleCreateUser} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-bold">Crear Usuario</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
