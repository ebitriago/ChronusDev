'use client';

import { useState, useEffect } from 'react';
import { getTeamEarnings, downloadMemberEarningsCSV, type TeamEarning, type TeamEarningsResponse } from '../app/api';
import { format } from 'date-fns';
import { useToast } from './Toast';
import { Skeleton } from './Skeleton';

export default function TeamEarningsReport() {
    const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [data, setData] = useState<TeamEarningsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
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

    // Calculate totals
    const totalHours = data?.earnings.reduce((acc, e) => acc + e.totalHours, 0) ?? 0;
    const totalPay = data?.earnings.reduce((acc, e) => acc + e.totalPay, 0) ?? 0;
    const totalBill = data?.earnings.reduce((acc, e) => acc + e.totalBill, 0) ?? 0;

    return (
        <div className="p-6 max-w-7xl mx-auto animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">💰 Nómina del Equipo</h2>
                    <p className="text-gray-500">Reporte de horas trabajadas y ganancias por miembro</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
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
                    <div className="text-sm opacity-80 mb-1">Total a Pagar</div>
                    <div className="text-3xl font-bold">${totalPay.toLocaleString()}</div>
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
                        <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100">
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
                        <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Sin actividad este mes</h3>
                            <p className="text-gray-500">No hay horas registradas para {month}</p>
                        </div>
                    ) : (
                        data.earnings.map((member) => (
                            <div
                                key={member.userId}
                                className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all"
                            >
                                {/* Member Row */}
                                <div
                                    className="p-5 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => setExpandedUser(expandedUser === member.userId ? null : member.userId)}
                                >
                                    {/* Avatar */}
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-lg">
                                        {member.userName.charAt(0)}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-900">{member.userName}</h3>
                                        <div className="flex items-center gap-4 text-sm text-gray-500">
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
                                                {member.projects.length} proyectos
                                            </span>
                                        </div>
                                    </div>

                                    {/* Amount */}
                                    <div className="text-right">
                                        <div className="text-xl font-bold text-emerald-600">${member.totalPay.toLocaleString()}</div>
                                        <div className="text-xs text-gray-400">a cobrar</div>
                                    </div>

                                    {/* Download Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDownload(member.userId, member.userName);
                                        }}
                                        className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        CSV
                                    </button>

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

                                {/* Expanded Projects Detail */}
                                {expandedUser === member.userId && (
                                    <div className="border-t border-gray-100 bg-gray-50 p-5 animate-slideDown">
                                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Desglose por Proyecto</h4>
                                        <div className="space-y-2">
                                            {member.projects.map((proj) => (
                                                <div key={proj.projectId} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100">
                                                    <span className="font-medium text-gray-900">{proj.projectName}</span>
                                                    <div className="flex items-center gap-6 text-sm">
                                                        <span className="text-gray-500">{proj.hours.toFixed(1)}h</span>
                                                        <span className="font-bold text-emerald-600">${proj.pay.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
