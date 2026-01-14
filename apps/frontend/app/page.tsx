'use client';

import { useEffect, useState } from 'react';
import { getProjects, type Project } from './api';
import DashboardAdmin from '../components/DashboardAdmin';
import Kanban from '../components/Kanban';
import Timer from '../components/Timer';

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [view, setView] = useState<'dashboard' | 'kanban'>('dashboard');
  const [userId, setUserId] = useState<string>('u-juan');

  useEffect(() => {
    const stored = localStorage.getItem('userId');
    if (stored) setUserId(stored);
    loadProjects();
  }, []);

  async function loadProjects() {
    const projs = await getProjects();
    setProjects(projs);
    if (projs.length > 0 && !selectedProject) {
      setSelectedProject(projs[0]);
    }
  }

  useEffect(() => {
    localStorage.setItem('userId', userId);
  }, [userId]);

  const isAdmin = userId === 'u-admin';

  return (
    <div className="min-h-screen pb-32">
      <nav className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-blue-600">ChronusDev</h1>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="border rounded-lg px-3 py-1 text-sm"
              >
                <option value="u-admin">Admin</option>
                <option value="u-juan">Juan (Dev)</option>
              </select>
              {isAdmin && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setView('dashboard')}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      view === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => setView('kanban')}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      view === 'kanban' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                    }`}
                  >
                    Tareas
                  </button>
                </div>
              )}
              {!isAdmin && selectedProject && (
                <div className="text-sm text-gray-600">
                  {selectedProject.name}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main>
        {isAdmin && view === 'dashboard' && <DashboardAdmin />}
        {isAdmin && view === 'kanban' && selectedProject && <Kanban project={selectedProject} />}
        {!isAdmin && selectedProject && <Kanban project={selectedProject} />}
      </main>

      <Timer />
    </div>
  );
}
