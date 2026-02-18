'use client';

import { useState, useEffect } from 'react';
import { getPayments, type Payment, deletePayment } from '../app/api';
import { useToast } from './Toast';
import { format } from 'date-fns';
import { Skeleton } from './Skeleton';

export default function PaymentHistory() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();
    const [filterUser, setFilterUser] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const data = await getPayments();
            setPayments(data);
        } catch (err: any) {
            showToast(err.message || 'Error loading payments', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Estás seguro de eliminar este pago?')) return;
        try {
            await deletePayment(id);
            setPayments(payments.filter(p => p.id !== id));
            showToast('Pago eliminado correctamente', 'success');
        } catch (err: any) {
            showToast(err.message || 'Error eliminando pago', 'error');
        }
    }

    // Filter Logic
    const filteredPayments = payments.filter(p => {
        if (!filterUser) return true;
        return p.userName?.toLowerCase().includes(filterUser.toLowerCase());
    });

    const totalPaid = filteredPayments.reduce((acc, p) => acc + p.amount, 0);

    return (
        <div className="p-6 max-w-7xl mx-auto animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">💸 Historial de Pagos</h2>
                    <p className="text-gray-500 dark:text-gray-400">Registro histórico de todos los pagos realizados</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        placeholder="Buscar por miembro..."
                        value={filterUser}
                        onChange={(e) => setFilterUser(e.target.value)}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-gray-900 dark:text-white"
                    />
                    <button
                        onClick={loadData}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Recargar"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Stats Card */}
            <div className="mb-6 bg-gradient-to-r from-emerald-500 to-teal-600 p-6 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
                <div className="text-sm opacity-80 mb-1">Total Pagado (Filtrado)</div>
                <div className="text-3xl font-bold">${totalPaid.toLocaleString()}</div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-gray-400 font-medium">
                            <tr>
                                <th className="px-6 py-4">Fecha Pago</th>
                                <th className="px-6 py-4">Miembro</th>
                                <th className="px-6 py-4">Mes Aplicado</th>
                                <th className="px-6 py-4">Nota</th>
                                <th className="px-6 py-4 text-right">Monto</th>
                                <th className="px-6 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i}>
                                        <td className="px-6 py-4"><Skeleton width="100px" /></td>
                                        <td className="px-6 py-4"><Skeleton width="150px" /></td>
                                        <td className="px-6 py-4"><Skeleton width="80px" /></td>
                                        <td className="px-6 py-4"><Skeleton width="200px" /></td>
                                        <td className="px-6 py-4 text-right"><Skeleton width="60px" /></td>
                                        <td className="px-6 py-4"><Skeleton width="40px" /></td>
                                    </tr>
                                ))
                            ) : filteredPayments.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">
                                        No se encontraron pagos registrados.
                                    </td>
                                </tr>
                            ) : (
                                filteredPayments.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                                            {format(new Date(payment.createdAt), 'dd MMM yyyy')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900 dark:text-white">{payment.userName}</div>
                                            <div className="text-xs text-gray-400">{payment.user?.email}</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                            <span className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide">
                                                {payment.month}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400 italic">
                                            {payment.note || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                            ${payment.amount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <a
                                                    href={`/finance/receipt/${payment.id}`}
                                                    target="_blank"
                                                    className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                                                    title="Ver Recibo"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                </a>
                                                <button
                                                    onClick={() => handleDelete(payment.id)}
                                                    className="text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                                    title="Eliminar Pago"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
