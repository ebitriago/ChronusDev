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
import { useToast } from '../components/Toast';
import Sidebar from '../components/Sidebar';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [view, setView] = useState<'dashboard' | 'projects' | 'kanban' | 'clients' | 'team' | 'reports' | 'earnings' | 'superadmin'>('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const debugMode = searchParams.get('debug') === 'true';
      const token = localStorage.getItem('authToken');
      const userId = localStorage.getItem('userId');

      if (debugMode) {
        const debugUser: User = { id: 'u-admin', name: 'Admin Demo', email: 'admin@chronusdev.com', role: 'ADMIN' };
        localStorage.setItem('authToken', 'token-admin-123');
        localStorage.setItem('userId', 'u-admin');
        setUser(debugUser);
        setLoading(false);
        await loadProjects();
        return;
      }

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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="min-h-screen bg-slate-50 flex">

      {/* Sidebar Navigation */}
      {user && (
        <>
          {/* Mobile Overlay */}
          {mobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}

          {/* Sidebar Component */}
          <div className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:static md:h-screen md:flex-shrink-0`}>
            <Sidebar
              currentView={view}
              onChangeView={(v) => { setView(v); setMobileMenuOpen(false); }}
              isCollapsed={sidebarCollapsed}
              toggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              isSuperAdmin={isSuperAdmin}
            />
          </div>
        </>
      )}

      {/* Bloque principal con margen dinámico */}
      <div className="flex-1 flex flex-col min-h-screen transition-all duration-300 overflow-x-hidden">

        {/* Header Mobile / Top Bar minimalista */}
        <div className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>

            <h2 className="text-xl font-bold text-gray-800 truncate">
              {view === 'dashboard' && 'Dashboard'}
              {view === 'projects' && 'Mis Proyectos'}
              {view === 'kanban' && selectedProject ? <span className="flex items-center gap-2"><span className="hidden sm:inline">Proyecto:</span> {selectedProject.name}</span> : view === 'kanban' ? 'Tablero' : ''}
              {view === 'clients' && 'Gestión de Clientes'}
              {view === 'team' && 'Mi Equipo'}
              {view === 'reports' && 'Reportes'}
              {view === 'earnings' && 'Nómina'}
              {view === 'superadmin' && 'Super Admin'}
            </h2>
          </div>

          {/* User Profile & Dark Mode */}
          <div className="flex items-center gap-2 md:gap-4">
            {isAdmin && (
              <a
                href="http://localhost:3003"
                target="_blank"
                className="hidden md:flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
              >
                📊 CRM
              </a>
            )}

            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
            >
              {darkMode ? '🌙' : '☀️'}
            </button>

            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <div className="text-sm font-bold text-gray-900">{user?.name}</div>
                <div className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-lg inline-block">{user?.role}</div>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center text-blue-700 font-bold border border-blue-200">
                {user?.name ? user.name.charAt(0) : 'U'}
              </div>
            </div>

            <button onClick={handleLogout} className="hidden md:block text-gray-400 hover:text-red-500 transition-colors" title="Salir">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>

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

          {(view === 'kanban' || !isAdmin) && selectedProject && (
            <Kanban
              project={selectedProject}
              allProjects={projects}
              onSwitchProject={(p) => setSelectedProject(p)}
            />
          )}

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
    </div>
  );
}
