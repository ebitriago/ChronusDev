'use client';

import { useState, useEffect } from 'react';
import { getTeamEarnings, downloadMemberEarningsCSV, createPayment, type TeamEarning, type TeamEarningsResponse } from '../app/api';
import { format } from 'date-fns';
import { useToast } from './Toast';
import { Skeleton } from './Skeleton';

export default function TeamEarningsReport() {
    const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [data, setData] = useState<TeamEarningsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentUserId, setPaymentUserId] = useState('');
    const [paymentUserName, setPaymentUserName] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNote, setPaymentNote] = useState('');

    const { showToast } = useToast();

    useEffect(() => {
        loadData();
    }, [month]);

    async function loadData() {
        setLoading(true);
        try {
            const result = await getTeamEarnings(month);
            setData(result);
        } catch (err: any) {
            console.error(err);
            showToast('Error cargando reporte', 'error');
        } finally {
            setLoading(false);
        }
    }

    function handleDownload(userId: string, userName: string) {
        downloadMemberEarningsCSV(userId, month);
        showToast(`Descargando reporte de ${userName}`, 'success');
    }

    function openPaymentModal(userId: string, userName: string, amount: number) {
        setPaymentUserId(userId);
        setPaymentUserName(userName);
        setPaymentAmount(amount.toString());
        setPaymentNote(`Pago nómina ${month}`);
        setShowPaymentModal(true);
    }

    async function handleCreatePayment() {
        if (!paymentAmount || isNaN(Number(paymentAmount))) {
            showToast('Monto inválido', 'error');
            return;
        }

        try {
            await createPayment({
                userId: paymentUserId,
                amount: Number(paymentAmount),
                month: month,
                note: paymentNote
            });
            showToast('Pago registrado correctamente', 'success');
            setShowPaymentModal(false);
            // Reload data to reflect changes (if API returns updated data, or strictly just to refresh state)
            loadData();
        } catch (err: any) {
            showToast(err.message || 'Error registrando pago', 'error');
        }
    }

    // Calculate totals
    const totalHours = data?.earnings.reduce((acc, e) => acc + e.totalHours, 0) ?? 0;
    const totalBalance = data?.earnings.reduce((acc, e) => acc + (e.balance || 0), 0) ?? 0;
    const totalBill = data?.earnings.reduce((acc, e) => acc + (e.totalBill || 0), 0) ?? 0;

    return (
        <div className="p-6 max-w-7xl mx-auto animate-fadeIn">
            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                            <h3 className="font-bold text-lg">💸 Registrar Pago</h3>
                            <button onClick={() => setShowPaymentModal(false)} className="text-white/80 hover:text-white">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Registrando pago para <span className="font-bold text-gray-800 dark:text-gray-200">{paymentUserName}</span>
                            </p>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monto a Pagar ($)</label>
                                <input
                                    type="number"
                                    className="w-full p-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl font-bold text-lg text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500"
                                    value={paymentAmount}
                                    onChange={e => setPaymentAmount(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nota / Referencia</label>
                                <textarea
                                    className="w-full p-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white"
                                    rows={2}
                                    value={paymentNote}
                                    onChange={e => setPaymentNote(e.target.value)}
                                    placeholder="Ej: Transferencia #123456"
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3">
                            <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg">Cancelar</button>
                            <button onClick={handleCreatePayment} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium shadow-lg shadow-emerald-500/30">Confirmar Pago</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">💰 Nómina del Equipo</h2>
                    <p className="text-gray-500 dark:text-gray-400">Reporte de horas trabajadas y ganancias por miembro</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all dark:text-white"
                        />
                        <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-blue-500/30">
                    <div className="text-sm opacity-80 mb-1">Horas Totales</div>
                    <div className="text-3xl font-bold">{totalHours.toFixed(1)}h</div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-2xl text-white shadow-lg shadow-emerald-500/30">
                    <div className="text-sm opacity-80 mb-1">Total Adeudado</div>
                    <div className="text-3xl font-bold">${totalBalance.toLocaleString()}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-6 rounded-2xl text-white shadow-lg shadow-purple-500/30">
                    <div className="text-sm opacity-80 mb-1">Facturado a Clientes</div>
                    <div className="text-3xl font-bold">${totalBill.toLocaleString()}</div>
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
                            <div className="flex items-center gap-4">
                                <Skeleton variant="circle" width={48} height={48} />
                                <div className="flex-1 space-y-2">
                                    <Skeleton variant="text" width="30%" height={20} />
                                    <Skeleton variant="text" width="50%" height={16} />
                                </div>
                                <Skeleton variant="rect" width={100} height={36} className="rounded-xl" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Team List */}
            {!loading && data && (
                <div className="space-y-4">
                    {data.earnings.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 border border-gray-100 dark:border-slate-700 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Sin actividad este mes</h3>
                            <p className="text-gray-500 dark:text-gray-400">No hay horas registradas para {month}</p>
                        </div>
                    ) : (
                        data.earnings.map((member) => (
                            <div
                                key={member.userId}
                                className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-all"
                            >
                                {/* Member Row */}
                                <div
                                    className="p-5 flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                                    onClick={() => setExpandedUser(expandedUser === member.userId ? null : member.userId)}
                                >
                                    {/* Avatar */}
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-lg">
                                        {member.userName.charAt(0)}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-900 dark:text-white">{member.userName}</h3>
                                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                            <span className="flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {member.totalHours.toFixed(1)}h
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                </svg>
                                                {member.projectCount || member.projects.length} proyectos
                                            </span>
                                        </div>
                                    </div>

                                    {/* Amount */}
                                    <div className="text-right">
                                        <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">${(member.balance || 0).toLocaleString()}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Monto Adeudado</div>
                                        <div className="text-[10px] text-gray-400 mt-1">
                                            Gen: <span className="font-medium">${member.totalDebt.toLocaleString()}</span> •
                                            Pag: <span className="font-medium">${member.totalPaid.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => openPaymentModal(member.userId, member.userName, member.totalPay)}
                                            className="hidden sm:flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                                            title="Registrar Pago"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            Pagar
                                        </button>

                                        <button
                                            onClick={() => handleDownload(member.userId, member.userName)}
                                            className="flex items-center gap-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                                            title="Descargar CSV"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            CSV
                                        </button>
                                    </div>

                                    {/* Expand Icon */}
                                    <svg
                                        className={`w-5 h-5 text-gray-400 transition-transform ${expandedUser === member.userId ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>

                                {/* Expanded Details */}
                                {expandedUser === member.userId && (
                                    <MemberDetailView
                                        userId={member.userId}
                                        month={month}
                                        onClose={() => setExpandedUser(null)}
                                        onPayment={() => openPaymentModal(member.userId, member.userName, member.balance)}
                                    />
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function MemberDetailView({ userId, month, onClose, onPayment }: { userId: string, month: string, onClose: () => void, onPayment: () => void }) {
    const [details, setDetails] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDetails();
    }, [userId, month]);

    async function loadDetails() {
        setLoading(true);
        try {
            const { getMemberDetails } = await import('../app/api'); // Dynamic import to avoid circular dep issues if any
            const data = await getMemberDetails(userId, month);
            setDetails(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div className="p-8 text-center text-gray-400">Cargando detalles...</div>;

    return (
        <div className="border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 p-5 animate-slideDown">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actividad Diaria Detallada</h4>
                <div className="flex gap-2">
                    <button onClick={onClose} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Cerrar</button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onPayment(); }}
                        className="sm:hidden flex items-center gap-1 bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg shadow-emerald-500/20"
                    >
                        💸 Pagar
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 dark:bg-slate-700/50 text-gray-500 dark:text-gray-400 font-medium">
                        <tr>
                            <th className="p-3 rounded-l-lg">Fecha</th>
                            <th className="p-3">Proyecto</th>
                            <th className="p-3">Tareas</th>
                            <th className="p-3 text-right">Horas</th>
                            <th className="p-3 text-right">Tarifa</th>
                            <th className="p-3 rounded-r-lg text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {details.map((day: any) => (
                            <tr key={day.id} className="hover:bg-white dark:hover:bg-slate-700/50 transition-colors">
                                <td className="p-3 font-medium text-gray-900 dark:text-white">{day.date}</td>
                                <td className="p-3 text-gray-600 dark:text-gray-300">{day.project}</td>
                                <td className="p-3 text-gray-500 dark:text-gray-400 max-w-xs truncate" title={day.taskSummary}>
                                    <span className="font-bold text-gray-700 dark:text-gray-200 mr-2">{day.taskCount} tareas:</span>
                                    {day.taskSummary || 'Sin tareas específicas'}
                                </td>
                                <td className="p-3 text-right font-mono text-gray-900 dark:text-gray-200">{day.hours.toFixed(2)}h</td>
                                <td className="p-3 text-right text-gray-400">${day.rate}/h</td>
                                <td className="p-3 text-right font-bold text-gray-900 dark:text-white">${day.amount.toFixed(2)}</td>
                            </tr>
                        ))}
                        {details.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-400">No hay actividad registrada en este periodo.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
