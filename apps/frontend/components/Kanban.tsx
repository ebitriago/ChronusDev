'use client';

import { useEffect, useState } from 'react';
import { getTasks, createTask, type Task, type Project } from '../app/api';

type KanbanProps = {
  project: Project;
};

export default function Kanban({ project }: KanbanProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showNewTask, setShowNewTask] = useState(false);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 5000);
    return () => clearInterval(interval);
  }, [project.id]);

  async function loadTasks() {
    const ts = await getTasks(project.id);
    setTasks(ts);
  }

  async function handleCreateTask() {
    if (!newTaskTitle.trim()) return;
    await createTask(project.id, newTaskTitle);
    setNewTaskTitle('');
    setShowNewTask(false);
    await loadTasks();
  }

  const columns = [
    { status: 'BACKLOG' as const, title: 'Backlog', color: 'bg-gray-100' },
    { status: 'IN_PROGRESS' as const, title: 'En Progreso', color: 'bg-blue-100' },
    { status: 'DONE' as const, title: 'Completado', color: 'bg-green-100' },
  ];

  function formatHours(hours?: number): string {
    if (!hours || hours === 0) return '0h';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${hours.toFixed(1)}h`;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{project.name}</h2>
        <button
          onClick={() => setShowNewTask(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Nueva Tarea
        </button>
      </div>

      {showNewTask && (
        <div className="mb-4 p-4 bg-white rounded-lg shadow border">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Título de la tarea..."
            className="w-full p-2 border rounded-lg mb-2"
            onKeyPress={(e) => e.key === 'Enter' && handleCreateTask()}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateTask}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Crear
            </button>
            <button
              onClick={() => {
                setShowNewTask(false);
                setNewTaskTitle('');
              }}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status);
          return (
            <div key={col.status} className={`${col.color} rounded-lg p-4`}>
              <h3 className="font-semibold mb-4 flex items-center justify-between">
                <span>{col.title}</span>
                <span className="text-sm bg-white px-2 py-1 rounded">{colTasks.length}</span>
              </h3>
              <div className="space-y-3">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500"
                  >
                    <div className="font-medium mb-2">{task.title}</div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Tiempo acumulado:</span>
                      <span className="font-semibold text-blue-600">
                        {formatHours(task.totalHours)}
                      </span>
                    </div>
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <div className="text-center text-gray-500 text-sm py-8">
                    No hay tareas
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
