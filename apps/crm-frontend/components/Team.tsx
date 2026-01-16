'use client';

import { useState, useEffect } from 'react';
import {
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    getActiveTimers,
    getTeamBalances,
    getUserBalance,
    createPayment,
    type User,
    type UserRole,
    type ActiveTimer,
    type TeamMemberBalance,
    type UserBalance,
    type Payment
} from '../app/api';
import { useToast } from './Toast';
import { Skeleton } from './Skeleton';
import { format } from 'date-fns';

export default function Team() {
    const [users, setUsers] = useState<User[]>([]);
    const [balances, setBalances] = useState<TeamMemberBalance[]>([]);
    const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedUserBalance, setSelectedUserBalance] = useState<UserBalance | null>(null);
    const { showToast } = useToast();

    // New User Form
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState<UserRole>('DEV');
    const [payRate, setPayRate] = useState(25);

    // Pay Form
    const [payAmount, setPayAmount] = useState(0);
    const [payMonth, setPayMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [payNote, setPayNote] = useState('');

    // Edit Form
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState<UserRole>('DEV');
    const [editPayRate, setEditPayRate] = useState(25);

    useEffect(() => {
        loadData();
        const interval = setInterval(() => {
            getActiveTimers().then(setActiveTimers).catch(console.error);
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            const [u, a, b] = await Promise.all([getUsers(), getActiveTimers(), getTeamBalances()]);
            setUsers(u);
            setActiveTimers(a);
            setBalances(b);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleInvite(e: React.FormEvent) {
        e.preventDefault();
        try {
            const newUser = await createUser({ email, name, role, defaultPayRate: payRate });
            setUsers(prev => [...prev, newUser]);
            showToast(`${name} agregado al equipo con tarifa $${payRate}/hr`, 'success');
            setShowModal(false);
            resetForm();
            loadData();
        } catch (err: any) {
            showToast(err.message || 'Error al agregar', 'error');
        }
    }

    async function handleUpdateRate(userId: string, newRate: number) {
        try {
            await updateUser(userId, { defaultPayRate: newRate });
            showToast('Tarifa actualizada', 'success');
            loadData();
        } catch (err: any) {
            showToast(err.message || 'Error', 'error');
        }
    }

    function handleOpenEditModal(user: User) {
        setEditingUser(user);
        setEditName(user.name);
        setEditRole(user.role);
        setEditPayRate(user.defaultPayRate ?? 25);
        setShowEditModal(true);
    }

    async function handleEditSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!editingUser) return;
        try {
            await updateUser(editingUser.id, { name: editName, role: editRole, defaultPayRate: editPayRate });
            showToast('Usuario actualizado', 'success');
            setShowEditModal(false);
            setEditingUser(null);
            loadData();
        } catch (err: any) {
            showToast(err.message || 'Error', 'error');
        }
    }

    async function handleDeleteUser(user: User) {
        if (!confirm(`¿Eliminar a ${user.name}? Esta acción no se puede deshacer.`)) return;
        try {
            await deleteUser(user.id);
            showToast(`${user.name} eliminado`, 'success');
            loadData();
        } catch (err: any) {
            showToast(err.message || 'Error', 'error');
        }
    }

    async function handleOpenPayModal(userId: string) {
        setSelectedUserId(userId);
        try {
            const balance = await getUserBalance(userId);
            setSelectedUserBalance(balance);
            setPayAmount(Math.min(balance.balance, 500)); // Suggest paying up to $500 or full balance
            setShowPayModal(true);
        } catch (err: any) {
            showToast('Error cargando balance', 'error');
        }
    }

    async function handlePaySubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedUserId || payAmount <= 0) return;

        try {
            await createPayment({
                userId: selectedUserId,
                amount: payAmount,
                month: payMonth,
                note: payNote || undefined,
            });
            showToast(`Pago de $${payAmount} registrado`, 'success');
            setShowPayModal(false);
            setSelectedUserId(null);
            setSelectedUserBalance(null);
            setPayAmount(0);
            setPayNote('');
            loadData();
        } catch (err: any) {
            showToast(err.message || 'Error al registrar pago', 'error');
        }
    }

    function resetForm() {
        setEmail('');
        setName('');
        setRole('DEV');
        setPayRate(25);
    }

    function getBalanceForUser(userId: string): TeamMemberBalance | undefined {
        return balances.find(b => b.userId === userId);
    }

    if (loading) return (
        <div className="p-6 max-w-7xl mx-auto space-y-4">
            <Skeleton height="40px" width="200px" />
            <div className="space-y-3">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} height="80px" variant="rect" />)}
            </div>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto animate-fadeIn">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Equipo & Pagos</h2>
                    <p className="text-gray-500 dark:text-gray-400">Gestiona a tu equipo y registra pagos</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl transition-colors shadow-lg shadow-purple-500/30 flex items-center gap-2"
                >
                    <span>+</span> Nuevo Miembro
                </button>
            </div>

            {/* Active Now Section */}
            {activeTimers.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Trabajando Ahora ({activeTimers.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {activeTimers.map(timer => (
                            <div key={timer.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-green-100 dark:border-green-900/30 shadow-sm flex items-center gap-4">
                                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 font-bold border-2 border-green-500">
                                    {timer.user?.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-gray-900 dark:text-white truncate">{timer.user?.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {timer.task?.title || 'Sin tarea'}
                                    </p>
                                    <p className="text-xs text-blue-500 truncate">{timer.project?.name}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Team Table with Balances */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700 text-left">
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Miembro</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Tarifa/hr</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Horas</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Debe</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Pagado</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Saldo</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {users.filter(u => u.role === 'DEV').map(user => {
                            const balance = getBalanceForUser(user.id);
                            return (
                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-900 dark:text-white">{user.name}</span>
                                                <p className="text-xs text-gray-400">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-bold text-gray-900 dark:text-white">${balance?.defaultPayRate ?? (user as any).defaultPayRate ?? 25}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-300">
                                        {balance?.totalHours?.toFixed(1) ?? '0'}h
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-medium text-orange-600">${balance?.totalDebt?.toLocaleString() ?? '0'}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-medium text-green-600">${balance?.totalPaid?.toLocaleString() ?? '0'}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`font-bold text-lg ${(balance?.balance ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            ${balance?.balance?.toLocaleString() ?? '0'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleOpenPayModal(user.id)}
                                                disabled={(balance?.balance ?? 0) <= 0}
                                                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                                title="Pagar"
                                            >
                                                💰
                                            </button>
                                            <button
                                                onClick={() => handleOpenEditModal(user)}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-gray-500"
                                                title="Editar"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user)}
                                                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-red-500"
                                                title="Eliminar"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Admin Users (separate) */}
            {users.filter(u => u.role === 'ADMIN').length > 0 && (
                <div className="mt-8">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Administradores</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {users.filter(u => u.role === 'ADMIN').map(user => (
                            <div key={user.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <span className="font-medium text-gray-900 dark:text-white">{user.name}</span>
                                    <p className="text-xs text-gray-400">{user.email}</p>
                                </div>
                                <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                    ADMIN
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nuevo Miembro</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <form onSubmit={handleInvite} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre Completo</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                    placeholder="Ej: Jane Smith"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                    placeholder="jane@company.com"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
                                    <select
                                        value={role}
                                        onChange={e => setRole(e.target.value as UserRole)}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                    >
                                        <option value="DEV">Desarrollador</option>
                                        <option value="ADMIN">Administrador</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tarifa/hora</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={payRate}
                                            onChange={e => setPayRate(Number(e.target.value))}
                                            className="w-full pl-8 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2 rounded-xl hover:shadow-lg hover:from-purple-700 hover:to-purple-800 transition-all font-medium"
                                >
                                    Crear Miembro
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Editar Miembro</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                                <input
                                    type="text"
                                    required
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
                                    <select
                                        value={editRole}
                                        onChange={e => setEditRole(e.target.value as UserRole)}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                    >
                                        <option value="DEV">Desarrollador</option>
                                        <option value="ADMIN">Administrador</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tarifa/hora</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={editPayRate}
                                            onChange={e => setEditPayRate(Number(e.target.value))}
                                            className="w-full pl-8 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all font-medium"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Pay Modal */}
            {showPayModal && selectedUserBalance && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-slate-800">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">💰 Registrar Pago</h3>
                                <button onClick={() => setShowPayModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                            </div>
                            <p className="text-gray-500 text-sm mt-1">Para: <span className="font-bold text-gray-900 dark:text-white">{selectedUserBalance.userName}</span></p>
                        </div>

                        <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <div className="text-xs text-gray-500 uppercase">Debe</div>
                                    <div className="text-lg font-bold text-orange-600">${selectedUserBalance.totalDebt.toLocaleString()}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase">Pagado</div>
                                    <div className="text-lg font-bold text-green-600">${selectedUserBalance.totalPaid.toLocaleString()}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase">Saldo</div>
                                    <div className="text-lg font-bold text-red-600">${selectedUserBalance.balance.toLocaleString()}</div>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handlePaySubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monto a Pagar</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        max={selectedUserBalance.balance}
                                        value={payAmount}
                                        onChange={e => setPayAmount(Number(e.target.value))}
                                        className="w-full pl-8 pr-4 py-3 text-2xl font-bold rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                    Saldo después del pago: <span className="font-bold text-emerald-600">${(selectedUserBalance.balance - payAmount).toLocaleString()}</span>
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mes que cubre</label>
                                <input
                                    type="month"
                                    value={payMonth}
                                    onChange={e => setPayMonth(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nota (opcional)</label>
                                <input
                                    type="text"
                                    value={payNote}
                                    onChange={e => setPayNote(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                    placeholder="Ej: Pago parcial quincena 1"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowPayModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={payAmount <= 0}
                                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 text-white px-4 py-2 rounded-xl hover:shadow-lg hover:from-emerald-700 hover:to-emerald-800 transition-all font-medium"
                                >
                                    Confirmar Pago
                                </button>
                            </div>
                        </form>

                        {/* Payment History */}
                        {selectedUserBalance.payments && selectedUserBalance.payments.length > 0 && (
                            <div className="p-6 border-t border-gray-100 dark:border-slate-800 max-h-48 overflow-y-auto">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Historial de Pagos</h4>
                                <div className="space-y-2">
                                    {selectedUserBalance.payments.map(p => (
                                        <div key={p.id} className="flex justify-between items-center text-sm bg-gray-50 dark:bg-slate-800 p-2 rounded-lg">
                                            <div>
                                                <span className="font-medium text-gray-900 dark:text-white">${p.amount.toLocaleString()}</span>
                                                <span className="text-gray-400 ml-2">{p.month}</span>
                                            </div>
                                            <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
