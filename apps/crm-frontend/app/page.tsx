'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
import CustomerModal from '../components/CustomerModal';
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
import Reports from '../components/Reports';
import UserManual from '../components/UserManual';
import ErpPanel from '../components/ErpPanel';
import DashboardAdmin from '../components/DashboardAdmin';
import GlobalSearch from '../components/GlobalSearch';
import TicketDetailModal from '../components/TicketDetailModal';
import TicketModal from '../components/TicketModal';
import Marketing from '../components/Marketing';

export default function CRMPage() {
  const [view, setView] = useState<'dashboard' | 'customers' | 'tickets' | 'invoices' | 'finances' | 'leads' | 'inbox' | 'assistai' | 'ai-agents' | 'channels' | 'settings' | 'developers' | 'super-admin' | 'calendar' | 'kanban' | 'reports' | 'erp' | 'manual' | 'marketing'>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false); // Separate data loading state

  // Data State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Navigation History
  const [history, setHistory] = useState<string[]>([]);

  const changeView = (newView: typeof view) => {
    if (newView === view) return;
    setHistory(prev => [...prev, view]);
    setView(newView);
  };

  const goBack = () => {
    if (history.length === 0) return;
    const previousView = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setView(previousView as any);
  };

  // Selection State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [inboxTargetContact, setInboxTargetContact] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null); // For detail view

  async function handleOpenActivity(activity: any) {
    console.log('handleOpenActivity called with:', JSON.stringify(activity, null, 2));

    // 1. If it's a TICKET activity, try to open the ticket modal
    // Check metadata.ticketId OR if it's a TICKET type check if id might be useful (unlikely if it's activity id)
    if (activity.metadata?.ticketId) {
      try {
        const token = localStorage.getItem('crm_token');
        const res = await fetch(`${API_URL}/tickets/${activity.metadata.ticketId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const ticket = await res.json();
          setSelectedTicket(ticket);
          return;
        }
      } catch (e) {
        console.error("Error fetching ticket details", e);
      }
    } else if (activity.type === 'TICKET') {
      // Fallback: just go to tickets view if we can't open the specific ticket
      setView('tickets');
      return;
    }

    // 2. If it's a CLIENT-related activity
    if (activity.customerId) {
      setSelectedCustomerId(activity.customerId);
      setView('customers');
      return;
    }

    // 3. Fallback/Other types
    if (activity.type === 'INVOICE' || activity.type === 'PAYMENT') {
      setView('finances');
      return;
    }
  }

  // Modal State
  const [showTicketModal, setShowTicketModal] = useState(false);
  // Removed newTicket state as it is handled by TicketModal now

  // Customer Modal State
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', company: '' });

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);

  // FAB state
  const [fabOpen, setFabOpen] = useState(false);

  // Swipe gesture refs
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    // Swipe right to go back (min 80px horizontal, less than 60px vertical drift)
    if (deltaX > 80 && deltaY < 60 && touchStartX.current < 40) {
      goBack();
    }
  };

  // Section labels for mobile header
  const viewLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    customers: 'Clientes',
    tickets: 'Soporte',
    invoices: 'Facturación',
    finances: 'Finanzas',
    leads: 'Pipeline',
    inbox: 'Inbox',
    assistai: 'AssistAI',
    'ai-agents': 'Agentes IA',
    channels: 'Canales',
    settings: 'Configuración',
    developers: 'Developers',
    'super-admin': 'Super Admin',
    calendar: 'Calendario',
    kanban: 'Kanban',
    reports: 'Reportes',
    erp: 'ERP',
    marketing: 'Marketing',
  };

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

    // Check for initial actions
    const initialAction = sessionStorage.getItem('crm_initial_action');
    if (initialAction) {
      if (initialAction === 'new_ticket') setShowTicketModal(true);
      if (initialAction === 'new_customer') setShowCustomerModal(true);
      sessionStorage.removeItem('crm_initial_action');
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
      const [customersData, usersData] = await Promise.all([
        fetchCustomers(),
        fetchUsers()
      ]);

      setCustomers(customersData);
      setUsers(usersData);

      // Fetch tickets separately to not block others if it fails or is slow
      fetchTickets().then(setTickets);

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

      {/* Global Search - Cmd+K */}
      <GlobalSearch onNavigate={(type, id) => {
        if (type === 'customer') {
          setSelectedCustomerId(id);
          setView('customers');
        } else if (type === 'lead') {
          setView('leads');
        } else if (type === 'ticket') {
          setView('tickets');
        }
      }} />

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <div className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:sticky md:top-0 md:h-screen md:flex-shrink-0`}>
        <Sidebar
          currentView={view}
          onChangeView={(v) => {
            changeView(v);
            setMobileMenuOpen(false);
            setInboxTargetContact(null);
          }}
          isCollapsed={sidebarCollapsed}
          toggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          userRole={currentUser?.role}
          enabledServices={(currentUser as any)?.organization?.enabledServices}
          user={currentUser}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen transition-all duration-300 overflow-x-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

        {/* Mobile Header — Contextual */}
        <div className="md:hidden h-14 bg-white border-b border-gray-100 flex items-center justify-between px-3 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {history.length > 0 ? (
              <button
                onClick={goBack}
                className="p-2 -ml-1 text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors"
                aria-label="Volver"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
            ) : (
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 -ml-1 text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors"
                aria-label="Menú"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            )}
            <h1 className="font-bold text-gray-900 text-base truncate">{viewLabels[view] || view}</h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                // Trigger Cmd+K global search
                const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
                document.dispatchEvent(event);
              }}
              className="p-2 text-gray-500 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors"
              aria-label="Buscar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
            <NotificationBell />
          </div>
        </div>

        <div className="flex-1 pb-20 md:pb-0">
          <main className="p-4 md:p-8 max-w-7xl mx-auto">
            {/* Header Area */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3 w-full md:w-auto">
                {history.length > 0 && (
                  <button
                    onClick={goBack}
                    className="hidden md:flex p-2 -ml-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                    title="Volver"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                )}
                <h1 className="text-2xl font-bold text-gray-900 truncate">
                  {view === 'dashboard' && `Bienvenido de nuevo`}
                  {view === 'customers' && `Gestión de Clientes`}
                  {view === 'tickets' && `Centro de Soporte`}
                  {view === 'invoices' && `Facturación`}
                  {view === 'finances' && `Contabilidad & Finanzas`}
                  {view === 'leads' && `Pipeline de Ventas`}
                  {view === 'inbox' && `Bandeja de Entrada`}
                  {view === 'assistai' && `AssistAI Agent`}
                  {view === 'settings' && `Configuración`}
                  {view === 'developers' && `Developer Tools`}
                  {view === 'reports' && `Reportes y Analytics`}
                  {view === 'erp' && `ERP & Pedidos`}
                  {view === 'ai-agents' && `Agentes IA`}
                  {view === 'channels' && `Canales`}
                  {view === 'kanban' && `Kanban`}
                  {view === 'calendar' && `Calendario`}
                </h1>
              </div>

              {/* Right: Search + Help + Notifications + User */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                {/* Search Bar — Desktop only */}
                <button
                  onClick={() => {
                    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
                    document.dispatchEvent(event);
                  }}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-400 text-sm transition-colors group"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <span className="group-hover:text-gray-500">Buscar...</span>
                  <kbd className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded-md border border-gray-200 text-gray-400">⌘K</kbd>
                </button>
                {/* Help/Tour */}
                <button
                  onClick={() => setShowOnboarding(true)}
                  title="Ver tour de ayuda"
                  className="w-9 h-9 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center hover:bg-purple-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
                {/* Notification Bell */}
                <NotificationBell />
                {/* User Profile */}
                <div className="hidden md:flex items-center gap-2 bg-white p-2 pr-4 rounded-xl border border-gray-200 shadow-sm group relative cursor-pointer hover:shadow-md transition-shadow">
                  <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
                    {currentUser?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Cerrar Sesión
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard */}
            {view === 'dashboard' && <DashboardAdmin
              onNavigate={(v) => setView(v as any)}
              onOpenActivity={handleOpenActivity}
              onCreateTicket={() => setShowTicketModal(true)}
              onCreateCustomer={() => setShowCustomerModal(true)}
            />}

            {/* Customers View */}
            {view === 'customers' && (
              selectedCustomerId ? (
                <CustomerDetail
                  customerId={selectedCustomerId}
                  onBack={() => setSelectedCustomerId(null)}
                  onOpenChat={(contact) => {
                    setInboxTargetContact(contact);
                    setView('inbox');
                  }}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeIn">
                  <div className="p-4 md:p-6 border-b border-gray-100 flex flex-wrap gap-3 justify-between items-center">
                    <div className="relative w-full sm:w-auto">
                      <input
                        type="text"
                        placeholder="Buscar clientes..."
                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-full sm:w-64"
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
                  {/* Mobile Cards View */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {customers.map(customer => (
                      <div
                        key={customer.id}
                        className="p-4 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
                        onClick={() => setSelectedCustomerId(customer.id)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold border border-slate-200 text-sm">
                              {customer.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{customer.name}</p>
                              <div className="flex gap-2 items-center">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${customer.plan === 'PRO' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                  {customer.plan}
                                </span>
                                <span className="text-xs text-gray-500 font-mono">${customer.monthlyRevenue}</span>
                              </div>
                            </div>
                          </div>
                          <div className={`w-2 h-2 rounded-full ${customer.status === 'ACTIVE' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                        </div>
                        <div className="flex items-center justify-between mt-3 pl-13">
                          <div className="flex gap-2">
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">🎫 {customer.openTickets || 0}</span>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">📄 {customer.pendingInvoices || 0}</span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSyncCustomer(e, customer.id); }}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center border ${customer.chronusDevClientId ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-white text-gray-400 border-gray-200'}`}
                          >
                            {customer.chronusDevClientId ? '✓' : '🔄'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <table className="w-full hidden md:table">
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
                                {(customer.tags || []).map(tag => (
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
            {view === 'inbox' && <Inbox initialContact={inboxTargetContact} />}

            {/* AssistAI View */}
            {view === 'assistai' && <AssistAI />}

            {/* Marketing View */}
            {view === 'marketing' && <Marketing />}

            <CustomerModal
              isOpen={showCustomerModal}
              onClose={() => setShowCustomerModal(false)}
              onSuccess={() => { loadData(); setShowCustomerModal(false); }}
            />

            {/* AI Agents View */}
            {view === 'ai-agents' && <AiAgentsPage />}

            {/* Channel Settings View */}
            {view === 'channels' && <ChannelSettings />}

            {/* Calendar View */}
            {view === 'calendar' && <Calendar />}

            {/* Kanban View */}
            {view === 'kanban' && <TicketsKanban onNavigate={() => setView('tickets')} />}

            {/* Reports View */}
            {view === 'reports' && <Reports />}

            {/* Manual View */}
            {view === 'manual' && <UserManual />}

            {/* ERP View */}
            {view === 'erp' && <ErpPanel />}

            {selectedTicket && (
              <TicketDetailModal
                ticket={selectedTicket}
                onClose={() => setSelectedTicket(null)}
                onStatusChange={async (newStatus) => {
                  try {
                    const token = localStorage.getItem('crm_token');
                    await fetch(`${API_URL}/tickets/${selectedTicket.id}`, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({ status: newStatus })
                    });
                    // Update local state
                    setSelectedTicket({ ...selectedTicket, status: newStatus });
                    setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: newStatus } : t));
                  } catch (e) {
                    console.error("Error updating ticket status", e);
                  }
                }}
              />
            )}

            {/* Tickets View */}
            {
              view === 'tickets' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeIn">
                  <div className="p-4 md:p-6 border-b border-gray-100 flex flex-wrap gap-3 justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">Tickets de Soporte</h3>
                    <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                      <button
                        onClick={() => setView('kanban')}
                        className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-xl transition-colors text-sm font-bold"
                      >
                        📊 Vista Kanban
                      </button>
                      <button
                        onClick={() => setShowTicketModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors text-sm font-bold shadow-lg shadow-emerald-500/20"
                      >
                        + Crear Ticket
                      </button>
                    </div>
                  </div>
                  {/* Mobile Cards for Tickets */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {tickets.map(ticket => (
                      <div
                        key={ticket.id}
                        className="p-4 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
                        onClick={() => setSelectedTicket(ticket)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 pr-2">
                            <p className="font-bold text-gray-900 line-clamp-2">{ticket.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{ticket.customer?.name || 'Cliente desconocido'}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-[10px] font-bold border ${ticketStatusColors[ticket.status]}`}>
                            {ticket.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                          <span className={`px-2 py-0.5 rounded border ${ticket.priority === 'URGENT' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-gray-50 border-gray-200'}`}>
                            {ticket.priority}
                          </span>
                          <span className="font-mono">{ticket.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <table className="w-full hidden md:table">
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
                        <tr
                          key={ticket.id}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => setSelectedTicket(ticket)}
                        >
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
            <TicketModal
              isOpen={showTicketModal}
              onClose={() => setShowTicketModal(false)}
              onSuccess={() => {
                setShowTicketModal(false);
                loadData();
              }}
            />




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

      {/* ===== MOBILE BOTTOM NAV BAR ===== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex justify-around items-center h-16">
          {[
            {
              id: 'dashboard', icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg>
              ), label: 'Inicio'
            },
            {
              id: 'inbox', icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
              ), label: 'Inbox'
            },
            {
              id: 'customers', icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              ), label: 'Clientes'
            },
            {
              id: 'tickets', icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
              ), label: 'Tickets'
            },
            {
              id: '_more', icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" /></svg>
              ), label: 'Más'
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === '_more') {
                  setMobileMenuOpen(true);
                } else {
                  changeView(tab.id as any);
                }
                setFabOpen(false);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors ${tab.id !== '_more' && view === tab.id
                ? 'text-emerald-600'
                : 'text-gray-400 active:text-gray-600'
                }`}
            >
              {tab.icon}
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ===== MOBILE FAB (Quick Create) ===== */}
      <div className="md:hidden fixed bottom-20 right-4 z-50">
        {/* FAB Menu */}
        {fabOpen && (
          <div className="mb-3 flex flex-col gap-2 items-end animate-fadeIn">
            <button
              onClick={() => { setShowCustomerModal(true); setFabOpen(false); }}
              className="flex items-center gap-2 bg-white shadow-lg rounded-full pl-4 pr-5 py-2.5 text-sm font-semibold text-gray-800 border border-gray-100 active:scale-95 transition-transform"
            >
              <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-lg">👤</span>
              Nuevo Cliente
            </button>
            <button
              onClick={() => { setShowTicketModal(true); setFabOpen(false); }}
              className="flex items-center gap-2 bg-white shadow-lg rounded-full pl-4 pr-5 py-2.5 text-sm font-semibold text-gray-800 border border-gray-100 active:scale-95 transition-transform"
            >
              <span className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-lg">🎫</span>
              Nuevo Ticket
            </button>
            <button
              onClick={() => { changeView('leads'); setFabOpen(false); }}
              className="flex items-center gap-2 bg-white shadow-lg rounded-full pl-4 pr-5 py-2.5 text-sm font-semibold text-gray-800 border border-gray-100 active:scale-95 transition-transform"
            >
              <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-lg">💼</span>
              Nuevo Lead
            </button>
          </div>
        )}
        {/* FAB Button */}
        <button
          onClick={() => setFabOpen(!fabOpen)}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 active:scale-90 ${fabOpen
            ? 'bg-gray-800 rotate-45'
            : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30'
            }`}
        >
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* FAB backdrop */}
      {fabOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setFabOpen(false)}
        />
      )}
    </div>
  );
}
