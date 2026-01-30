'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useToast } from './Toast';
import { Skeleton, CardSkeleton, StatsSkeleton } from './Skeleton';
import VoiceWidget from './VoiceWidget';
import {
  getProjects,
  getClients,
  getUsers,
  getProject,
  createProject,
  updateProject,
  assignProjectMember,
  removeProjectMember,
  getProjectSummary,
  downloadPayrollCSV,
  API_URL,
  type Project,
  type Client,
  type User,
  type ProjectSummary
} from '../app/api';

export default function DashboardAdmin() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [summaries, setSummaries] = useState<Record<string, ProjectSummary>>({});
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI Predictions state
  const [predictions, setPredictions] = useState<{
    mrr: { current: number; forecast: { month: string; mrr: number }[]; projectedAnnual: number };
    churn: { atRiskCount: number; atRiskMRR: number; customers: { id: string; name: string; riskLevel: string; reason: string }[] };
    pipeline: { totalValue: number; hotLeadsCount: number; avgScore: number };
  } | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // New Project Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newBudget, setNewBudget] = useState(10000);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [originalMemberIds, setOriginalMemberIds] = useState<string[]>([]);

  const { showToast } = useToast();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [projs, cls, usrs] = await Promise.all([
        getProjects(),
        getClients(),
        getUsers()
      ]);
      setProjects(projs);
      setClients(cls);
      setUsers(usrs);

      const sums: Record<string, ProjectSummary> = {};
      for (const p of projs) {
        try {
          sums[p.id] = await getProjectSummary(p.id);
        } catch (e) {
          console.error(`Error cargando resumen de ${p.id}:`, e);
        }
      }
      setSummaries(sums);

      // Load AI Predictions
      try {
        const predRes = await fetch(`${API_URL}/analytics/predictions`);
        if (predRes.ok) {
          const predData = await predRes.json();
          setPredictions(predData);
        }
      } catch (predErr) {
        console.warn('Could not load predictions:', predErr);
      }
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

  async function handleEditClick(project: Project) {
    setEditingId(project.id);
    setNewName(project.name);
    setNewBudget(project.budget);
    setSelectedClientId(project.clientId);

    try {
      const fullProject = await getProject(project.id);
      if (fullProject.members) {
        const mids = fullProject.members.map((m: any) => m.userId);
        setSelectedMemberIds(mids);
        setOriginalMemberIds(mids);
      } else {
        setSelectedMemberIds([]);
        setOriginalMemberIds([]);
      }
    } catch (e) {
      console.error("Error fetching project details", e);
      setSelectedMemberIds([]);
    }

    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId) {
      showToast('Selecciona un cliente', 'error');
      return;
    }

    try {
      let projectId = editingId;

      if (editingId) {
        await updateProject(editingId, {
          name: newName,
          clientId: selectedClientId,
          budget: newBudget
        });
        showToast('Proyecto actualizado', 'success');
      } else {
        const project = await createProject({
          name: newName,
          clientId: selectedClientId,
          budget: newBudget
        });
        projectId = project.id;
        showToast('Proyecto creado exitosamente', 'success');
      }

      const toAdd = selectedMemberIds.filter(id => !originalMemberIds.includes(id));
      if (projectId && toAdd.length > 0) {
        for (const userId of toAdd) {
          await assignProjectMember(projectId, {
            userId,
            payRate: 20,
            billRate: 50,
            role: 'DEV'
          });
        }
      }

      if (editingId && projectId) {
        const toRemove = originalMemberIds.filter(id => !selectedMemberIds.includes(id));
        for (const userId of toRemove) {
          await removeProjectMember(projectId, userId);
        }
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error guardando proyecto', 'error');
    }
  }

  function resetForm() {
    setNewName('');
    setNewBudget(10000);
    setSelectedClientId('');
    setSelectedMemberIds([]);
    setEditingId(null);
  }

  const totalBudget = Object.values(summaries).reduce((acc, s) => acc + s.budget, 0);
  const totalSpent = Object.values(summaries).reduce((acc, s) => acc + s.spent, 0);
  const totalHours = Object.values(summaries).reduce((acc, s) => acc + s.totalHours, 0);
  const avgProgress = Object.values(summaries).length > 0
    ? Object.values(summaries).reduce((acc, s) => acc + s.progress, 0) / Object.values(summaries).length
    : 0;

  const chartData = projects.map((p) => {
    const summary = summaries[p.id];
    if (!summary) return null;
    const percentage = (summary.spent / summary.budget) * 100;
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


  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-center py-20">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Error al cargar datos</h3>
        <p className="text-gray-500 mb-6">{error}</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm">Resumen general de proyectos y presupuestos</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              resetForm();
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
              className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs text-gray-400 font-medium">PRESUPUESTO TOTAL</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">${totalBudget.toLocaleString()}</div>
          <div className="text-sm text-gray-500 mt-1">{projects.length} proyectos</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className="text-xs text-gray-400 font-medium">CONSUMIDO</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">${totalSpent.toFixed(2)}</div>
          <div className="text-sm text-gray-500 mt-1">{((totalSpent / totalBudget) * 100 || 0).toFixed(1)}% del total</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs text-gray-400 font-medium">HORAS TOTALES</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalHours.toFixed(1)}h</div>
          <div className="text-sm text-gray-500 mt-1">Tiempo registrado</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-xs text-gray-400 font-medium">PROGRESO PROMEDIO</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{avgProgress.toFixed(0)}%</div>
          <div className="text-sm text-gray-500 mt-1">Tareas completadas</div>
        </div>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((project, index) => {
          const summary = summaries[project.id];
          if (!summary) return null;
          const percentage = (summary.spent / summary.budget) * 100;
          const status = getBudgetStatus(percentage);
          const gradient = getBudgetGradient(percentage);

          return (
            <div
              key={project.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 animate-slideUp group"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className={`h-2 bg-gradient-to-r ${gradient}`} />

              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                    {project.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${status.bg}`}>
                      {status.text}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleEditClick(project);
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
                    <span className="text-gray-500">Presupuesto</span>
                    <span className="font-semibold text-gray-900">{summary.currency} {summary.budget.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Consumido</span>
                    <span className="font-semibold text-gray-900">{summary.currency} {summary.spent.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Restante</span>
                    <span className={`font-semibold ${summary.remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {summary.currency} {summary.remaining.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-gray-500">{percentage.toFixed(1)}% usado</span>
                    <span className="text-gray-500">{summary.progress}% completado</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => downloadPayrollCSV(project.id, selectedMonth)}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
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

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900">Presupuesto vs Consumo</h2>
            <p className="text-gray-500 text-sm">Comparación visual de todos los proyectos</p>
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
                  if (name === 'presupuesto') return [`$${value.toLocaleString()}`, 'Presupuesto'];
                  if (name === 'consumido') return [`$${value.toFixed(2)}`, 'Consumido'];
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

      {/* AI Predictions Widget */}
      {predictions && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center text-white text-lg">
              ✨
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Predicciones IA</h2>
              <p className="text-gray-500 text-sm">Insights inteligentes del CRM</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* MRR Forecast */}
            <div className="bg-white rounded-xl p-4 border border-purple-100">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📈</span>
                <span className="font-bold text-gray-800">MRR Forecast</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600 mb-2">
                ${predictions.mrr.current.toLocaleString()}
              </div>
              <div className="space-y-1">
                {predictions.mrr.forecast.slice(1).map((f, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-500">{f.month}</span>
                    <span className="font-mono font-bold text-gray-700">${f.mrr.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">Proyección Anual:</span>
                <span className="ml-2 text-sm font-bold text-purple-600">${Math.round(predictions.mrr.projectedAnnual).toLocaleString()}</span>
              </div>
            </div>

            {/* Churn Risk */}
            <div className="bg-white rounded-xl p-4 border border-purple-100">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">⚠️</span>
                <span className="font-bold text-gray-800">Riesgo Churn</span>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className={`text-2xl font-bold ${predictions.churn.atRiskCount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {predictions.churn.atRiskCount}
                </span>
                <span className="text-sm text-gray-500">clientes en riesgo</span>
              </div>
              {predictions.churn.atRiskMRR > 0 && (
                <div className="mb-3 p-2 bg-red-50 rounded-lg">
                  <span className="text-xs text-red-600">MRR en riesgo:</span>
                  <span className="ml-2 font-bold text-red-700">${predictions.churn.atRiskMRR.toLocaleString()}</span>
                </div>
              )}
              <div className="space-y-2">
                {predictions.churn.customers.slice(0, 3).map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 truncate max-w-[100px]">{c.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${c.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' :
                      c.riskLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                      {c.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline */}
            <div className="bg-white rounded-xl p-4 border border-purple-100">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🎯</span>
                <span className="font-bold text-gray-800">Pipeline Leads</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 mb-2">
                ${predictions.pipeline.totalValue.toLocaleString()}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-orange-600">{predictions.pipeline.hotLeadsCount}</div>
                  <div className="text-[10px] text-orange-500 font-medium">Hot Leads</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-blue-600">{predictions.pipeline.avgScore}</div>
                  <div className="text-[10px] text-blue-500 font-medium">Score Promedio</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva Proyecto */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Proyecto *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ej: E-commerce V2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <select
                  required
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Seleccionar Cliente...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {clients.length === 0 && <p className="text-xs text-red-500 mt-1">Crea un cliente primero en la sección Clientes</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Presupuesto (USD)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={newBudget}
                  onChange={e => setNewBudget(Number(e.target.value))}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Asignar Miembros (Opcional)</label>
                <div className="border border-gray-200 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
                  {users.length === 0 ? (
                    <p className="text-xs text-gray-500">No hay usuarios disponibles. Invita miembros en la sección Equipo.</p>
                  ) : (
                    users.map(u => (
                      <label key={u.id} className="flex items-center gap-3 cursor-pointer p-1 hover:bg-gray-50 rounded-lg">
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.includes(u.id)}
                          onChange={e => {
                            if (e.target.checked) setSelectedMemberIds(prev => [...prev, u.id]);
                            else setSelectedMemberIds(prev => prev.filter(id => id !== u.id));
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">{u.name}</span>
                        <span className="text-xs text-gray-400">({u.role})</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-teal-500 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all font-bold"
                >
                  {editingId ? 'Guardar Cambios' : 'Crear Proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Voice Widget Floating Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <VoiceWidget />
      </div>
    </div>
  );
}
