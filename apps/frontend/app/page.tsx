'use client';

import { useEffect, useState, useCallback } from 'react';
import { getCurrentUser, logout, getProjects, getClients, getUsers, getProjectSummary, getCrmLinkStatus, type User, type Project, type Client, type ProjectSummary } from './api';
import DashboardAdmin from '../components/DashboardAdmin';
import Kanban from '../components/Kanban';
import Timer from '../components/Timer';
import Clients from '../components/Clients';
import Team from '../components/Team';
import Reports from '../components/Reports';
import TeamEarningsReport from '../components/TeamEarningsReport';
import FinanceDashboard from '../components/FinanceDashboard';
import SuperAdminPanel from '../components/SuperAdminPanel';
import AdvancedReports from '../components/AdvancedReports';
import MasterKanban from '../components/MasterKanban';
import Settings from '../components/Settings';
import Login from '../components/Login';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import AppLayout from '../components/AppLayout';
import OnboardingTour from '../components/OnboardingTour';
import GlobalSearch from '../components/GlobalSearch';
import ProjectModal from '../components/ProjectModal';
import NotificationCenter from '../components/NotificationCenter';
import TicketsList from '../components/TicketsList';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [summaries, setSummaries] = useState<Record<string, ProjectSummary>>({});

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [view, setView] = useState<'dashboard' | 'projects' | 'kanban' | 'tickets' | 'backlog' | 'clients' | 'team' | 'reports' | 'reportes-pro' | 'earnings' | 'superadmin' | 'settings'>('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  // sidebarCollapsed is now handled by AppLayout
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isCrmLinked, setIsCrmLinked] = useState(false);

  // Navigation history for back button
  const [history, setHistory] = useState<string[]>([]);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const changeView = (newView: string) => {
    if (newView !== view) {
      setHistory(prev => [...prev, view]);
    }
    setView(newView as any);
    setMobileMoreOpen(false);
  };
  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      setView(prev as any);
    }
  };

  // Modal State
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [projs, cls, usrs, crmStatus] = await Promise.all([
        getProjects(),
        getClients(),
        getUsers(),
        getCrmLinkStatus()
      ]);
      setProjects(projs);
      setClients(cls);
      setUsers(usrs);
      setIsCrmLinked(crmStatus?.linked || false);

      if (projs.length > 0 && !selectedProject) {
        // Don't auto-select if we are not in kanban view, creates confusion
        // setSelectedProject(projs[0]); 
      }
    } catch (err) {
      console.error('Error cargando datos:', err);
    }
  }, [selectedProject]);

  // Load summaries in background when projects change
  useEffect(() => {
    if (projects.length > 0) {
      const fetchSummaries = async () => {
        const summariesData: Record<string, ProjectSummary> = {};
        await Promise.all(projects.map(async (p) => {
          try {
            const summary = await getProjectSummary(p.id);
            summariesData[p.id] = summary;
          } catch (e) {
            console.error(`Error loading summary for ${p.id}`, e);
          }
        }));
        setSummaries(summariesData);
      };
      fetchSummaries();
    }
  }, [projects]);

  const checkAuth = useCallback(async () => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const urlToken = searchParams.get('token');
      if (urlToken) {
        localStorage.setItem('authToken', urlToken);
        localStorage.setItem('crm_token', urlToken);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      await loadData();
    } catch (err) {
      console.error('Auth check failed:', err);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('crm_token');
        localStorage.removeItem('userId');
      }
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  // Check onboarding status
  useEffect(() => {
    if (user && mounted) {
      const completed = localStorage.getItem('chronusdev_onboarding_complete');
      if (!completed) {
        setShowOnboarding(true);
      }
    }
  }, [user, mounted]);

  useEffect(() => {
    if (!mounted) {
      setMounted(true);
      checkAuth();
    }
  }, [mounted, checkAuth]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = localStorage.getItem('darkMode') === 'true';
      setDarkMode(isDark);
      if (isDark) document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newDark = !darkMode;
    setDarkMode(newDark);
    localStorage.setItem('darkMode', String(newDark));
    if (newDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  function handleLogout() {
    logout();
    setUser(null);
    setProjects([]);
    setSelectedProject(null);
  }

  // Handle URL query params
  useEffect(() => {
    if (typeof window !== 'undefined' && mounted && projects.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      const projectIdParam = params.get('projectId');

      if (viewParam) {
        setView(viewParam as any);
      }

      if (projectIdParam) {
        const project = projects.find(p => p.id === projectIdParam);
        if (project) {
          setSelectedProject(project);
        }
      }
    }
  }, [mounted, projects]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Helper for budget color
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

  // Loading state
  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600" />
          </div>
          <p className="text-gray-500 font-medium">Cargando ChronusDev...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={checkAuth} />;
  }

  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const isManagerOrAbove = isAdmin || user.role === 'MANAGER';
  const canManageProjects = isAdmin || user.role === 'MANAGER';


  return (
    <AppLayout
      user={user}
      currentView={view as any}
      onChangeView={(v) => { changeView(v); setMobileMenuOpen(false); }}
      mobileMenuOpen={mobileMenuOpen}
      setMobileMenuOpen={setMobileMenuOpen}
      isCrmLinked={isCrmLinked}
    >
      {/* Onboarding */}
      {showOnboarding && <OnboardingTour onComplete={() => setShowOnboarding(false)} />}

      {/* Global Search - Cmd+K */}
      <GlobalSearch onNavigate={(type, id) => {
        if (type === 'project') {
          const project = projects.find(p => p.id === id);
          if (project) {
            setSelectedProject(project);
            setView('kanban');
          }
        } else if (type === 'task') {
          setView('kanban');
        }
      }} />

      {/* Mobile Overlay is handled by AppLayout */}
      {/* Sidebar is handled by AppLayout */}

      {/* Main Content Content (Header + Main + Nav) */}

      {/* Header — contextual mobile + clean desktop */}
      <div className="h-14 md:h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          {/* Mobile: hamburger or back */}
          <button
            onClick={() => history.length > 0 ? goBack() : setMobileMenuOpen(true)}
            className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-xl"
          >
            {history.length > 0 ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>

          {/* Desktop: back button */}
          {history.length > 0 && (
            <button
              onClick={goBack}
              className="hidden md:flex p-2 -ml-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
              title="Volver"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}

          <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">
            {view === 'dashboard' && 'Dashboard'}
            {view === 'projects' && 'Mis Proyectos'}
            {view === 'kanban' && selectedProject ? <span className="flex items-center gap-2">{selectedProject.name}</span> : view === 'kanban' ? 'Tablero' : ''}
            {view === 'tickets' && 'Tickets'}
            {view === 'backlog' && 'Master Kanban'}
            {view === 'clients' && 'Gestión de Clientes'}
            {view === 'team' && 'Mi Equipo'}
            {view === 'reports' && 'Reportes'}
            {view === 'reportes-pro' && 'Reportes Pro'}
            {view === 'earnings' && 'Nómina'}
            {view === 'superadmin' && 'Super Admin'}
            {view === 'settings' && 'Configuración'}
          </h1>
        </div>

        {/* Right: Search + Notifications + User */}
        <div className="flex items-center gap-2">
          {/* Search hint — desktop */}
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

          {/* Notifications */}
          <NotificationCenter />

          {/* Dark mode — desktop only */}
          <button
            onClick={toggleDarkMode}
            className="hidden md:flex p-2 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
          >
            {darkMode ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            )}
          </button>

          {/* User — desktop only */}
          <div className="hidden md:flex items-center gap-2 bg-white p-2 pr-4 rounded-xl border border-gray-200 shadow-sm group relative cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
              {user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
            </div>
            <div className="text-sm font-medium text-gray-700">{user?.name || 'Usuario'}</div>
            {/* Dropdown */}
            <div className="absolute top-full right-0 pt-3 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                  <p className="text-xs text-gray-500 font-medium">Conectado como</p>
                  <p className="text-sm font-bold text-gray-800 truncate" title={user?.email}>{user?.email}</p>
                  <div className="mt-1">
                    <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold uppercase tracking-wider">{user?.role}</span>
                  </div>
                </div>
                <button
                  onClick={toggleDarkMode}
                  className="w-full p-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors font-medium"
                >
                  {darkMode ? '🌙' : '☀️'} {darkMode ? 'Modo Claro' : 'Modo Oscuro'}
                </button>
                <hr className="border-gray-100" />
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

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 md:pb-8 animate-fadeIn">
        {/* Dashboard - visible to all users */}
        {view === 'dashboard' && <DashboardAdmin user={user} />}
        {view === 'tickets' && <TicketsList />}

        {/* Manager+ views: clients, team, reports */}
        {(isAdmin || user.role === 'MANAGER') && view === 'clients' && <Clients />}
        {(isAdmin || user.role === 'MANAGER') && view === 'team' && <Team />}
        {(isAdmin || user.role === 'MANAGER' || user.role === 'DEV') && view === 'reports' && <Reports />}
        {(isAdmin || user.role === 'MANAGER' || user.role === 'DEV') && view === 'reportes-pro' && <AdvancedReports user={user} />}

        {/* Admin only: earnings/finances */}
        {isAdmin && view === 'earnings' && <FinanceDashboard />}

        {/* Admin only: Master Kanban */}
        {isAdmin && view === 'backlog' && (
          <MasterKanban
            onTaskClick={(task) => {
              // Navigate to the project kanban with the task selected
              const project = projects.find(p => p.id === task.projectId);
              if (project) {
                setSelectedProject(project);
                setView('kanban');
              }
            }}
          />
        )}

        {/* Super Admin only */}
        {isSuperAdmin && view === 'superadmin' && <SuperAdminPanel />}

        {/* Admin Settings */}
        {isAdmin && view === 'settings' && <Settings />}

        {/* Projects View */}
        {view === 'projects' && (
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Proyectos</h2>
                <p className="text-gray-500 text-sm mt-1">Gestiona tus proyectos activos</p>
              </div>
              {canManageProjects && (
                <button
                  onClick={() => {
                    setEditingProject(null);
                    setShowProjectModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20"
                >
                  <span>+</span> Nuevo Proyecto
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((p, index) => {
                const summary = summaries[p.id];
                // If we have summary data, calculate percentage, else 0
                const percentage = summary && summary.budget > 0 ? (summary.spent / summary.budget) * 100 : 0;
                const gradient = getBudgetGradient(percentage);
                const status = getBudgetStatus(percentage);

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedProject(p);
                      setView('kanban');
                    }}
                    className="group bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-slideUp relative overflow-hidden"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Status Line */}
                    <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />

                    <div className="p-6">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20">
                            {p.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                              {p.name}
                            </h3>
                            <p className="text-xs text-gray-500">{p.client?.name || 'Sin cliente'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Manage Button */}
                          {canManageProjects && (
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `/projects/${p.id}`;
                                }}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Configuración y Tarifas"
                              >
                                ⚙️
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingProject(p);
                                  setShowProjectModal(true);
                                }}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Editar Proyecto (Rápido)"
                              >
                                ✏️
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Summary / Budget */}
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Estado</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.bg}`}>{status.text}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Presupuesto</span>
                          <span className="font-bold text-gray-900">
                            {p.currency} {(p.budget || 0).toLocaleString()}
                          </span>
                        </div>

                        {/* Consumption Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Consumido: {summary ? `${summary.currency} ${summary.spent.toFixed(0)}` : '-'}</span>
                            <span>{percentage.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Members Avatars */}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="flex -space-x-2 overflow-hidden py-1">
                          {p.members && p.members.length > 0 ? (
                            <>
                              {p.members.slice(0, 5).map((m: any, idx: number) => (
                                <div
                                  key={m.userId || idx}
                                  className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] text-gray-600 font-bold shadow-sm"
                                  title={m.user?.name || 'Usuario'}
                                >
                                  {m.user?.name?.charAt(0) || '?'}
                                </div>
                              ))}
                              {p.members.length > 5 && (
                                <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[8px] text-gray-500 font-bold">
                                  +{p.members.length - 5}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Sin miembros</span>
                          )}
                        </div>

                        {/* Task Count (if available in summary) - Optional enhancement */}
                        <div className="text-xs text-gray-400 font-medium">
                          {/* Placeholder for task count if needed */}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Kanban - visible to all users */}
        {view === 'kanban' && selectedProject && (
          <Kanban
            project={selectedProject}
            allProjects={projects}
            onSwitchProject={(p) => setSelectedProject(p)}
          />
        )}

        {/* Kanban view without a selected project — show project picker */}
        {view === 'kanban' && !selectedProject && projects.length > 0 && (
          <div className="p-6 max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Selecciona un proyecto</h2>
              <p className="text-gray-500 dark:text-gray-400">Elige un proyecto para ver su tablero de tareas</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProject(p)}
                  className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20 flex-shrink-0">
                    {p.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{p.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{p.client?.name || 'Sin cliente'}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'kanban' && !selectedProject && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-4xl">📋</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay proyectos</h3>
            <p className="text-gray-500 max-w-md">
              No tienes proyectos asignados aún. Contacta con un administrador para que te agregue a un equipo.
            </p>
          </div>
        )}

        {!isAdmin && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-4xl">👋</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Bienvenido a ChronusDev</h3>
            <p className="text-gray-500 max-w-md">
              Aún no tienes proyectos asignados.
              Contacta con un administrador para que te agregue a un equipo.
            </p>
          </div>
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-40 px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around">
          {[
            { id: 'dashboard', label: 'Inicio', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg> },
            { id: 'projects', label: 'Proyectos', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg> },
            { id: 'kanban', label: 'Tareas', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg> },
            { id: 'reports', label: 'Reportes', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => changeView(item.id)}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-colors min-w-[60px] ${view === item.id ? 'text-blue-600' : 'text-gray-400'}`}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
          {/* More menu */}
          <div className="relative">
            <button
              onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-colors min-w-[60px] ${mobileMoreOpen ? 'text-blue-600' : 'text-gray-400'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
              <span className="text-[10px] font-medium">Más</span>
            </button>

            {mobileMoreOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMobileMoreOpen(false)} />
                <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 z-50 animate-fadeIn">
                  {[
                    { id: 'reportes-pro', label: 'Reportes Pro', icon: '⭐' },
                    ...(isManagerOrAbove ? [{ id: 'clients', label: 'Clientes', icon: '🏢' }] : []),
                    ...(isManagerOrAbove ? [{ id: 'team', label: 'Equipo', icon: '👥' }] : []),
                    ...(isAdmin ? [{ id: 'earnings', label: 'Nómina', icon: '💰' }] : []),
                    ...(isAdmin ? [{ id: 'backlog', label: 'Master Kanban', icon: '🎯' }] : []),
                    ...(isAdmin ? [{ id: 'settings', label: 'Configuración', icon: '⚙️' }] : []),
                    ...(isSuperAdmin ? [{ id: 'superadmin', label: 'Organizaciones', icon: '👑' }] : []),
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => changeView(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${view === item.id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </nav>


      {/* Timer flotante — above bottom nav on mobile */}
      {mounted && <Timer />}

      {/* Project Modal */}
      <ProjectModal
        isOpen={showProjectModal}
        onClose={() => {
          setShowProjectModal(false);
          setEditingProject(null);
        }}
        onSuccess={() => {
          loadData(); // Reload everything
        }}
        project={editingProject}
        clients={clients}
        users={users}
      />
    </AppLayout>
  );
}
