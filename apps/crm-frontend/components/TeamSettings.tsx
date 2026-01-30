'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { Skeleton } from './Skeleton';
import { API_URL } from '../app/api';

function getHeaders() {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('crm_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

type TeamMember = {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    lastLoginAt?: string;
};

export default function TeamSettings() {
    const [users, setUsers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'AGENT' });
    const { showToast } = useToast();

    useEffect(() => {
        loadTeam();
    }, []);

    const loadTeam = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/organization/users`, { headers: getHeaders() });
            if (res.ok) {
                setUsers(await res.json());
            } else {
                throw new Error('Error cargando equipo');
            }
        } catch (err) {
            console.error(err);
            showToast('No se pudo cargar el equipo', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async () => {
        try {
            const res = await fetch(`${API_URL}/organization/users`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(newUser)
            });

            if (res.ok) {
                showToast('Usuario agregado al equipo', 'success');
                setShowModal(false);
                setNewUser({ name: '', email: '', password: '', role: 'AGENT' });
                loadTeam();
            } else {
                const data = await res.json();
                showToast(data.error || 'Error al agregar usuario', 'error');
            }
        } catch (err) {
            showToast('Error de conexión', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Equipo de Trabajo</h3>
                    <p className="text-sm text-gray-500">Gestiona los miembros de tu organización</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold shadow-md transition-all flex items-center gap-2"
                >
                    <span>+</span> Nuevo Miembro
                </button>
            </div>

            {loading ? (
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Usuario</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Rol</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Fecha Ingreso</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600">
                                                {user.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900">{user.name}</div>
                                                <div className="text-xs text-gray-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                                            user.role === 'MANAGER' ? 'bg-blue-100 text-blue-700' :
                                                'bg-Emerald-100 text-emerald-700'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full w-fit">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            Activo
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {users.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            No hay otros miembros en el equipo aún.
                        </div>
                    )}
                </div>
            )}

            {/* MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fadeIn">
                        <h3 className="text-xl font-bold mb-4">Invitar Miembro</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre</label>
                                <input
                                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={newUser.name}
                                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                    placeholder="Ej: Juan Pérez"
                                    title="Nombre completo del nuevo usuario"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email Corporativo</label>
                                <input
                                    type="email"
                                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                    placeholder="juan@empresa.com"
                                    title="Correo electrónico para iniciar sesión (debe ser único)"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Contraseña Temporal</label>
                                <input
                                    type="password"
                                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    title="Contraseña inicial. El usuario podrá cambiarla después."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Rol</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['AGENT', 'MANAGER', 'ADMIN'].map(role => (
                                        <button
                                            key={role}
                                            onClick={() => setNewUser({ ...newUser, role })}
                                            title={`Seleccionar rol: ${role}`}
                                            className={`py-2 rounded-lg text-sm font-bold border transition-all ${newUser.role === role
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            {role}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-400 mt-2">
                                    {newUser.role === 'ADMIN' && 'Acceso total a configuración, usuarios y facturación.'}
                                    {newUser.role === 'MANAGER' && 'Puede ver reportes y gestionar todos los tickets y clientes.'}
                                    {newUser.role === 'AGENT' && 'Solo puede gestionar sus tickets y conversaciones asignadas.'}
                                </p>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowModal(false)}
                                    title="Cancelar y cerrar sin guardar"
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleInvite}
                                    title="Crear usuario y enviar credenciales (si el email está configurado)"
                                    className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200"
                                >
                                    Enviar Invitación
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
