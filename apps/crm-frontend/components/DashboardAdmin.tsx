'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { useToast } from './Toast';
import { Skeleton } from './Skeleton';
import VoiceWidget from './VoiceWidget';
import { API_URL, downloadPayrollCSV } from '../app/api';
import { useAuth } from './AuthProvider';

// Widget Definitions
const AVAILABLE_WIDGETS = [
  { id: 'stats_overview', label: 'Resumen General (KPIs)', default: true },
  { id: 'revenue_chart', label: 'Gráfico de Ingresos', default: true },
  { id: 'projects_list', label: 'Proyectos Activos', default: true },
  { id: 'recent_activity', label: 'Actividad Reciente', default: true },
  { id: 'ai_predictions', label: 'Predicciones IA', default: true },
  { id: 'quick_actions', label: 'Acciones Rápidas', default: true },
];

interface DashboardProps {
  onNavigate?: (view: string) => void;
  onOpenActivity?: (activity: any) => void;
  onCreateTicket?: () => void;
  onCreateCustomer?: () => void;
}

export default function Dashboard({ onNavigate, onOpenActivity, onCreateTicket, onCreateCustomer }: DashboardProps) {
  const { token } = useAuth();
  const { showToast } = useToast();

  // Config State
  const [config, setConfig] = useState<string[]>([]);
  const [isConfiguring, setIsConfiguring] = useState(false);

  // Data State
  const [summary, setSummary] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load config from LS
    const saved = localStorage.getItem('dashboard_config');
    if (saved) {
      setConfig(JSON.parse(saved));
    } else {
      setConfig(AVAILABLE_WIDGETS.filter(w => w.default).map(w => w.id));
    }
  }, []);

  useEffect(() => {
    if (token) loadDashboardData();
  }, [token]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch Unified Summary
      const summaryRes = await fetch(`${API_URL}/dashboard/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (summaryRes.ok) setSummary(await summaryRes.json());

      // Fetch Projects (Legacy support)
      // Note: In a real "optimized" dashboard, we might move this to the summary endpoint too
      // or only fetch if the widget is visible.
      const projRes = await fetch(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (projRes.ok) setProjects(await projRes.json());

      // Load AI Predictions
      try {
        const predRes = await fetch(`${API_URL}/analytics/predictions`);
        if (predRes.ok) setPredictions(await predRes.json());
      } catch (e) { }

    } catch (e) {
      console.error(e);
      showToast('Error cargando datos del dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleWidget = (id: string) => {
    const newConfig = config.includes(id)
      ? config.filter(c => c !== id)
      : [...config, id];
    setConfig(newConfig);
    localStorage.setItem('dashboard_config', JSON.stringify(newConfig));
  };

  if (loading && !summary) return <div className="p-10 text-center text-gray-400">Cargando Dashboard Inteligente...</div>;

  const isVisible = (id: string) => config.includes(id);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hola, Admin 👋</h1>
          <p className="text-gray-500">Aquí está lo que está pasando hoy en tu negocio.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadDashboardData}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Actualizar"
          >
            🔄
          </button>
          <button
            onClick={() => setIsConfiguring(true)}
            className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-xl font-medium shadow-lg transition-all flex items-center gap-2"
          >
            ⚙️ Personalizar
          </button>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      {isVisible('quick_actions') && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ActionButton icon="📝" label="Nuevo Ticket" onClick={() => onCreateTicket?.()} color="blue" />
          <ActionButton icon="👤" label="Crear Cliente" onClick={() => onCreateCustomer?.()} color="emerald" />
          <ActionButton icon="📦" label="Nuevo Pedido" onClick={() => onNavigate?.('erp')} color="purple" />
          <ActionButton icon="📄" label="Facturar" onClick={() => onNavigate?.('erp')} color="orange" />
        </div>
      )}

      {/* KPI STATS */}
      {isVisible('stats_overview') && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Ingresos Totales"
            value={`$${(summary.financials?.totalRevenue || 0).toLocaleString()}`}
            sub="Ingresos registrados"
            icon="💰"
            color="emerald"
            onClick={() => onNavigate?.('finances')}
          />
          <StatCard
            label="Tickets Abiertos"
            value={summary.counts?.openTickets || 0}
            sub="Requieren atención"
            icon="🎫"
            color="red"
            alert={(summary.counts?.openTickets || 0) > 5}
            onClick={() => onNavigate?.('tickets')}
          />
          <StatCard
            label="Nuevos Leads"
            value={summary.counts?.leads || 0}
            sub="En seguimiento"
            icon="🎯"
            color="blue"
            onClick={() => onNavigate?.('leads')}
          />
          <StatCard
            label="Pedidos Pendientes"
            value={summary.counts?.pendingOrders || 0}
            sub="Por procesar"
            icon="📦"
            color="amber"
            onClick={() => onNavigate?.('erp')}
          />
        </div>
      )}

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT COLUMN (2/3) */}
        <div className="lg:col-span-2 space-y-6">

          {/* REVENUE CHART */}
          {isVisible('revenue_chart') && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-900">Tendencia de Ingresos</h3>
                <select className="text-sm border-gray-200 rounded-lg text-gray-500">
                  <option>Últimos 6 meses</option>
                  <option>Este año</option>
                </select>
              </div>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl text-gray-400">
                <p>Gráfico de ingresos no disponible en demo</p>
                {/* Implement Recharts here with real data if available */}
              </div>
            </div>
          )}

          {/* PROJECTS LIST */}
          {isVisible('projects_list') && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-900">Proyectos Activos</h3>
                <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">{projects.length} Total</span>
              </div>
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {projects.map(p => (
                  <div key={p.id} className="p-4 hover:bg-gray-50 flex justify-between items-center transition-colors">
                    <div>
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">Presupuesto: ${p.budget.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <button onClick={() => downloadPayrollCSV(p.id, '2024-02')} className="text-xs text-blue-600 hover:underline">
                        Dsc. Nómina
                      </button>
                    </div>
                  </div>
                ))}
                {projects.length === 0 && <p className="p-6 text-center text-gray-400">No hay proyectos activos</p>}
              </div>
            </div>
          )}

          {/* AI PREDICTIONS */}
          {isVisible('ai_predictions') && predictions && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">✨</span>
                <h3 className="font-bold text-indigo-900">AI Insights</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/60 p-4 rounded-xl">
                  <p className="text-xs text-gray-500 font-bold uppercase">Riesgo Churn</p>
                  <p className="text-2xl font-bold text-gray-900">{predictions.churn?.atRiskCount || 0}</p>
                  <p className="text-xs text-gray-500">Clientes en alerta</p>
                </div>
                <div className="bg-white/60 p-4 rounded-xl">
                  <p className="text-xs text-gray-500 font-bold uppercase">Forecast MRR</p>
                  <p className="text-2xl font-bold text-emerald-600">${Math.round(predictions.mrr?.current || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white/60 p-4 rounded-xl">
                  <p className="text-xs text-gray-500 font-bold uppercase">Pipeline Healt</p>
                  <p className="text-2xl font-bold text-blue-600">{predictions.pipeline?.avgScore || 0}/100</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (1/3) */}
        <div className="lg:col-span-1 space-y-6">
          {/* RECENT ACTIVITY */}
          {isVisible('recent_activity') && summary && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Actividad Reciente</h3>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {summary.recentActivity.map((act: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3 cursor-pointer group"
                    onClick={() => {
                      console.log('Activity clicked:', act);
                      onOpenActivity?.(act);
                    }}
                  >
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${act.type === 'TICKET' || act.type === 'CREATED' ? 'bg-red-500' : 'bg-blue-500'} group-hover:scale-125 transition-transform`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{act.description}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span>{act.customer}</span>
                        <span>•</span>
                        <span>{new Date(act.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {summary.recentActivity.length === 0 && <p className="p-6 text-center text-gray-400">Sin actividad reciente</p>}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* CONFIG SLIDE OVER / MODAL */}
      {isConfiguring && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex justify-end">
          <div className="w-80 bg-white h-full shadow-2xl p-6 animate-slideInRight">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-xl">Personalizar</h2>
              <button onClick={() => setIsConfiguring(false)} className="text-gray-400 hover:text-gray-900 text-xl">&times;</button>
            </div>
            <p className="text-sm text-gray-500 mb-6">Selecciona los elementos que deseas ver en tu dashboard.</p>
            <div className="space-y-3">
              {AVAILABLE_WIDGETS.map(w => (
                <label key={w.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                  <span className="font-medium text-gray-700">{w.label}</span>
                  <input
                    type="checkbox"
                    checked={config.includes(w.id)}
                    onChange={() => toggleWidget(w.id)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>
              ))}
            </div>
            <button
              onClick={() => setIsConfiguring(false)}
              className="w-full mt-8 bg-black text-white py-3 rounded-xl font-bold"
            >
              Listo
            </button>
          </div>
        </div>
      )}

      <VoiceWidget />
    </div>
  );
}

// Sub-components for cleaner code
function ActionButton({ icon, label, onClick, color }: any) {
  const bgColors: any = {
    blue: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
    purple: 'bg-purple-50 text-purple-600 group-hover:bg-purple-100',
    orange: 'bg-orange-50 text-orange-600 group-hover:bg-orange-100',
  };

  return (
    <button onClick={onClick} className="group bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all text-left flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${bgColors[color]}`}>
        <span className="text-xl">{icon}</span>
      </div>
      <span className="font-bold text-gray-700 group-hover:text-gray-900">{label}</span>
    </button>
  );
}

function StatCard({ label, value, sub, icon, color, alert, onClick }: any) {
  const textColors: any = {
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white p-6 rounded-2xl shadow-sm border ${alert ? 'border-red-200 bg-red-50' : 'border-gray-100'} transition-all hover:shadow-md ${onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className={`text-3xl font-bold mb-1 ${alert ? 'text-red-700' : 'text-gray-900'}`}>{value}</div>
      <div className={`text-xs font-medium ${textColors[color]}`}>{sub}</div>
    </div>
  );
}
