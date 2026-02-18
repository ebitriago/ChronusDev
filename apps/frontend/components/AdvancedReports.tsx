'use client';

import { useState, useEffect } from 'react';
import {
    getProjects,
    getUsers,
    getClients,
    exportReport,
    type Project,
    type User,
    type Client
} from '../app/api';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface AdvancedReportsProps {
    user?: User | null;
}

export default function AdvancedReports({ user }: AdvancedReportsProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [clients, setClients] = useState<Client[]>([]);

    // Filters
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [selectedUserId, setSelectedUserId] = useState(user?.role === 'DEV' ? user.id : '');
    const [reportData, setReportData] = useState<any>(null);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');

    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    // Effect to enforce user selection for DEVs
    useEffect(() => {
        if (user?.role === 'DEV' && user.id) {
            setSelectedUserId(user.id);
        }
    }, [user]);

    async function loadData() {
        try {
            const [p, u, c] = await Promise.all([
                getProjects(),
                getUsers(),
                getClients()
            ]);
            setProjects(Array.isArray(p) ? p : []);
            setUsers(Array.isArray(u) ? u : []);
            setClients(Array.isArray(c) ? c : []);
        } catch (err) {
            console.error('Error loading filter data:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handlePreview() {
        setExporting(true);
        setReportData(null);
        try {
            const exportUserId = user?.role === 'DEV' ? user.id : selectedUserId;
            const data = await exportReport({
                startDate,
                endDate,
                userId: exportUserId,
                projectId: selectedProjectId,
                clientId: selectedClientId,
                format: 'json'
            });
            setReportData(data);
        } catch (err) {
            alert('Error al generar la vista previa');
            console.error(err);
        } finally {
            setExporting(false);
        }
    }

    async function handleExport(format: 'pdf' | 'csv') {
        setExporting(true);
        try {
            const exportUserId = user?.role === 'DEV' ? user.id : selectedUserId;
            await exportReport({
                startDate,
                endDate,
                userId: exportUserId,
                projectId: selectedProjectId,
                clientId: selectedClientId,
                format
            });
        } catch (err) {
            alert('Error al exportar el reporte');
            console.error(err);
        } finally {
            setExporting(false);
        }
    }

    function clearFilters() {
        setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
        if (user?.role !== 'DEV') {
            setSelectedUserId('');
        }
        setSelectedProjectId('');
        setSelectedClientId('');
        setReportData(null);
    }

    const hasActiveFilters = (user?.role !== 'DEV' && selectedUserId !== '') || selectedProjectId !== '' || selectedClientId !== '';

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fadeIn overflow-y-auto h-full pb-20">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                        Reportes Avanzados
                    </h1>
                    <div className="h-1 w-20 bg-blue-600 rounded-full" />
                </div>
            </header>

            {/* Filters Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 mb-8 transition-all">
                <div className="flex justify-between items-center mb-6 px-1">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Configuración del Reporte
                    </h3>
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="text-sm text-red-500 hover:text-red-600 font-medium flex items-center gap-1 transition-colors bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-lg"
                        >
                            <span>✕</span> Limpiar
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Dates */}
                    <div className="space-y-2 col-span-1 md:col-span-2">
                        <label className="block text-sm font-bold text-slate-900 dark:text-white">Rango de Fecha</label>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium"
                            />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium"
                            />
                        </div>
                    </div>

                    {/* User */}
                    {user?.role !== 'DEV' && (
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-900 dark:text-white">Usuario</label>
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium"
                            >
                                <option value="">Todos los Usuarios</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Client */}
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-900 dark:text-white">Cliente</label>
                        <select
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium"
                        >
                            <option value="">Todos los Clientes</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* Project */}
                    <div className="space-y-2 lg:col-start-1 lg:col-end-2">
                        <label className="block text-sm font-bold text-slate-900 dark:text-white">Proyecto</label>
                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium"
                        >
                            <option value="">Todos los Proyectos</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    {/* Action Buttons */}
                    <div className="lg:col-span-4 flex flex-col sm:flex-row gap-4 mt-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <button
                            onClick={handlePreview}
                            disabled={exporting}
                            className="flex-1 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-2 group text-lg"
                        >
                            {exporting ? <span className="animate-spin">🔄</span> : <span>👁️</span>}
                            Ver Reporte en Pantalla
                        </button>
                    </div>
                </div>
            </div>

            {/* Report Preview */}
            {reportData && (
                <div className="animate-fadeIn space-y-8 mb-20">
                    <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
                        <div>
                            <h2 className="text-2xl font-bold">Vista Previa del Reporte</h2>
                            <p className="text-slate-400 text-sm">
                                {format(new Date(startDate), 'dd MMM yyyy')} - {format(new Date(endDate), 'dd MMM yyyy')}
                            </p>
                        </div>
                        <div className="flex gap-3 mt-4 md:mt-0">
                            <button
                                onClick={() => handleExport('csv')}
                                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                                📊 Exportar CSV
                            </button>
                            <button
                                onClick={() => handleExport('pdf')}
                                className="px-5 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg font-bold transition-colors flex items-center gap-2 shadow-lg"
                            >
                                📄 Exportar PDF
                            </button>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wide mb-2">Total Horas</h3>
                            <div className="text-4xl font-black text-slate-900 dark:text-white">
                                {(reportData.summary?.totalHours || 0).toFixed(2)} <span className="text-lg text-slate-400 font-normal">hrs</span>
                            </div>
                        </div>
                        {user?.role !== 'DEV' && (
                            <>
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                                    <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wide mb-2">Costo Total (Bill)</h3>
                                    <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400">
                                        ${(reportData.summary?.totalBillCost || 0).toLocaleString()}
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                                    <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wide mb-2">Costo Nómina (Pay)</h3>
                                    <div className="text-4xl font-black text-blue-600 dark:text-blue-400">
                                        ${(reportData.summary?.totalPayCost || 0).toLocaleString()}
                                    </div>
                                </div>
                            </>
                        )}
                        {user?.role === 'DEV' && (
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                                <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wide mb-2">Mis Ganancias Estimadas</h3>
                                <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400">
                                    ${(reportData.summary?.totalPayCost || 0).toLocaleString()}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Table */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Fecha</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Proyecto</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Usuario</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Descripción</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Horas</th>
                                        {user?.role !== 'DEV' && <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Costo Check</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {reportData.logs?.map((log: any) => (
                                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="p-4 text-sm font-medium text-slate-900 dark:text-white whitespace-nowrap">
                                                {format(new Date(log.date), 'dd/MM/yyyy')}
                                            </td>
                                            <td className="p-4 text-sm text-slate-700 dark:text-slate-300">
                                                <div className="font-bold">{log.project?.name}</div>
                                                <div className="text-xs text-slate-400">{log.project?.client?.name}</div>
                                            </td>
                                            <td className="p-4 text-sm text-slate-700 dark:text-slate-300">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                                                        {log.user?.name?.charAt(0)}
                                                    </div>
                                                    {log.user?.name}
                                                    {log.user?.role === 'DEV' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700 font-bold">DEV</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate" title={log.description}>
                                                {log.description}
                                            </td>
                                            <td className="p-4 text-sm font-bold text-slate-900 dark:text-white text-right">
                                                {log.hours}
                                            </td>
                                            {user?.role !== 'DEV' && (
                                                <td className="p-4 text-sm font-medium text-slate-700 dark:text-slate-300 text-right">
                                                    ${(log.hours * (log.projectMember?.billRate || 0)).toFixed(2)}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {(!reportData.logs || reportData.logs.length === 0) && (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-slate-400">
                                                No se encontraron registros para los filtros seleccionados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
