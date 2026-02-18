'use client';

import { useState, useEffect } from 'react';
import { getProjects, getProjectSummary, downloadPayrollCSV, type Project, type ProjectSummary } from '../app/api';
import { format } from 'date-fns';
import { useToast } from './Toast';
import { Skeleton } from './Skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

import { type User } from '../app/api';

// New Props
interface ReportsProps {
    user?: User | null;
}

export default function Reports({ user }: ReportsProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [summary, setSummary] = useState<ProjectSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
        loadProjects();
    }, []);

    useEffect(() => {
        if (selectedProjectId) {
            loadSummary(selectedProjectId);
        } else if (projects.length > 0) {
            loadGlobalSummary();
        }
    }, [selectedProjectId, projects]);

    async function loadProjects() {
        try {
            const data = await getProjects();
            const projectsArray = Array.isArray(data) ? data : [];
            setProjects(projectsArray);
            if (projectsArray.length > 0) setSelectedProjectId('');
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function loadGlobalSummary() {
        setLoading(true);
        try {
            const summaries = await Promise.all(projects.map(p => getProjectSummary(p.id)));
            const globalSum: ProjectSummary = {
                project: { id: '', name: 'Vista Global', clientId: '', budget: 0, currency: '', status: 'ACTIVE' },
                budget: summaries.reduce((acc, s) => acc + (s.budget || 0), 0),
                spent: summaries.reduce((acc, s) => acc + (s.spent || 0), 0),
                remaining: summaries.reduce((acc, s) => acc + (s.remaining || 0), 0),
                currency: summaries[0]?.currency || 'USD',
                totalHours: summaries.reduce((acc, s) => acc + (s.totalHours || 0), 0),
                totalPayCost: summaries.reduce((acc, s) => acc + (s.totalPayCost || 0), 0),
                tasksByStatus: {
                    DONE: summaries.reduce((acc, s) => acc + (s.tasksByStatus?.DONE || 0), 0),
                    IN_PROGRESS: summaries.reduce((acc, s) => acc + (s.tasksByStatus?.IN_PROGRESS || 0), 0),
                    REVIEW: summaries.reduce((acc, s) => acc + (s.tasksByStatus?.REVIEW || 0), 0),
                    TODO: summaries.reduce((acc, s) => acc + (s.tasksByStatus?.TODO || 0), 0),
                    BACKLOG: summaries.reduce((acc, s) => acc + (s.tasksByStatus?.BACKLOG || 0), 0),
                },
                progress: 0
            };
            setSummary(globalSum);
        } catch (err) {
            showToast('Error cargando reporte global', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function loadSummary(projectId: string) {
        setLoading(true);
        try {
            const data = await getProjectSummary(projectId);
            setSummary(data);
        } catch (err) {
            showToast('Error cargando reporte', 'error');
        } finally {
            setLoading(false);
        }
    }

    if (projects.length === 0 && !loading) return (
        <div className="p-6 text-center text-gray-500">No hay proyectos para reportar.</div>
    );

    const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];

    const taskData = summary ? [
        { name: 'Completado', value: summary.tasksByStatus.DONE },
        { name: 'En Progreso', value: summary.tasksByStatus.IN_PROGRESS },
        { name: 'Revisión', value: summary.tasksByStatus.REVIEW },
        { name: 'Por Hacer', value: summary.tasksByStatus.TODO },
        { name: 'Backlog', value: summary.tasksByStatus.BACKLOG },
    ].filter(d => d.value > 0) : [];

    return (
        <div className="p-6 max-w-7xl mx-auto animate-fadeIn space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-6">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600">
                        Reportes Financieros
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Análisis detallado de rendimiento y presupuesto
                    </p>
                </div>

                <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                    <span className="text-sm font-medium text-gray-500 px-2">Proyecto:</span>
                    <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-900 border-none text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer"
                    >
                        <option value="">🌐 Vista Global (Todos los proyectos)</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading || !summary ? (
                <div className="space-y-6">
                    <Skeleton height="150px" />
                    <div className="grid grid-cols-2 gap-6">
                        <Skeleton height="300px" />
                        <Skeleton height="300px" />
                    </div>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Budget Card */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="p-2 bg-blue-100 text-blue-600 rounded-lg text-lg">💰</span>
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        {user?.role === 'DEV' ? 'Valor Proyecto' : 'Presupuesto Total'}
                                    </span>
                                </div>
                                <div className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                                    {user?.role === 'DEV' ? (
                                        <span className="text-gray-400 text-xl font-normal">Confidencial</span>
                                    ) : (
                                        <span>{summary.currency} {summary.budget.toLocaleString()}</span>
                                    )}
                                </div>
                                {user?.role !== 'DEV' && (
                                    <div className="h-1 w-full bg-blue-100 rounded-full mt-4 overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Spent Card */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="p-2 bg-purple-100 text-purple-600 rounded-lg text-lg">💸</span>
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        {user?.role === 'DEV' ? 'Mis Ganancias (Estimadas)' : 'Gastado'}
                                    </span>
                                </div>
                                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 tracking-tight">
                                    {summary.currency} {summary.spent.toLocaleString()}
                                </div>
                                {user?.role !== 'DEV' && (
                                    <div className="flex justify-between items-center mt-4">
                                        <span className="text-xs text-gray-400">Coste Interno</span>
                                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                            {summary.currency} {(summary.totalPayCost || 0).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Remaining Card - Hide for DEV if budget is 0/hidden */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden group hover:shadow-md transition-all">
                            <div className={`absolute right-0 top-0 w-24 h-24 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-transform ${summary.remaining < 0 ? 'bg-red-500/5' : 'bg-emerald-500/5'}`} />
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={`p-2 rounded-lg text-lg ${summary.remaining < 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        {summary.remaining < 0 ? '⚠️' : '💹'}
                                    </span>
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Restante</span>
                                </div>
                                <div className={`text-3xl font-bold tracking-tight ${summary.remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {user?.role === 'DEV' ? '-' : `${summary.currency} ${summary.remaining.toLocaleString()}`}
                                </div>
                                {user?.role !== 'DEV' && (
                                    <div className="mt-4 text-xs font-medium text-gray-400">
                                        {summary.budget > 0 ? `${((summary.remaining / summary.budget) * 100).toFixed(1)}% del presupuesto` : 'N/A'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Hours Card */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute right-0 top-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="p-2 bg-orange-100 text-orange-600 rounded-lg text-lg">⏱️</span>
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Horas Totales</span>
                                </div>
                                <div className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                                    {summary.totalHours.toFixed(2)} <span className="text-lg font-normal text-gray-400">hrs</span>
                                </div>
                                <div className="mt-4 text-xs text-gray-400">
                                    {user?.role === 'DEV' ? 'Mis horas registradas' : 'Registradas en tareas'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Progress Chart */}
                        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
                                    Distribución de Tareas
                                </h3>
                                <button className="text-xs text-purple-600 font-bold hover:bg-purple-50 px-3 py-1 rounded-lg transition-colors">
                                    Ver Detalle →
                                </button>
                            </div>

                            <div className="flex flex-col md:flex-row items-center gap-8">
                                <div className="h-64 w-64 flex-shrink-0 relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={taskData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                                cornerRadius={6}
                                            >
                                                {taskData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{
                                                    borderRadius: '16px',
                                                    border: 'none',
                                                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                    padding: '12px 16px'
                                                }}
                                                itemStyle={{ color: '#374151', fontWeight: 600, fontSize: '13px' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    {/* Center Text */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-3xl font-bold text-gray-800 dark:text-white">
                                            {taskData.reduce((acc, curr) => acc + curr.value, 0)}
                                        </span>
                                        <span className="text-xs text-gray-400 font-medium">Tareas</span>
                                    </div>
                                </div>

                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                                    {taskData.map((entry, index) => (
                                        <div key={entry.name} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-700">
                                            <div className="flex items-center gap-3">
                                                <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{entry.name}</span>
                                            </div>
                                            <span className="text-sm font-bold text-gray-900 dark:text-white bg-white dark:bg-slate-600 px-2 py-0.5 rounded-md shadow-sm">
                                                {entry.value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Actions & Export */}
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-2xl shadow-xl text-white flex flex-col justify-between relative overflow-hidden">
                            {/* Decorative background circle */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>

                            <div>
                                <h3 className="text-2xl font-bold mb-2 relative z-10">Exportar Nómina</h3>
                                <p className="text-slate-300 mb-8 relative z-10 text-sm leading-relaxed">
                                    Descarga el reporte detallado de horas y costos para el pago de nómina de este mes. Incluye desglose por miembro del equipo y tareas.
                                </p>
                            </div>

                            <div className="space-y-3 relative z-10">
                                {selectedProjectId ? (
                                    <button
                                        onClick={() => downloadPayrollCSV(selectedProjectId, format(new Date(), 'yyyy-MM'))}
                                        className="w-full bg-white text-slate-900 px-6 py-4 rounded-xl font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-3 shadow-lg group"
                                    >
                                        <span className="text-xl group-hover:-translate-y-1 transition-transform">⬇️</span>
                                        <span>Descargar CSV</span>
                                    </button>
                                ) : (
                                    <div className="bg-white/10 text-slate-300 p-4 rounded-xl text-center text-sm border border-white/10">
                                        Selecciona un proyecto específico para exportar la nómina detallada.
                                    </div>
                                )}
                                <button
                                    onClick={() => showToast('Exportación PDF próximamente', 'info')}
                                    className="w-full bg-slate-700/50 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 border border-slate-600"
                                >
                                    <span>📄</span> Imprimir Resumen
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
