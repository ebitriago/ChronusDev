'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getProjects, getProject, getProjectSummary, downloadPayrollCSV, getClients, getUsers, getTasks, getStandups, type Project, type ProjectSummary, type Client, type User, type Task, type Standup } from '../app/api';
import { format, isSameDay, parseISO } from 'date-fns';
import { useToast } from './Toast';
import { Skeleton, StatsSkeleton, CardSkeleton } from './Skeleton';
import TeamActivity from './TeamActivity';
import ActivityFeed from './ActivityFeed';
import TaskDetailModal from './TaskDetailModal';
import ProjectModal from './ProjectModal';
import StandupModal from './StandupModal';

interface DashboardAdminProps {
  user?: User | null;
}

export default function DashboardAdmin({ user }: DashboardAdminProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [summaries, setSummaries] = useState<Record<string, ProjectSummary>>({});
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // My Tasks State
  const [myTasks, setMyTasks] = useState<Task[]>([]);

  // Standup State
  const [standupCompleted, setStandupCompleted] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [showStandupModal, setShowStandupModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const { showToast } = useToast();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [user]);

  async function loadData() {
    try {
      const promises: any[] = [
        getProjects(),
        getClients(),
        getUsers(),
        getStandups() // Fetch recent standups to check status
      ];

      // Fetch my tasks if user exists
      if (user) {
        promises.push(getTasks({ assignedTo: user.id }));
      } else {
        promises.push(Promise.resolve([]));
      }

      const [projs, cls, usrs, recentStandups, tasks] = await Promise.all(promises);

      setProjects(Array.isArray(projs) ? projs : []);
      setClients(Array.isArray(cls) ? cls : []);
      setUsers(Array.isArray(usrs) ? usrs : []);

      // Check Standup Status
      if (user && Array.isArray(recentStandups)) {
        const today = new Date();
        const hasStandupToday = recentStandups.some((s: Standup) =>
          s.userId === user.id && isSameDay(parseISO(s.createdAt), today)
        );
        setStandupCompleted(hasStandupToday);

        // Auto-open modal logic
        if (!hasStandupToday) {
          const lastPromptKey = `standup_prompt_${format(today, 'yyyy-MM-dd')}`;
          const alreadyPrompted = sessionStorage.getItem(lastPromptKey);

          if (!alreadyPrompted) {
            setShowStandupModal(true);
            sessionStorage.setItem(lastPromptKey, 'true');
          }
        }
      }

      // Filter distinct tasks that are not DONE or BACKLOG
      if (Array.isArray(tasks)) {
        const activeTasks = tasks.filter((t: Task) => t.status === 'TODO' || t.status === 'IN_PROGRESS' || t.status === 'REVIEW');
        setMyTasks(activeTasks);
      }

      const summariesData: Record<string, ProjectSummary> = {};
      const projectsArray = Array.isArray(projs) ? projs : [];

      // Optimized: Parallel loading of summaries
      const summaryPromises = projectsArray.map(async (p) => {
        try {
          const summary = await getProjectSummary(p.id);
          return { id: p.id, summary };
        } catch (e) {
          console.error(`Error cargando resumen de ${p.id}:`, e);
          return null;
        }
      });

      const results = await Promise.all(summaryPromises);
      results.forEach(res => {
        if (res) {
          summariesData[res.id] = res.summary;
        }
      });

      setSummaries(summariesData);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }

  function getBudgetColor(percentage: number): string {
    if (percentage < 75) return '#10b981';
    if (percentage < 90) return '#f59e0b';
    return '#ef4444';
  }

  function getBudgetGradient(percentage: number): string {
    if (percentage < 75) return 'from-emerald-500 to-teal-500';
    if (percentage < 90) return 'from-amber-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  }

  function getBudgetStatus(percentage: number): { text: string; bg: string } {
    if (percentage < 75) return { text: 'Saludable', bg: 'bg-emerald-100 text-emerald-700' };
    if (percentage < 90) return { text: 'Atención', bg: 'bg-amber-100 text-amber-700' };
    return { text: 'Crítico', bg: 'bg-red-100 text-red-700' };
  }

  // Stats resumen
  const totalBudget = Object.values(summaries).reduce((acc, s) => acc + s.budget, 0);
  const totalSpent = Object.values(summaries).reduce((acc, s) => acc + s.spent, 0);
  const totalHours = Object.values(summaries).reduce((acc, s) => acc + s.totalHours, 0);
  const avgProgress = Object.values(summaries).length > 0
    ? Object.values(summaries).reduce((acc, s) => acc + s.progress, 0) / Object.values(summaries).length
    : 0;

  const chartData = projects.map((p) => {
    const summary = summaries[p.id];
    if (!summary) return null;
    const percentage = summary.budget > 0 ? (summary.spent / summary.budget) * 100 : 0;
    return {
      name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
      fullName: p.name,
      presupuesto: summary.budget,
      consumido: summary.spent,
      restante: summary.remaining,
      porcentaje: percentage,
      color: getBudgetColor(percentage),
    };
  }).filter(Boolean);


  // Render My Tasks Widget
  const renderMyTasks = () => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 animate-fadeIn h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span>📋</span> Mis Tareas Pendientes
        </h2>
        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
          {myTasks.length} tareas
        </span>
      </div>

      {myTasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-gray-400">
          <div className="text-4xl mb-2">🎉</div>
          <p>¡Estás al día! No tienes tareas pendientes.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[400px] space-y-3 custom-scrollbar pr-2">
          {myTasks.map(task => (
            <div key={task.id} className="p-3 border border-gray-100 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between group">
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${task.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                    task.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                      task.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                    }`}>
                    {task.priority}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${task.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                    task.status === 'REVIEW' ? 'bg-purple-100 text-purple-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white truncate" title={task.title}>{task.title}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{task.project?.name || 'Sin proyecto'}</p>
              </div>

              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Ver detalle"
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  👁️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-center py-20">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Error al cargar datos</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            loadData();
          }}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
        >
          🔄 Reintentar
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton variant="text" width={200} height={32} />
            <Skeleton variant="text" width={300} height={16} />
          </div>
          <Skeleton variant="rect" width={150} height={40} className="rounded-xl" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <StatsSkeleton key={i} />)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(i => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Resumen general de proyectos y presupuestos</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowStandupModal(true)}
            className={`
                bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 border px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm flex items-center gap-2
                ${standupCompleted ? 'border-green-300 ring-1 ring-green-100 dark:ring-green-900' : 'border-red-300 ring-1 ring-red-100 dark:ring-red-900 animate-pulse-slow'}
            `}
            title={standupCompleted ? 'Standup completado hoy' : 'Standup pendiente para hoy'}
          >
            <span className={`flex h-2.5 w-2.5 relative justify-center items-center`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${standupCompleted ? 'bg-green-400 hidden' : 'bg-red-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${standupCompleted ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </span>
            <span>Daily Standup</span>
          </button>
          <button
            onClick={() => {
              setEditingProject(null);
              setShowModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/30 flex items-center gap-2"
          >
            <span>+</span> Nuevo Proyecto
          </button>
          <div className="relative">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">PRESUPUESTO TOTAL</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">${totalBudget.toLocaleString()}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{projects.length} proyectos</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">CONSUMIDO</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">${totalSpent.toFixed(2)}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : '0.0'}% del total</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">HORAS TOTALES</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalHours.toFixed(1)}h</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tiempo registrado</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">PROGRESO PROMEDIO</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{avgProgress.toFixed(0)}%</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tareas completadas</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Chart */}
          {chartData.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Presupuesto vs Consumo</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Comparación visual de todos los proyectos</p>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} barGap={8}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                      padding: '12px 16px',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'presupuesto') return [`$${(value || 0).toLocaleString()}`, 'Presupuesto'];
                      if (name === 'consumido') return [`$${(value || 0).toFixed(2)}`, 'Consumido'];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="presupuesto" fill="#e2e8f0" radius={[6, 6, 0, 0]} name="Presupuesto Total" />
                  <Bar dataKey="consumido" radius={[6, 6, 0, 0]} name="Consumo Actual">
                    {chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Team Activity */}
          <TeamActivity />

          {/* Activity Feed */}
          <ActivityFeed />
        </div>

        <div className="lg:col-span-1 space-y-6">
          {/* My Tasks Widget */}
          {renderMyTasks()}
        </div>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((project, index) => {
          const summary = summaries[project.id];
          if (!summary) return null;
          const percentage = summary.budget > 0 ? (summary.spent / summary.budget) * 100 : 0;
          const status = getBudgetStatus(percentage);
          const gradient = getBudgetGradient(percentage);

          return (
            <div
              key={project.id}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-all duration-300 animate-slideUp group"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Gradient header */}
              <div className={`h-2 bg-gradient-to-r ${gradient}`} />

              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer" onClick={() => window.location.href = `/projects/${project.id}`}>
                    {project.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${status.bg}`}>
                      {status.text}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setEditingProject(project);
                        setShowModal(true);
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar Proyecto"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Presupuesto</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{summary.currency} {(summary.budget || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Consumido</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{summary.currency} {(summary.spent || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Restante</span>
                    <span className={`font-semibold ${summary.remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {summary.currency} {(summary.remaining || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-gray-500 dark:text-gray-400">{percentage.toFixed(1)}% usado</span>
                    <span className="text-gray-500 dark:text-gray-400">{summary.progress}% completado</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Action button */}
                <button
                  onClick={() => downloadPayrollCSV(project.id, selectedMonth)}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Descargar CSV Nómina
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reusable Project Modal */}
      <ProjectModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingProject(null);
        }}
        onSuccess={() => {
          loadData();
        }}
        project={editingProject}
        clients={clients}
        users={users}
      />
      <StandupModal
        isOpen={showStandupModal}
        onClose={() => setShowStandupModal(false)}
        onSuccess={() => {
          // Refresh activity feed could be triggered here if we had a ref or context
          // But for now, auto-polling will pick it up
        }}
      />
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={loadData}
          members={[]} // We don't have project members context here easily, but we can update API to fetch or ignore
        />
      )}
    </div>
  );
}
