'use client';

import { useState, useEffect } from 'react';
import { getProjects, getProjectSummary, downloadPayrollCSV, type Project, type ProjectSummary } from '../app/api';
import { format } from 'date-fns';
import { useToast } from './Toast';
import { Skeleton } from './Skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export default function Reports() {
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
        }
    }, [selectedProjectId]);

    async function loadProjects() {
        try {
            const data = await getProjects();
            setProjects(data);
            if (data.length > 0) setSelectedProjectId(data[0].id);
        } catch (err) {
            console.error(err);
        } finally {
            if (!selectedProjectId) setLoading(false);
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
        <div className="p-6 max-w-7xl mx-auto animate-fadeIn">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Reportes Financieros</h2>
                    <p className="text-gray-500 dark:text-gray-400">Control de presupuesto y progreso</p>
                </div>

                <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm focus:ring-2 focus:ring-purple-500 outline-none"
                >
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
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
                <div className="space-y-6">
                    {/* Main Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Presupuesto</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {summary.currency} {summary.budget.toLocaleString()}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Gastado (Facturable)</div>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {summary.currency} {summary.spent.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">Coste Interno: {summary.currency} {summary.project?.id ? '...' : ''}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Restante</div>
                            <div className={`text-2xl font-bold ${summary.remaining < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {summary.currency} {summary.remaining.toLocaleString()}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Horas Totales</div>
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                {summary.totalHours.toFixed(2)} h
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Progress Chart */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-6">Distribución de Tareas</h3>
                            <div className="h-64 flex items-center justify-center">
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
                                        >
                                            {taskData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap justify-center gap-4 mt-4">
                                {taskData.map((entry, index) => (
                                    <div key={entry.name} className="flex items-center gap-2 text-sm">
                                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                        <span className="text-gray-600 dark:text-gray-300">{entry.name}: {entry.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="bg-gradient-to-br from-gray-900 to-slate-800 p-8 rounded-2xl shadow-lg text-white flex flex-col justify-center items-start">
                            <h3 className="text-2xl font-bold mb-2">Exportar Nómina</h3>
                            <p className="text-gray-400 mb-6">Descarga el reporte detallado de horas y costos para el pago de nómina de este mes.</p>

                            <button
                                onClick={() => downloadPayrollCSV(selectedProjectId, format(new Date(), 'yyyy-MM'))}
                                className="bg-white text-gray-900 px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition-colors flex items-center gap-2"
                            >
                                <span>⬇️</span> Descargar CSV
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
