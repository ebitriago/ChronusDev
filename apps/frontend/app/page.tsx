'use client';

import { useEffect, useState, useCallback } from 'react';
import { getCurrentUser, logout, getProjects, type User, type Project } from './api';
import DashboardAdmin from '../components/DashboardAdmin';
import Kanban from '../components/Kanban';
import Timer from '../components/Timer';
import Clients from '../components/Clients';
import Team from '../components/Team';
import Reports from '../components/Reports';
import TeamEarningsReport from '../components/TeamEarningsReport';
import SuperAdminPanel from '../components/SuperAdminPanel';
import Login from '../components/Login';
import { Skeleton } from '../components/Skeleton';
import { ToastProvider, useToast } from '../components/Toast';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [view, setView] = useState<'dashboard' | 'projects' | 'kanban' | 'clients' | 'team' | 'reports' | 'earnings' | 'superadmin'>('dashboard');
  const [darkMode, setDarkMode] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const projs = await getProjects();
      setProjects(projs);
      if (projs.length > 0) {
        setSelectedProject(prev => prev || projs[0]);
      }
    } catch (err) {
      console.error('Error cargando proyectos:', err);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    // Fast path: check local storage or debug param first
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const debugMode = searchParams.get('debug') === 'true';
      const token = localStorage.getItem('authToken');
      const userId = localStorage.getItem('userId');

      // Debug auto-login
      if (debugMode) {
        const debugUser: User = { id: 'u-admin', name: 'Admin Demo', email: 'admin@chronusdev.com', role: 'ADMIN' };
        localStorage.setItem('authToken', 'token-admin-123');
        localStorage.setItem('userId', 'u-admin');
        setUser(debugUser);
        setLoading(false);
        await loadProjects();
        return;
      }

      // Existing session
      if (token && userId === 'u-admin') {
        setUser({ id: 'u-admin', name: 'Admin Demo', email: 'admin@chronusdev.com', role: 'ADMIN' });
        setLoading(false);
        await loadProjects();
        return;
      }
    }

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      await loadProjects();
    } catch (err) {
      console.error('Auth check failed:', err);
      // Optional: clear broken session
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
      }
    } finally {
      setLoading(false);
    }
  }, [loadProjects]);

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

  return (
    <ToastProvider>
      <div className="min-h-screen pb-32 bg-gradient-to-br from-slate-50 via-white to-slate-100">

        {/* Navbar mejorado */}
        <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo y navegación */}
              <div className="flex items-center gap-8">
                {/* Logo */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    ChronusDev
                  </span>
                </div>

                {/* Navegación */}
                {isAdmin && (
                  <div className="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1">
                    <button
                      onClick={() => setView('dashboard')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${view === 'dashboard'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                        }`}
                      title="Dashboard"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      <span className="hidden md:inline">Dashboard</span>
                    </button>
                    <button
                      onClick={() => setView('projects')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${view === 'projects'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                        }`}
                      title="Proyectos"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span className="hidden md:inline">Proyectos</span>
                    </button>
                    <button
                      onClick={() => setView('kanban')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${view === 'kanban'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                        }`}
                      title="Tareas"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span className="hidden md:inline">Tareas</span>
                    </button>
                    <button
                      onClick={() => setView('clients')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${view === 'clients'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                        }`}
                      title="Clientes"
                    >
                      <span className="text-lg">🏢</span>
                      <span className="hidden md:inline">Clientes</span>
                    </button>
                    <button
                      onClick={() => setView('team')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${view === 'team'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                        }`}
                      title="Equipo"
                    >
                      <span className="text-lg">👥</span>
                      <span className="hidden md:inline">Equipo</span>
                    </button>
                    <button
                      onClick={() => setView('reports')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${view === 'reports'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                        }`}
                      title="Reportes"
                    >
                      <span className="text-lg">📊</span>
                      <span className="hidden md:inline">Reportes</span>
                    </button>
                    <button
                      onClick={() => setView('earnings')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${view === 'earnings'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                        }`}
                      title="Nómina"
                    >
                      <span className="text-lg">💰</span>
                      <span className="hidden md:inline">Nómina</span>
                    </button>
                    {isSuperAdmin && (
                      <button
                        onClick={() => setView('superadmin')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${view === 'superadmin'
                          ? 'bg-white text-purple-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                          }`}
                        title="Super Admin"
                      >
                        <span className="text-lg">👑</span>
                        <span className="hidden md:inline">Orgs</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Nombre del proyecto para devs */}
                {!isAdmin && selectedProject && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-medium text-gray-700">{selectedProject.name}</span>
                  </div>
                )}
              </div>

              {/* Dark Mode Toggle & User & logout */}
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
                  title="Alternar modo oscuro"
                >
                  {darkMode ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 18v1m9-11h1m-18 0h1m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.95 16.95l.707.707M7.05 7.05l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-800 rounded-xl flex items-center justify-center font-semibold text-gray-600 dark:text-slate-300 text-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-sm font-medium text-gray-800 dark:text-slate-200">{user.name}</div>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${user.role === 'ADMIN'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-500'
                        }`}>
                        {user.role}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Contenido principal */}
        <main className="animate-fadeIn">
          {isAdmin && view === 'dashboard' && <DashboardAdmin />}
          {isAdmin && view === 'clients' && <Clients />}
          {isAdmin && view === 'team' && <Team />}
          {isAdmin && view === 'reports' && <Reports />}
          {isAdmin && view === 'earnings' && <TeamEarningsReport />}
          {isSuperAdmin && view === 'superadmin' && <SuperAdminPanel />}

          {isAdmin && view === 'projects' && (
            <div className="p-6 max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Proyectos</h2>
                  <p className="text-gray-500 text-sm mt-1">Gestiona tus proyectos activos</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {projects.map((p, index) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedProject(p);
                      setView('kanban');
                    }}
                    className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-slideUp"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20">
                        {p.name.charAt(0)}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-lg font-medium ${p.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                        }`}>
                        {p.status === 'ACTIVE' ? '● Activo' : p.status}
                      </span>
                    </div>

                    {/* Content */}
                    <h3 className="font-bold text-lg text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                      {p.name}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">{p.client?.name || 'Sin cliente'}</p>

                    {/* Budget */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="text-sm text-gray-500">Presupuesto</div>
                      <div className="font-bold text-gray-900">
                        {p.currency} {p.budget.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(view === 'kanban' || !isAdmin) && selectedProject && <Kanban project={selectedProject} />}

          {!isAdmin && projects.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No tienes proyectos asignados</h3>
              <p className="text-gray-500 max-w-md">
                Contacta con un administrador para que te asigne a un proyecto donde puedas comenzar a trabajar.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Timer flotante */}
      {mounted && <Timer />}
    </ToastProvider>
  );
}

