'use client';

import { useEffect, useState } from 'react';
import { getTasks, createTask, assignTask, getTask, addTaskComment, type Task, type Project, type TaskComment } from '../app/api';

type KanbanProps = {
  project: Project;
};

export default function Kanban({ project }: KanbanProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showNewTask, setShowNewTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 5000);
    return () => clearInterval(interval);
  }, [project.id]);

  async function loadTasks() {
    try {
      const ts = await getTasks(project.id);
      setTasks(ts);
    } catch (err) {
      console.error('Error cargando tareas:', err);
    }
  }

  async function handleCreateTask() {
    if (!newTaskTitle.trim()) return;
    try {
      await createTask({
        projectId: project.id,
        title: newTaskTitle,
      });
      setNewTaskTitle('');
      setShowNewTask(false);
      await loadTasks();
    } catch (err) {
      console.error('Error creando tarea:', err);
    }
  }

  async function handleAssignTask(taskId: string) {
    try {
      await assignTask(taskId);
      await loadTasks();
    } catch (err) {
      console.error('Error asignando tarea:', err);
    }
  }

  async function handleAddComment() {
    if (!selectedTask || !comment.trim()) return;
    try {
      await addTaskComment(selectedTask.id, comment);
      setComment('');
      await loadTaskDetails(selectedTask.id);
    } catch (err) {
      console.error('Error agregando comentario:', err);
    }
  }

  async function loadTaskDetails(taskId: string) {
    try {
      const task = await getTask(taskId);
      setSelectedTask(task);
      // Actualizar en la lista también
      setTasks((prev) => prev.map((t) => (t.id === taskId ? task : t)));
    } catch (err) {
      console.error('Error cargando detalles:', err);
    }
  }

  function formatHours(hours?: number): string {
    if (!hours || hours === 0) return '0h';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${hours.toFixed(1)}h`;
  }

  const columns = [
    { status: 'BACKLOG' as const, title: 'Backlog', color: 'bg-gray-100' },
    { status: 'TODO' as const, title: 'Por Hacer', color: 'bg-blue-100' },
    { status: 'IN_PROGRESS' as const, title: 'En Progreso', color: 'bg-yellow-100' },
    { status: 'REVIEW' as const, title: 'Revisión', color: 'bg-purple-100' },
    { status: 'DONE' as const, title: 'Completado', color: 'bg-green-100' },
  ];

  return (
    <>
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

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className={`${col.color} rounded-lg p-4 min-w-[200px]`}>
                <h3 className="font-semibold mb-4 flex items-center justify-between">
                  <span>{col.title}</span>
                  <span className="text-sm bg-white px-2 py-1 rounded">{colTasks.length}</span>
                </h3>
                <div className="space-y-3">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => loadTaskDetails(task.id)}
                      className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500 cursor-pointer hover:shadow-md transition"
                    >
                      <div className="font-medium mb-2">{task.title}</div>
                      {task.assignedUser && (
                        <div className="text-xs text-gray-600 mb-1">
                          👤 {task.assignedUser.name}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Tiempo: {formatHours(task.totalHours)}</span>
                        {task.estimatedHours && (
                          <span className="text-gray-500">/{formatHours(task.estimatedHours)}</span>
                        )}
                      </div>
                      {task.commentsCount && task.commentsCount > 0 && (
                        <div className="text-xs text-blue-600">💬 {task.commentsCount}</div>
                      )}
                      {!task.assignedTo && col.status === 'BACKLOG' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAssignTask(task.id);
                          }}
                          className="mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                        >
                          Tomar tarea
                        </button>
                      )}
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="text-center text-gray-500 text-sm py-8">No hay tareas</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold">{selectedTask.title}</h3>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {selectedTask.description && (
              <p className="text-gray-700 mb-4">{selectedTask.description}</p>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <strong>Estado:</strong> {selectedTask.status}
              </div>
              {selectedTask.assignedUser && (
                <div>
                  <strong>Asignado a:</strong> {selectedTask.assignedUser.name}
                </div>
              )}
              <div>
                <strong>Tiempo acumulado:</strong> {formatHours(selectedTask.totalHours)}
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Comentarios</h4>
              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {selectedTask.comments && selectedTask.comments.length > 0 ? (
                  selectedTask.comments.map((comment: TaskComment) => (
                    <div key={comment.id} className="bg-gray-50 p-3 rounded">
                      <div className="font-medium text-sm mb-1">{comment.user?.name}</div>
                      <div className="text-sm text-gray-700">{comment.content}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(comment.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 text-sm">No hay comentarios</div>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Agregar comentario..."
                  className="flex-1 p-2 border rounded-lg"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                />
                <button
                  onClick={handleAddComment}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Comentar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
