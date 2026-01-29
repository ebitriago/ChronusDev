'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/Toast';

// API
import { API_URL } from './api';

type Customer = {
  id: string;
  name: string;
  email: string;
  company?: string;
  plan: string;
  status: string;
  monthlyRevenue: number;
  openTickets?: number;
  pendingInvoices?: number;
  tags: string[];
  chronusDevClientId?: string;
};

type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  customer?: Customer;
  chronusDevTaskId?: string;
  createdAt: string;
  assignedTo?: string;
};

type Stats = {
  activeCustomers: number;
  trialCustomers: number;
  mrr: number;
  openTickets: number;
  overdueInvoices: number;
  totalCustomers: number;
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

// Helper for authenticated requests
async function secureFetch(endpoint: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : null;
  const headers: any = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_URL}${endpoint}`, { headers });
    if (!res.ok) {
      if (res.status === 401) {
        // Let component handle logout if needed, or just return empty
        return null;
      }
      return null;
    }
    return res.json();
  } catch (e) {
    console.error(`Error fetching ${endpoint}`, e);
    return null;
  }
}

async function fetchUsers(): Promise<User[]> {
  const data = await secureFetch('/users');
  return Array.isArray(data) ? data : [];
}

async function fetchStats(): Promise<Stats> {
  const data = await secureFetch('/stats');
  return data || {
    activeCustomers: 0, trialCustomers: 0, mrr: 0,
    openTickets: 0, overdueInvoices: 0, totalCustomers: 0
  };
}

async function fetchCustomers(): Promise<Customer[]> {
  const data = await secureFetch('/customers');
  return Array.isArray(data) ? data : [];
}

async function fetchTickets(): Promise<Ticket[]> {
  try {
    // Tickets might fail if endpoint doesn't exist yet or is renamed
    const data = await secureFetch('/tickets');
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

import Developers from '../components/Developers';
import Sidebar from '../components/Sidebar';
import Finances from '../components/Finances';
import CustomerDetail from '../components/CustomerDetail';
import LeadsKanban from '../components/LeadsKanban';
import TicketsKanban from '../components/TicketsKanban';
import Calendar from '../components/Calendar';
import Inbox from '../components/Inbox';
import AssistAI from '../components/AssistAI';
import ChannelSettings from '../components/ChannelSettings';
import OnboardingTour from '../components/OnboardingTour';
import Settings from '../components/Settings';
import Invoices from '../components/Invoices';
import NotificationBell from '../components/NotificationBell';
import AuthPage from '../components/AuthPage';
import SuperAdminPanel from '../components/SuperAdminPanel';
import AiAgentsPage from './ai-agents/page';

export default function CRMPage() {
  const [view, setView] = useState<'dashboard' | 'customers' | 'tickets' | 'invoices' | 'finances' | 'leads' | 'inbox' | 'assistai' | 'ai-agents' | 'channels' | 'settings' | 'developers' | 'super-admin' | 'calendar' | 'kanban'>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false); // Separate data loading state

  // Data State
  const [stats, setStats] = useState<Stats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [predictions, setPredictions] = useState<{
    mrr: { current: number; forecast: { month: string; mrr: number }[]; projectedAnnual: number };
    churn: { atRiskCount: number; atRiskMRR: number; customers: { name: string; riskLevel: string; reason: string }[] };
    pipeline: { totalValue: number; hotLeadsCount: number; avgScore: number };
  } | null>(null);

  // Selection State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Modal State
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [newTicket, setNewTicket] = useState<{ title: string; description: string; customerId: string; priority: string; assignedTo: string }>({
    title: '', description: '', customerId: '', priority: 'MEDIUM', assignedTo: ''
  });

  // Customer Modal State
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', company: '' });

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null);

  // Check authentication on load
  useEffect(() => {
    // Only check localStorage on mount
    const token = localStorage.getItem('crm_token');
    const userStr = localStorage.getItem('crm_user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === 'SUPER_ADMIN' && window.location.pathname !== '/admin/dashboard') {
          window.location.replace('/admin/dashboard');
          return;
        }
        setCurrentUser(user);
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
      }
    }

    // Check for initial view from URL-based navigation
    const initialView = sessionStorage.getItem('crm_initial_view');
    if (initialView) {
      setView(initialView as any);
      sessionStorage.removeItem('crm_initial_view');
    }

    // Stop loading immediately so showing the page is fast
    setLoading(false);
  }, []);

  // Handle login success
  const handleLogin = (token: string, user: any) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    setLoading(false);

    // Redirect Super Admins immediately
    if (user.role === 'SUPER_ADMIN') {
      window.location.href = '/admin/dashboard';
      return;
    }

    // Data will load via effect
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  // Check if onboarding is needed on first load
  useEffect(() => {
    if (!isAuthenticated) return;
    const completed = localStorage.getItem('crm_onboarding_complete');
    if (!completed) {
      setShowOnboarding(true);
    }
  }, [isAuthenticated]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setDataLoading(true); // Don't block full UI, just show indicators if needed
    try {
      // Fetch logic in parallel but safe
      // We do this AFTER the UI is already rendered
      const [statsData, customersData, usersData] = await Promise.all([
        fetchStats(),
        fetchCustomers(),
        fetchUsers()
      ]);

      setStats(statsData);
      setCustomers(customersData);
      setUsers(usersData);

      // Fetch tickets separately to not block others if it fails or is slow
      fetchTickets().then(setTickets);

      // Load predictions lazily
      secureFetch('/analytics/predictions').then(pred => {
        if (pred) setPredictions(pred);
      });

    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setDataLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [loadData, isAuthenticated]);


  async function handleCreateTicket() {
    if (!newTicket.title || !newTicket.customerId) return;

    try {
      const token = localStorage.getItem('crm_token');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/tickets`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newTicket),
      });
      if (res.ok) {
        setShowTicketModal(false);
        setNewTicket({ title: '', description: '', customerId: '', priority: 'MEDIUM', assignedTo: '' });
        loadData();
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al crear cliente');
    }
  }

  async function handleCreateCustomer() {
    if (!newCustomer.name || !newCustomer.email) {
      alert("Por favor ingrese nombre e email");
      return;
    }
    try {
      const token = localStorage.getItem('crm_token');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newCustomer),
      });

      if (res.ok) {
        setShowCustomerModal(false);
        setNewCustomer({ name: '', email: '', phone: '', company: '' });
        loadData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Error creating customer:', errorData);
        alert(`Error al crear cliente: ${errorData.message || res.statusText}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al crear cliente. Verifique su conexión y que el backend esté activo.');
    }
  }

  async function handleSyncCustomer(e: React.MouseEvent, customerId: string) {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('crm_token');
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/customers/${customerId}/sync`, {
        method: 'POST',
        headers
      });
      if (res.ok) {
        // We could use a toast here, but for now alert is fine or we can assume ToastProvider context if we use useToast
        // Ideally utilize useToast if available but context is provided below. 
        // Let's just reload data.
        loadData();
      } else {
        console.error("Error al sincronizar");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSendToDev(ticketId: string) {
    if (!confirm('¿Enviar este ticket a ChronusDev? Se creará una tarea en el proyecto predeterminado del cliente.')) return;

    // Check if we have default project ID logic? Backend handles it.

    const token = localStorage.getItem('crm_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/tickets/${ticketId}/send-to-chronusdev`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({}) // Backend will use default project if available
      });

      if (res.ok) {
        alert("Ticket enviado a desarrollo exitosamente.");
        loadData();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'No se pudo enviar'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    }
  }


  const ticketStatusColors: Record<string, string> = {
    OPEN: 'bg-red-100 text-red-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    RESOLVED: 'bg-green-100 text-green-700',
    CLOSED: 'bg-gray-100 text-gray-700',
  };

  if (loading && isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 rounded-full animate-spin border-t-emerald-600" />
          <p className="text-gray-500 font-medium">Cargando ChronusCRM...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Onboarding Tour */}
      {showOnboarding && (
        <OnboardingTour onComplete={() => setShowOnboarding(false)} />
      )}

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <div className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:static md:h-screen md:flex-shrink-0`}>
        <Sidebar
          currentView={view}
          onChangeView={(v) => { setView(v); setMobileMenuOpen(false); }}
          isCollapsed={sidebarCollapsed}
          toggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          userRole={currentUser?.role}
          enabledServices={(currentUser as any)?.organization?.enabledServices}
          user={currentUser}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen transition-all duration-300 overflow-x-hidden">

        {/* Mobile Header */}
        <div className="md:hidden h-16 bg-white border-b border-gray-100 flex items-center px-4 sticky top-0 z-30">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="ml-3 font-semibold text-gray-800">ChronusCRM</span>
        </div>

        <div className="flex-1">
          <main className="p-8 max-w-7xl mx-auto">
            {/* Header Area */}
            <div className="mb-8 flex justify-between items-center">
              <div>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                  {view === 'dashboard' ? 'Overview' : view.charAt(0).toUpperCase() + view.slice(1)}
                </h2>
                <h1 className="text-2xl font-bold text-gray-900">
                  {view === 'dashboard' && `Bienvenido de nuevo`}
                  {view === 'customers' && `Gestión de Clientes`}
                  {view === 'tickets' && `Centro de Soporte`}
                  {view === 'invoices' && `Facturación`}
                  {view === 'finances' && `Contabilidad & Finanzas`}
                  {view === 'leads' && `Pipeline de Ventas`}
                  {view === 'inbox' && `Bandeja de Entrada Unificada`}
                  {view === 'assistai' && `AssistAI - Agentes de IA`}
                  {view === 'settings' && `Configuración del Sistema`}
                  {view === 'developers' && `Developer Tools`}
                </h1>
              </div>

              {/* User Profile Tiny */}
              <div className="flex items-center gap-3">
                {/* Help/Tour Button */}
                <button
                  onClick={() => setShowOnboarding(true)}
                  title="Ver tour de ayuda"
                  className="w-9 h-9 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center text-lg hover:bg-purple-100 transition-colors"
                >
                  ?
                </button>
                {/* Notification Bell */}
                <NotificationBell />
                {/* User Profile */}
                <div className="flex items-center gap-2 bg-white p-2 pr-4 rounded-full border border-gray-200 shadow-sm group relative">
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-sm">
                    {currentUser?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="text-sm font-medium text-gray-700">{currentUser?.name || 'Usuario'}</div>
                  {/* Dropdown */}
                  <div className="absolute top-full right-0 pt-3 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
                      <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                        <p className="text-xs text-gray-500 font-medium">Conectado como</p>
                        <p className="text-sm font-bold text-gray-800 truncate" title={currentUser?.email}>{currentUser?.email}</p>
                        <div className="mt-1 flex gap-2">
                          <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold uppercase tracking-wider">{currentUser?.role}</span>
                        </div>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full p-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors font-medium"
                      >
                        <span>🚪</span> Cerrar Sesión
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard */}
            {view === 'dashboard' && stats && (
              <div className="space-y-6 animate-fadeIn">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-xl">👥</div>
                      <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">+12%</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{stats.activeCustomers}</div>
                    <div className="text-sm text-gray-500 font-medium mt-1">Clientes Activos</div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-xl">💵</div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">${stats.mrr}</div>
                    <div className="text-sm text-gray-500 font-medium mt-1">MRR Mensual</div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center text-xl">🎫</div>
                      <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-1 rounded-full">{stats.openTickets} abiertos</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{stats.openTickets + 5}</div>
                    <div className="text-sm text-gray-500 font-medium mt-1">Tickets Totales</div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center text-xl">📊</div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">98%</div>
                    <div className="text-sm text-gray-500 font-medium mt-1">Satisfacción</div>
                  </div>
                </div>

                {/* Recent Activity Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <span>🎫</span> Tickets Recientes
                    </h2>
                    <div className="space-y-4">
                      {tickets.length > 0 ? (
                        tickets.slice(0, 5).map(ticket => (
                          <div key={ticket.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{ticket.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{ticket.customer?.name} • hace 2h</p>
                            </div>
                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${ticketStatusColors[ticket.status]}`}>
                              {ticket.status.replace('_', ' ')}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-center">
                          <p className="text-sm">No hay tickets recientes.</p>
                          <button onClick={() => setView('tickets')} className="text-emerald-600 text-xs font-bold mt-2 hover:underline">Ir a Tickets</button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <span>💰</span> Últimos Pagos
                    </h2>
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-2 text-2xl">💸</div>
                      <p className="text-sm">Sin transacciones recientes.</p>
                      <button onClick={() => setView('invoices')} className="text-emerald-600 text-xs font-bold mt-2 hover:underline">Ver Facturas</button>
                    </div>
                  </div>
                </div>

                {/* AI Predictions Widget */}
                {predictions && (
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-6" data-tour="predictions">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center text-white text-lg">
                        ✨
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">Predicciones IA</h2>
                        <p className="text-gray-500 text-xs">Insights inteligentes del CRM</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* MRR Forecast */}
                      <div className="bg-white rounded-xl p-4 border border-purple-100">
                        <div className="flex items-center gap-2 mb-2">
                          <span>📈</span>
                          <span className="font-bold text-gray-800 text-sm">MRR Forecast</span>
                        </div>
                        <div className="text-xl font-bold text-emerald-600">${predictions.mrr.current.toLocaleString()}</div>
                        <div className="mt-2 space-y-1">
                          {predictions.mrr.forecast.slice(1, 3).map((f, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-gray-500">{f.month}</span>
                              <span className="font-mono font-bold text-gray-700">${f.mrr.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Churn Risk */}
                      <div className="bg-white rounded-xl p-4 border border-purple-100">
                        <div className="flex items-center gap-2 mb-2">
                          <span>⚠️</span>
                          <span className="font-bold text-gray-800 text-sm">Riesgo Churn</span>
                        </div>
                        <div className={`text-xl font-bold ${predictions.churn.atRiskCount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                          {predictions.churn.atRiskCount} clientes
                        </div>
                        {predictions.churn.atRiskMRR > 0 && (
                          <div className="mt-2 text-xs text-red-600">
                            MRR en riesgo: ${predictions.churn.atRiskMRR.toLocaleString()}
                          </div>
                        )}
                      </div>

                      {/* Pipeline */}
                      <div className="bg-white rounded-xl p-4 border border-purple-100">
                        <div className="flex items-center gap-2 mb-2">
                          <span>🎯</span>
                          <span className="font-bold text-gray-800 text-sm">Pipeline</span>
                        </div>
                        <div className="text-xl font-bold text-blue-600">${predictions.pipeline.totalValue.toLocaleString()}</div>
                        <div className="mt-2 flex gap-2">
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                            🔥 {predictions.pipeline.hotLeadsCount} hot
                          </span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            Avg: {predictions.pipeline.avgScore}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Customers View */}
            {view === 'customers' && (
              selectedCustomerId ? (
                <CustomerDetail
                  customerId={selectedCustomerId}
                  onBack={() => setSelectedCustomerId(null)}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeIn">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar clientes..."
                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-64"
                      />
                      <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                    </div>
                    <button
                      onClick={() => setShowCustomerModal(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors text-sm font-bold shadow-lg shadow-emerald-500/20"
                    >
                      + Nuevo Cliente
                    </button>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100 text-left">
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Plan & Status</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">MRR</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Actividad</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Tags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {customers.map(customer => (
                        <tr
                          key={customer.id}
                          className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                          onClick={() => setSelectedCustomerId(customer.id)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold border border-slate-200">
                                {customer.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">{customer.name}</p>
                                <p className="text-xs text-gray-500">{customer.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${customer.plan === 'PRO' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                customer.plan === 'ENTERPRISE' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                  'bg-blue-50 text-blue-700 border-blue-100'
                                }`}>
                                {customer.plan}
                              </span>
                              <span className={`text-[10px] font-medium text-gray-500 flex items-center gap-1`}>
                                <div className={`w-2 h-2 rounded-full ${customer.status === 'ACTIVE' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                                {customer.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-gray-700">
                            ${customer.monthlyRevenue}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600" title="Tickets abiertos">🎫 {customer.openTickets || 0}</span>
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600" title="Facturas pendientes">📄 {customer.pendingInvoices || 0}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-between">
                              <div className="flex gap-1 flex-wrap">
                                {customer.tags.map(tag => (
                                  <span key={tag} className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSyncCustomer(e, customer.id); }}
                                title={customer.chronusDevClientId ? "Sincronizado con ChronusDev" : "Sincronizar con ChronusDev"}
                                className={`ml-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${customer.chronusDevClientId
                                  ? 'bg-blue-50 text-blue-600 border border-blue-100 opacity-50 hover:opacity-100'
                                  : 'bg-gray-100 text-gray-400 border border-gray-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'
                                  }`}
                              >
                                {customer.chronusDevClientId ? '✓' : '🔄'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Finances View */}
            {view === 'finances' && <Finances customers={customers} />}

            {/* Leads View */}
            {view === 'leads' && <LeadsKanban />}

            {/* Inbox View */}
            {view === 'inbox' && <Inbox />}

            {/* AssistAI View */}
            {view === 'assistai' && <AssistAI />}

            {/* AI Agents View */}
            {view === 'ai-agents' && <AiAgentsPage />}

            {/* Channel Settings View */}
            {view === 'channels' && <ChannelSettings />}

            {/* Calendar View */}
            {view === 'calendar' && <Calendar />}

            {/* Kanban View */}
            {view === 'kanban' && <TicketsKanban />}

            {/* Tickets View */}
            {
              view === 'tickets' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeIn">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">Tickets de Soporte</h3>
                    <button
                      onClick={() => setShowTicketModal(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors text-sm font-bold shadow-lg shadow-emerald-500/20"
                    >
                      + Crear Ticket
                    </button>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100 text-left">
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Detalle</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Cliente</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Prioridad</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Estado</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Asignado</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Integración</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tickets.map(ticket => (
                        <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 w-1/3">
                            <p className="font-semibold text-gray-900 line-clamp-1">{ticket.title}</p>
                            <p className="text-xs text-gray-400 font-mono mt-1">{ticket.id}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                            {ticket.customer?.name || '-'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded border ${ticket.priority === 'URGENT' ? 'bg-red-50 text-red-700 border-red-100' :
                              ticket.priority === 'HIGH' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                'bg-yellow-50 text-yellow-700 border-yellow-100'
                              }`}>
                              {ticket.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded ${ticketStatusColors[ticket.status]}`}>
                              {ticket.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {ticket.assignedTo ? (
                              (() => {
                                const assignee = users.find(u => u.id === ticket.assignedTo);
                                return assignee ? (
                                  <div className="flex items-center gap-2" title={assignee.name}>
                                    <div className="w-6 h-6 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold border border-white shadow-sm">
                                      {assignee.name.charAt(0)}
                                    </div>
                                    <span className="text-xs font-medium text-gray-700 hidden xl:block">{assignee.name.split(' ')[0]}</span>
                                  </div>
                                ) : <span className="text-gray-400 text-xs">-</span>;
                              })()
                            ) : (
                              <span className="text-gray-300 text-xs italic">Sin asignar</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {ticket.chronusDevTaskId ? (
                              <div className="flex items-center gap-1 text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded w-fit border border-blue-100">
                                <span>✓ Sincronizado</span>
                              </div>
                            ) : (
                              <button onClick={() => handleSendToDev(ticket.id)} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 font-medium">
                                <span>⚡ Enviar a Dev</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }

            {/* Create Ticket Modal */}
            {
              showTicketModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn" onClick={() => setShowTicketModal(false)}>
                  <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-slideUp" onClick={e => e.stopPropagation()}>
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Nuevo Ticket de Soporte</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                        <input
                          type="text"
                          value={newTicket.title}
                          onChange={e => setNewTicket({ ...newTicket, title: e.target.value })}
                          className="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                          placeholder="Ej: Error en login..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                        <textarea
                          value={newTicket.description}
                          onChange={e => setNewTicket({ ...newTicket, description: e.target.value })}
                          className="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all h-24"
                          placeholder="Describe el problema..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                          <select
                            value={newTicket.customerId}
                            onChange={e => setNewTicket({ ...newTicket, customerId: e.target.value })}
                            className="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                          >
                            <option value="">Seleccionar...</option>
                            {customers.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                          <select
                            value={newTicket.priority}
                            onChange={e => setNewTicket({ ...newTicket, priority: e.target.value })}
                            className="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                          >
                            <option value="LOW">Baja</option>
                            <option value="MEDIUM">Media</option>
                            <option value="HIGH">Alta</option>
                            <option value="URGENT">Urgente</option>
                          </select>
                        </div>
                      </div>

                      {/* ASSIGNMENT SECTION */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a Responsable</label>
                        <div className="relative">
                          <select
                            value={newTicket.assignedTo}
                            onChange={e => setNewTicket({ ...newTicket, assignedTo: e.target.value })}
                            className="w-full p-2 pl-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white appearance-none"
                          >
                            <option value="">-- Sin asignar --</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            ▼
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">El responsable recibirá la notificación del ticket.</p>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={handleCreateTicket}
                          className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20"
                        >
                          Crear Ticket
                        </button>
                        <button
                          onClick={() => setShowTicketModal(false)}
                          className="px-4 py-2.5 border border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }

            {/* ERP / Finances Module Placeholder */}
            {
              view === 'finances' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-emerald-500 text-white p-6 rounded-2xl shadow-lg shadow-emerald-500/20">
                      <div className="text-emerald-100 text-sm font-medium mb-1">Ingresos Totales (Mes)</div>
                      <div className="text-4xl font-bold">$12,450</div>
                      <div className="mt-4 text-xs bg-emerald-600 w-fit px-2 py-1 rounded flex items-center gap-1">
                        <span>📈</span> +24% vs mes anterior
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="text-gray-500 text-sm font-medium mb-1">Gastos Operativos</div>
                      <div className="text-3xl font-bold text-gray-900">$4,200</div>
                      <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 w-[35%]"></div>
                      </div>
                      <div className="mt-1 text-xs text-gray-400 text-right">35% de ingresos</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="text-gray-500 text-sm font-medium mb-1">Beneficio Neto</div>
                      <div className="text-3xl font-bold text-emerald-600">$8,250</div>
                      <div className="mt-4 flex items-center gap-2">
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-lg font-bold">Saludable</span>
                      </div>
                    </div>
                  </div>

                  {/* Transactions Table Placeholder */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🧾</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Libro Diario</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                      El módulo de contabilidad detallada está en construcción. Pronto podrás registrar ingresos, egresos y generar balances automáticamente.
                    </p>
                    <button className="mt-6 bg-slate-900 text-white px-6 py-3 rounded-xl hover:bg-slate-800 transition-colors font-medium">
                      Configurar Cuentas Contables
                    </button>
                  </div>
                </div>
              )
            }


            {/* Developers View */}
            {view === 'developers' && <Developers />}

            {/* Invoices View */}
            {view === 'invoices' && <Invoices />}

            {/* Settings View */}
            {view === 'settings' && <Settings />}

            {/* Super Admin View */}
            {view === 'super-admin' && <SuperAdminPanel />}
          </main >
        </div>

        <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
      </div >

      {/* Customer Creation Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Nuevo Cliente</h3>
              <button onClick={() => setShowCustomerModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  placeholder="Nombre del cliente o empresa"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  placeholder="contacto@empresa.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  placeholder="+58 412 123 4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                <input
                  type="text"
                  value={newCustomer.company}
                  onChange={e => setNewCustomer({ ...newCustomer, company: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  placeholder="Nombre de la empresa"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCustomerModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateCustomer}
                  disabled={!newCustomer.name || !newCustomer.email}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl font-medium transition-all"
                >
                  Crear Cliente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Tour */}
      {showOnboarding && (
        <OnboardingTour onComplete={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}
