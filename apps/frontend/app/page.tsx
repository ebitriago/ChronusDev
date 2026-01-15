'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, logout, getProjects, type User, type Project } from './api';
import DashboardAdmin from '../components/DashboardAdmin';
import Kanban from '../components/Kanban';
import Timer from '../components/Timer';
import Login from '../components/Login';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [view, setView] = useState<'dashboard' | 'kanban' | 'clients' | 'projects'>('dashboard');

  useEffect(() => {
    setMounted(true);
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      await loadProjects();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects() {
    try {
      const projs = await getProjects();
      setProjects(projs);
      if (projs.length > 0 && !selectedProject) {
        setSelectedProject(projs[0]);
      }
    } catch (err) {
      console.error('Error cargando proyectos:', err);
    }
  }

  function handleLogout() {
    logout();
    setUser(null);
    setProjects([]);
    setSelectedProject(null);
  }

  // Renderizar siempre lo mismo en servidor y cliente hasta que esté montado
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={checkAuth} />;
  }

  const isAdmin = user.role === 'ADMIN';

  return (
    <>
      <div className="min-h-screen pb-32 bg-gray-50">
        <nav className="bg-white shadow-sm border-b sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-6">
                <h1 className="text-xl font-bold text-blue-600">ChronusDev</h1>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setView('dashboard')}
                      className={`px-4 py-2 rounded-lg text-sm ${
                        view === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      Dashboard
                    </button>
                    <button
                      onClick={() => setView('projects')}
                      className={`px-4 py-2 rounded-lg text-sm ${
                        view === 'projects' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      Proyectos
                    </button>
                    <button
                      onClick={() => setView('kanban')}
                      className={`px-4 py-2 rounded-lg text-sm ${
                        view === 'kanban' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      Tareas
                    </button>
                  </div>
                )}
                {!isAdmin && selectedProject && (
                  <div className="text-sm text-gray-600 font-medium">{selectedProject.name}</div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-gray-500 ml-2">({user.role})</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1 border rounded-lg hover:bg-gray-50"
                >
                  Salir
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main>
          {isAdmin && view === 'dashboard' && <DashboardAdmin />}
          {isAdmin && view === 'projects' && (
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">Proyectos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedProject(p);
                      setView('kanban');
                    }}
                    className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition"
                  >
                    <h3 className="font-semibold text-lg mb-2">{p.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{p.client?.name}</p>
                    <div className="text-sm">
                      <span className="text-gray-600">Presupuesto: </span>
                      <span className="font-medium">
                        {p.currency} {p.budget.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(view === 'kanban' || !isAdmin) && selectedProject && <Kanban project={selectedProject} />}
          {!isAdmin && projects.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              No tienes proyectos asignados
            </div>
          )}
        </main>
      </div>
      {mounted && <Timer />}
    </>
  );
}
