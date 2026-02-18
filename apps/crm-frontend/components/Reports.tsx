'use client';

import { useState, useEffect } from 'react';
import {
    getProjects, getProjectSummary, downloadPayrollCSV,
    getSalesReport, getSupportReport, getCustomerReport,
    getTrendsReport, getComparisonReport, getReportPDFPreview,
    type SalesReport, type SupportReport, type CustomerReport,
    type TrendsReport, type ComparisonReport, type ProjectSummary, type Project
} from '../app/api';
import { useToast } from './Toast';
import { Skeleton } from './Skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line, Area, AreaChart } from 'recharts';
import { format } from 'date-fns';

export default function Reports() {
    type Tab = 'sales' | 'support' | 'customers' | 'finance' | 'trends';
    const [activeTab, setActiveTab] = useState<Tab>('sales');
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    // Data States
    const [salesData, setSalesData] = useState<SalesReport | null>(null);
    const [supportData, setSupportData] = useState<SupportReport | null>(null);
    const [customerData, setCustomerData] = useState<CustomerReport | null>(null);
    const [trendsData, setTrendsData] = useState<TrendsReport | null>(null);
    const [comparisonData, setComparisonData] = useState<ComparisonReport | null>(null);

    // PDF Preview State
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [showPdfPreview, setShowPdfPreview] = useState(false);

    // Finance State
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [summary, setSummary] = useState<ProjectSummary | null>(null);

    useEffect(() => {
        loadTabData();
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'finance' && selectedProjectId) {
            loadFinanceSummary(selectedProjectId);
        }
    }, [selectedProjectId]);

    async function loadTabData() {
        setLoading(true);
        try {
            if (activeTab === 'sales') {
                const data = await getSalesReport();
                setSalesData(data);
            } else if (activeTab === 'support') {
                const data = await getSupportReport();
                setSupportData(data);
            } else if (activeTab === 'customers') {
                const data = await getCustomerReport();
                setCustomerData(data);
            } else if (activeTab === 'finance') {
                if (projects.length === 0) {
                    const projectData = await getProjects();
                    const safeProjects = Array.isArray(projectData) ? projectData : [];
                    setProjects(safeProjects);
                    if (safeProjects.length > 0) setSelectedProjectId(safeProjects[0].id);
                }
            } else if (activeTab === 'trends') {
                const [trends, comparison] = await Promise.all([
                    getTrendsReport(),
                    getComparisonReport()
                ]);
                setTrendsData(trends);
                setComparisonData(comparison);
            }
        } catch (err: any) {
            console.error(err);
            showToast('Error cargando datos', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function loadFinanceSummary(projectId: string) {
        setLoading(true);
        try {
            const data = await getProjectSummary(projectId);
            setSummary(data);
        } catch (err) {
            showToast('Error cargando reporte financiero', 'error');
        } finally {
            setLoading(false);
        }
    }

    const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4'];

    // ===== SVG Tab Icons =====
    const tabIcons: Record<Tab, JSX.Element> = {
        sales: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
        support: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
        ),
        customers: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        ),
        finance: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        trends: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
        ),
    };

    // ===== Metric Card Component =====
    const MetricCard = ({ label, value, change, prefix, suffix, color = 'text-gray-900 dark:text-white', icon }: {
        label: string; value: string | number; change?: number; prefix?: string; suffix?: string;
        color?: string; icon?: JSX.Element;
    }) => (
        <div className="group bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md hover:border-purple-200 dark:hover:border-purple-800 transition-all duration-200">
            <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
                {icon && <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">{icon}</div>}
            </div>
            <h3 className={`text-2xl md:text-3xl font-bold ${color}`}>
                {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
            </h3>
            {change !== undefined && (
                <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    {change >= 0 ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                    )}
                    <span>{change > 0 ? '+' : ''}{change.toFixed(1)}% vs mes anterior</span>
                </div>
            )}
        </div>
    );

    // ===== Chart Card Wrapper =====
    const ChartCard = ({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) => (
        <div className={`bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 ${className}`}>
            <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">{title}</h4>
            {children}
        </div>
    );

    // ===== Tab Rendering =====
    const renderTabs = () => (
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl mb-8 overflow-x-auto">
            {([
                { id: 'sales', label: 'Ventas', desc: 'Pipeline y Conversión' },
                { id: 'support', label: 'Soporte', desc: 'Tickets y Resolución' },
                { id: 'customers', label: 'Clientes', desc: 'Crecimiento y Retención' },
                { id: 'finance', label: 'Finanzas', desc: 'Proyectos y Presupuesto' },
                { id: 'trends', label: 'Tendencias', desc: 'Histórico y Comparación' }
            ] as const).map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm font-medium whitespace-nowrap flex-1 justify-center ${activeTab === tab.id
                        ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                >
                    {tabIcons[tab.id]}
                    <span>{tab.label}</span>
                    <span className="text-[10px] hidden lg:inline opacity-60">{tab.desc}</span>
                </button>
            ))}
        </div>
    );

    // ===== Sales Content =====
    const renderSalesContent = () => {
        if (!salesData) return null;

        const leadDistData = [
            { name: 'Nuevos', value: salesData.newCustomersThisMonth },
            { name: 'Retenidos', value: Math.max(0, salesData.totalCustomers - salesData.newCustomersThisMonth) }
        ];

        const conversionRate = salesData.totalCustomers > 0
            ? ((salesData.newCustomersThisMonth / salesData.totalCustomers) * 100).toFixed(1)
            : '0';

        return (
            <div className="space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCard
                        label="Total Clientes"
                        value={salesData.totalCustomers}
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                    />
                    <MetricCard
                        label="Nuevos este Mes"
                        value={salesData.newCustomersThisMonth}
                        color="text-blue-600 dark:text-blue-400"
                        change={salesData.growth}
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
                    />
                    <MetricCard
                        label="Tasa de Conversión"
                        value={conversionRate}
                        suffix="%"
                        color="text-emerald-600 dark:text-emerald-400"
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="Adquisición de Clientes">
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={leadDistData} cx="50%" cy="50%" innerRadius={70} outerRadius={95} paddingAngle={5} dataKey="value">
                                        {leadDistData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>

                    <ChartCard title="Resumen de Crecimiento">
                        <div className="h-72 flex flex-col items-center justify-center">
                            <div className={`text-6xl font-bold mb-2 ${salesData.growth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {salesData.growth > 0 ? '+' : ''}{salesData.growth.toFixed(1)}%
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Crecimiento mensual</p>
                            <div className="mt-6 w-full max-w-xs">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Progreso base de clientes</span>
                                    <span>{salesData.totalCustomers}</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${Math.min(100, (salesData.newCustomersThisMonth / Math.max(1, salesData.totalCustomers)) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </ChartCard>
                </div>
            </div>
        );
    };

    // ===== Support Content =====
    const renderSupportContent = () => {
        if (!supportData) return null;
        const totalTickets = supportData.openTickets + supportData.closedTickets;
        const resolutionRate = totalTickets > 0 ? ((supportData.closedTickets / totalTickets) * 100).toFixed(1) : '0';

        return (
            <div className="space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCard
                        label="Tickets Abiertos"
                        value={supportData.openTickets}
                        color="text-orange-500"
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                    <MetricCard
                        label="Tickets Resueltos"
                        value={supportData.closedTickets}
                        color="text-emerald-500"
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                    <MetricCard
                        label="Tasa de Resolución"
                        value={resolutionRate}
                        suffix="%"
                        color="text-purple-600 dark:text-purple-400"
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="Tickets por Prioridad">
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={supportData.ticketsByPriority}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Bar dataKey="value" fill="#8B5CF6" radius={[6, 6, 0, 0]} name="Cantidad">
                                        {supportData.ticketsByPriority.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={['#EF4444', '#F59E0B', '#3B82F6', '#10B981'][index] || '#8B5CF6'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>

                    <ChartCard title="Distribución de Estado">
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Abiertos', value: supportData.openTickets },
                                            { name: 'Resueltos', value: supportData.closedTickets }
                                        ]}
                                        cx="50%" cy="50%" innerRadius={70} outerRadius={95} paddingAngle={5} dataKey="value"
                                    >
                                        <Cell fill="#F59E0B" />
                                        <Cell fill="#10B981" />
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>
                </div>
            </div>
        );
    };

    // ===== Customers Content =====
    const renderCustomersContent = () => {
        if (!customerData) return null;

        return (
            <div className="space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCard
                        label="Total Clientes"
                        value={customerData.total}
                        color="text-purple-600 dark:text-purple-400"
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                    />
                    <MetricCard
                        label="Planes Activos"
                        value={customerData.byPlan.length}
                        color="text-blue-600 dark:text-blue-400"
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                    />
                    <MetricCard
                        label="Estados Distintos"
                        value={customerData.byStatus.length}
                        color="text-emerald-600 dark:text-emerald-400"
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="Clientes por Plan">
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={customerData.byPlan} cx="50%" cy="50%" innerRadius={70} outerRadius={95} paddingAngle={5} dataKey="value">
                                        {customerData.byPlan.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>
                    <ChartCard title="Estado de Clientes">
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={customerData.byStatus} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                    <XAxis type="number" stroke="#888888" fontSize={12} />
                                    <YAxis type="category" dataKey="name" stroke="#888888" fontSize={12} width={80} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Clientes">
                                        {customerData.byStatus.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>
                </div>
            </div>
        );
    };

    // ===== Finance Content =====
    const renderFinanceContent = () => {
        if (projects.length === 0 && !loading) return (
            <div className="p-12 text-center bg-gray-50 dark:bg-slate-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-700">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400 mb-4">No hay proyectos financieros activos.</p>
                <button className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/25">Crear Proyecto</button>
            </div>
        );

        if (!summary) return <div className="p-10 text-center text-gray-400">Selecciona un proyecto...</div>;

        const taskData = [
            { name: 'Completado', value: summary.tasksByStatus.DONE },
            { name: 'En Progreso', value: summary.tasksByStatus.IN_PROGRESS },
            { name: 'Revisión', value: summary.tasksByStatus.REVIEW },
            { name: 'Por Hacer', value: summary.tasksByStatus.TODO },
            { name: 'Backlog', value: summary.tasksByStatus.BACKLOG },
        ].filter(d => d.value > 0);

        const budgetUsed = summary.budget > 0 ? ((summary.spent / summary.budget) * 100) : 0;

        return (
            <div className="space-y-6 animate-fadeIn">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                        </div>
                        <span className="font-bold text-gray-700 dark:text-gray-200">Proyecto:</span>
                    </div>
                    <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 shadow-sm focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium"
                    >
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <MetricCard label="Presupuesto" value={`${summary.currency} ${summary.budget.toLocaleString()}`}
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                    />
                    <MetricCard label="Gastado" value={`${summary.currency} ${summary.spent.toLocaleString()}`} color="text-blue-600 dark:text-blue-400"
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                    />
                    <MetricCard label="Restante" value={`${summary.currency} ${summary.remaining.toLocaleString()}`} color={summary.remaining < 0 ? 'text-red-500' : 'text-emerald-500'}
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                    <MetricCard label="Horas Totales" value={`${summary.totalHours.toFixed(1)} h`} color="text-purple-600 dark:text-purple-400"
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                </div>

                {/* Budget Progress Bar */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Uso del Presupuesto</span>
                        <span className={`text-sm font-bold ${budgetUsed > 100 ? 'text-red-500' : budgetUsed > 80 ? 'text-amber-500' : 'text-emerald-500'}`}>{budgetUsed.toFixed(1)}%</span>
                    </div>
                    <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ${budgetUsed > 100 ? 'bg-gradient-to-r from-red-500 to-red-600' : budgetUsed > 80 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'}`}
                            style={{ width: `${Math.min(100, budgetUsed)}%` }}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="Estado de Tareas">
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={taskData} cx="50%" cy="50%" innerRadius={70} outerRadius={95} paddingAngle={5} dataKey="value">
                                        {taskData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>

                    <div className="bg-gradient-to-br from-gray-900 to-slate-800 p-8 rounded-2xl shadow-lg text-white flex flex-col justify-center items-start">
                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Exportar Nómina</h3>
                        <p className="text-gray-400 mb-6 text-sm">Reporte detallado de horas y costos para el pago de nómina.</p>
                        <button
                            onClick={() => downloadPayrollCSV(selectedProjectId, format(new Date(), 'yyyy-MM'))}
                            className="bg-white text-gray-900 px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition-all flex items-center gap-2 shadow-lg"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Descargar CSV
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ===== Trends Content =====
    const renderTrendsContent = () => {
        if (!trendsData || !comparisonData) return null;

        const getChangeIcon = (change: number) => {
            if (change > 0) return <span className="text-emerald-300 font-medium">▲ +{change}%</span>;
            if (change < 0) return <span className="text-red-300 font-medium">▼ {change}%</span>;
            return <span className="text-gray-400">— 0%</span>;
        };

        return (
            <div className="space-y-8 animate-fadeIn">
                {/* Period Comparison Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-2xl shadow-lg text-white group hover:shadow-xl transition-shadow">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                            </div>
                            <span className="text-sm opacity-80">Nuevos Clientes</span>
                        </div>
                        <div className="text-3xl font-bold">{comparisonData.thisMonth.customers}</div>
                        <div className="text-sm mt-2 flex items-center gap-2">
                            vs. anterior: {comparisonData.lastMonth.customers} {getChangeIcon(comparisonData.change.customers)}
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-2xl shadow-lg text-white group hover:shadow-xl transition-shadow">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                            </div>
                            <span className="text-sm opacity-80">Tickets Creados</span>
                        </div>
                        <div className="text-3xl font-bold">{comparisonData.thisMonth.tickets}</div>
                        <div className="text-sm mt-2 flex items-center gap-2">
                            vs. anterior: {comparisonData.lastMonth.tickets} {getChangeIcon(comparisonData.change.tickets)}
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-6 rounded-2xl shadow-lg text-white group hover:shadow-xl transition-shadow">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <span className="text-sm opacity-80">Ingresos</span>
                        </div>
                        <div className="text-3xl font-bold">${(comparisonData.thisMonth.revenue || 0).toLocaleString()}</div>
                        <div className="text-sm mt-2 flex items-center gap-2">
                            vs. anterior: ${(comparisonData.lastMonth.revenue || 0).toLocaleString()} {getChangeIcon(comparisonData.change.revenue)}
                        </div>
                    </div>
                </div>

                {/* Trends Chart */}
                <ChartCard title="Tendencias de los Últimos 6 Meses">
                    <ResponsiveContainer width="100%" height={350}>
                        <AreaChart data={trendsData.trends}>
                            <defs>
                                <linearGradient id="colorCustomers" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="month" stroke="#9CA3AF" />
                            <YAxis stroke="#9CA3AF" />
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '12px', color: '#fff' }} />
                            <Legend />
                            <Area type="monotone" dataKey="customers" name="Clientes" stroke="#10B981" fillOpacity={1} fill="url(#colorCustomers)" />
                            <Area type="monotone" dataKey="revenue" name="Ingresos" stroke="#8B5CF6" fillOpacity={1} fill="url(#colorRevenue)" />
                            <Line type="monotone" dataKey="tickets" name="Tickets" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* Individual Trend Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ChartCard title="Clientes Totales por Mes">
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={trendsData.trends}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                                <YAxis stroke="#9CA3AF" />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                                <Line type="monotone" dataKey="customers" stroke="#10B981" strokeWidth={3} />
                            </LineChart>
                        </ResponsiveContainer>
                    </ChartCard>
                    <ChartCard title="Tickets por Mes">
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={trendsData.trends}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                                <YAxis stroke="#9CA3AF" />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                                <Bar dataKey="tickets" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </div>
            </div>
        );
    };

    // ===== PDF Preview =====
    const openPreview = async () => {
        try {
            showToast('Generando vista previa...', 'info');
            const url = await getReportPDFPreview();
            setPdfPreviewUrl(url);
            setShowPdfPreview(true);
        } catch (err) {
            showToast('Error generando vista previa', 'error');
        }
    };

    const closePreview = () => {
        if (pdfPreviewUrl) {
            URL.revokeObjectURL(pdfPreviewUrl);
        }
        setPdfPreviewUrl(null);
        setShowPdfPreview(false);
    };

    return (
        <div className="p-3 md:p-6 max-w-7xl mx-auto min-h-screen">
            <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Reportes y Analytics</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">Métricas clave de rendimiento y operaciones</p>
                </div>
                <button
                    onClick={openPreview}
                    className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all text-sm shadow-lg shadow-purple-500/25"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Vista Previa PDF
                </button>
            </div>

            {renderTabs()}

            {loading ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Skeleton height="120px" />
                        <Skeleton height="120px" />
                        <Skeleton height="120px" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Skeleton height="300px" />
                        <Skeleton height="300px" />
                    </div>
                </div>
            ) : (
                <>
                    {activeTab === 'sales' && renderSalesContent()}
                    {activeTab === 'support' && renderSupportContent()}
                    {activeTab === 'customers' && renderCustomersContent()}
                    {activeTab === 'finance' && renderFinanceContent()}
                    {activeTab === 'trends' && renderTrendsContent()}
                </>
            )}

            {/* PDF Preview Modal */}
            {showPdfPreview && pdfPreviewUrl && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Vista Previa del Reporte</h3>
                            <button
                                onClick={closePreview}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <iframe
                                src={pdfPreviewUrl}
                                className="w-full h-[70vh] border-0"
                                title="PDF Preview"
                            />
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={closePreview}
                                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                            >
                                Cerrar
                            </button>
                            <a
                                href={pdfPreviewUrl}
                                download="reporte-analitico.pdf"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-emerald-500/25"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                Descargar PDF
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
