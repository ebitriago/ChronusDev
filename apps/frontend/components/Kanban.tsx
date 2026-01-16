'use client';

import { useEffect, useState } from 'react';
import { getTasks, createTask, assignTask, getTask, addTaskComment, updateTask, getUsers, assignProjectMember, type Task, type Project, type TaskComment, type TaskStatus, type User, type ProjectMember } from '../app/api';
import { Skeleton } from './Skeleton';
import { useToast } from './Toast';

type KanbanProps = {
  project: Project;
};

const COLUMNS = [
  { status: 'BACKLOG' as const, title: 'Backlog', icon: '📋', bg: 'from-slate-50 to-slate-100', border: 'border-slate-200' },
  { status: 'TODO' as const, title: 'Por Hacer', icon: '📝', bg: 'from-blue-50 to-blue-100', border: 'border-blue-200' },
  { status: 'IN_PROGRESS' as const, title: 'En Progreso', icon: '🔄', bg: 'from-amber-50 to-amber-100', border: 'border-amber-200' },
  { status: 'REVIEW' as const, title: 'Revisión', icon: '👁️', bg: 'from-purple-50 to-purple-100', border: 'border-purple-200' },
  { status: 'DONE' as const, title: 'Completado', icon: '✅', bg: 'from-emerald-50 to-emerald-100', border: 'border-emerald-200' },
];

const PRIORITY_STYLES = {
  LOW: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Baja' },
  MEDIUM: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Media' },
  HIGH: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Alta' },
  URGENT: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgente' },
};

export default function Kanban({ project }: KanbanProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showNewTask, setShowNewTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Member Management
  const [localProject, setLocalProject] = useState<Project>(project);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [inviteUserId, setInviteUserId] = useState('');

  useEffect(() => {
    setLocalProject(project);
  }, [project]);

  async function handleLoadUsers() {
    try {
      const users = await getUsers();
      setAvailableUsers(users);
      setShowInviteModal(true);
    } catch (e) {
      console.error(e);
      showToast('Error cargando usuarios', 'error');
    }
  }

  async function handleInviteMember() {
    if (!inviteUserId) return;
    try {
      const newItem = await assignProjectMember(project.id, {
        userId: inviteUserId,
        payRate: 20,
        billRate: 50,
        role: 'DEV'
      });

      // Manually update local state with new member (mocking the full object return if needed, or just fetching it?)
      // API returns the membership object.
      // We need to add it to localProject.members. But membership object doesn't have `user` details populated usually unless getProject is called.
      // I will cheat for UI update: find user in availableUsers and construct the object.

      const user = availableUsers.find(u => u.id === inviteUserId);
      if (user) {
        const newMember: ProjectMember = { ...newItem, user };
        setLocalProject(prev => ({
          ...prev,
          members: [...(prev.members || []), newMember]
        }));
      }

      showToast('Miembro agregado', 'success');
      setShowInviteModal(false);
      setInviteUserId('');
    } catch (e: any) {
      showToast(e.message || 'Error invitando miembro', 'error');
    }
  }

  async function handleUpdateStatus(taskId: string, newStatus: TaskStatus) {
    setUpdatingStatus(true);
    try {
      await updateTask(taskId, { status: newStatus });

      // Update local state immediately for responsiveness
      if (selectedTask) {
        const updatedTask = { ...selectedTask, status: newStatus };
        setSelectedTask(updatedTask);
      }
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

      showToast('Estado actualizado', 'success');
      // Refresh to get any side effects from backend
      await loadTaskDetails(taskId);
    } catch (err) {
      console.error('Error updating status:', err);
      showToast('Error al actualizar estado', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  }

  // --- DRAG AND DROP HANDLERS ---
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
    // Optional: Add a drag image or style
  }

  function handleDragOver(e: React.DragEvent, status: string) {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
    if (draggedOverColumn !== status) {
      setDraggedOverColumn(status);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    // Prevent flickering by only clearing if leaving the main drop target? 
    // Simple implementation: clear on drop. DragLeave is tricky with child elements.
  }

  async function handleDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    setDraggedOverColumn(null);
    const taskId = e.dataTransfer.getData('taskId');

    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== status) {
      await handleUpdateStatus(taskId, status);
    }
  }

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 30000); // Reducido de 5s a 30s
    return () => clearInterval(interval);
  }, [project.id]);

  async function loadTasks() {
    try {
      const ts = await getTasks(project.id);
      setTasks(ts);
      setError(null);
    } catch (err: any) {
      console.error('Error cargando tareas:', err);
      setError(err.message || 'No se pudieron cargar las tareas');
    } finally {
      setLoading(false);
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
      showToast('Tarea creada con éxito', 'success');
      await loadTasks();
    } catch (err) {
      console.error('Error creando tarea:', err);
      showToast('Error al crear tarea', 'error');
    }
  }

  async function handleAssignTask(taskId: string) {
    try {
      await assignTask(taskId);
      showToast('Tarea asignada', 'success');
      await loadTasks();
    } catch (err) {
      console.error('Error asignando tarea:', err);
      showToast('Error al asignar tarea', 'error');
    }
  }

  async function handleAddComment() {
    if (!selectedTask || !comment.trim()) return;
    try {
      await addTaskComment(selectedTask.id, comment);
      setComment('');
      showToast('Comentario agregado', 'success');
      await loadTaskDetails(selectedTask.id);
    } catch (err) {
      console.error('Error agregando comentario:', err);
      showToast('Error al agregar comentario', 'error');
    }
  }

  async function loadTaskDetails(taskId: string) {
    try {
      const task = await getTask(taskId);
      setSelectedTask(task);
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

  async function handleTaskClick(task: Task) {
    setSelectedTask(task);
    await loadTaskDetails(task.id);
  }

  if (error) {
    return (
      <div className="p-6 h-[60vh] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Algo salió mal</h3>
        <p className="text-gray-500 mb-4">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            loadTasks();
          }}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
        >
          🔄 Reintentar
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Skeleton variant="rect" width={40} height={40} className="rounded-xl" />
            <div className="space-y-1">
              <Skeleton variant="text" width={150} height={28} />
              <Skeleton variant="text" width={100} height={16} />
            </div>
          </div>
          <Skeleton variant="rect" width={140} height={44} className="rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 h-[60vh] flex flex-col gap-4">
              <div className="flex justify-between items-center mb-2">
                <Skeleton variant="text" width="60%" height={24} />
                <Skeleton variant="rect" width={30} height={24} />
              </div>
              {[1, 2, 3].map(j => (
                <div key={j} className="bg-white rounded-xl p-4 border border-gray-100 space-y-3">
                  <Skeleton variant="text" width="90%" height={18} />
                  <div className="flex justify-between items-center">
                    <Skeleton variant="circle" width={24} height={24} />
                    <Skeleton variant="text" width="30%" height={14} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 max-w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                {localProject.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{localProject.name}</h2>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">{tasks.length} tareas</span>

                  {/* Members list */}
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {localProject.members?.map(m => (
                        <div key={m.id} className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-600" title={m.user?.name || 'User'}>
                          {m.user?.name?.charAt(0) || '?'}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleLoadUsers}
                      className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md text-xs font-bold transition-colors"
                    >
                      + Invitar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowNewTask(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-2.5 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Tarea
          </button>
        </div>

        {/* New task form */}
        {showNewTask && (
          <div className="mb-6 bg-white rounded-2xl shadow-lg border border-gray-100 p-5 animate-slideUp">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900">Nueva tarea</h3>
            </div>
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="¿Qué necesitas hacer?"
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl mb-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleCreateTask}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2.5 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all"
              >
                Crear tarea
              </button>
              <button
                onClick={() => {
                  setShowNewTask(false);
                  setNewTaskTitle('');
                }}
                className="px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Kanban board */}
        <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide">
          {COLUMNS.map(col => {
            const colTasks = tasks.filter(t => t.status === col.status);
            const isDragOver = draggedOverColumn === col.status;

            return (
              <div
                key={col.status}
                className={`flex-shrink-0 w-80 bg-gray-50/50 rounded-2xl p-4 border transition-colors ${isDragOver ? 'border-blue-400 bg-blue-50' : 'border-transparent'
                  }`}
                onDragOver={(e) => handleDragOver(e, col.status)}
                onDrop={(e) => handleDrop(e, col.status)}
              >
                {/* Column Header */}
                <div className={`flex items-center justify-between mb-4 p-3 rounded-xl bg-gradient-to-br ${col.bg} border ${col.border}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{col.icon}</span>
                    <h3 className="font-bold text-gray-700">{col.title}</h3>
                  </div>
                  <span className="bg-white/50 px-2 py-1 rounded-lg text-xs font-bold text-gray-600">
                    {colTasks.length}
                  </span>
                </div>

                {/* Tasks Stack */}
                <div className="space-y-3 min-h-[500px]">
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => handleTaskClick(task)}
                      className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all group active:cursor-grabbing"
                    >
                      {/* Priority Badge */}
                      <div className="flex justify-between items-start mb-3">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider ${PRIORITY_STYLES[task.priority].bg} ${PRIORITY_STYLES[task.priority].text}`}>
                          {PRIORITY_STYLES[task.priority].label}
                        </span>
                        {task.assignedUser && (
                          <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-600 border border-white shadow-sm" title={task.assignedUser.name}>
                            {task.assignedUser.name.charAt(0)}
                          </div>
                        )}
                      </div>

                      <h4 className="font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {task.title}
                      </h4>

                      <div className="flex items-center justify-between text-xs text-gray-400 mt-3 pt-3 border-t border-gray-50">
                        <div className="flex items-center gap-1">
                          <span>#{task.id.slice(0, 4)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {task.commentsCount && task.commentsCount > 0 ? (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                              </svg>
                              {task.commentsCount}
                            </span>
                          ) : null}
                          {task.totalHours ? (
                            <span className="font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              {formatHours(task.totalHours)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Take task button */}
                      {!task.assignedTo && col.status === 'BACKLOG' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAssignTask(task.id);
                          }}
                          className="w-full mt-3 text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-100 transition-all font-medium flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                          </svg>
                          Tomar tarea
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Empty state */}
                  {colTasks.length === 0 && (
                    <div className="text-center py-8 px-4 border-2 border-dashed border-gray-200 rounded-xl">
                      <div className="text-3xl mb-2 opacity-30 grayscale">{col.icon}</div>
                      <p className="text-gray-400 text-sm font-medium">Soltar aquí</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task detail modal */}
      {
        selectedTask && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
            onClick={() => setSelectedTask(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${PRIORITY_STYLES[selectedTask.priority].bg} ${PRIORITY_STYLES[selectedTask.priority].text}`}>
                        {PRIORITY_STYLES[selectedTask.priority].label}
                      </span>
                      {/* Status Selector */}
                      <div className="relative">
                        <select
                          value={selectedTask.status}
                          onChange={(e) => handleUpdateStatus(selectedTask.id, e.target.value as TaskStatus)}
                          disabled={updatingStatus}
                          className="text-xs appearance-none bg-gray-100 pl-2.5 pr-8 py-1 rounded-lg font-medium text-gray-700 border-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:bg-gray-200 transition-colors"
                        >
                          {COLUMNS.map(col => (
                            <option key={col.status} value={col.status}>{col.title}</option>
                          ))}
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedTask.title}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedTask(null)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                {selectedTask.description && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Descripción</h4>
                    <p className="text-gray-700">{selectedTask.description}</p>
                  </div>
                )}

                {/* Assignment Selector */}
                <div className="mb-6 bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Asignado a</div>
                      {selectedTask.assignedUser ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                            {selectedTask.assignedUser.name.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">{selectedTask.assignedUser.name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Sin asignar</span>
                      )}
                    </div>
                    {/* Assignment Dropdown */}
                    <select
                      value={selectedTask.assignedTo || ''}
                      onChange={async (e) => {
                        const newAssignee = e.target.value || undefined;
                        try {
                          await updateTask(selectedTask.id, { assignedTo: newAssignee });
                          showToast('Asignación actualizada', 'success');
                          await loadTaskDetails(selectedTask.id);
                          await loadTasks();
                        } catch (err: any) {
                          showToast(err.message || 'Error al asignar', 'error');
                        }
                      }}
                      className="text-sm appearance-none bg-white border border-gray-200 pl-3 pr-8 py-2 rounded-xl font-medium text-gray-700 focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:border-blue-500 transition-colors"
                    >
                      <option value="">Sin asignar</option>
                      {localProject.members?.map(m => (
                        <option key={m.userId} value={m.userId}>{m.user?.name || 'Usuario'}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">Tiempo registrado</div>
                    <span className="font-medium text-gray-900">{formatHours(selectedTask.totalHours)}</span>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">ID Tarea</div>
                    <span className="font-mono text-sm text-gray-600">#{selectedTask.id.slice(0, 8)}</span>
                  </div>
                </div>

                {/* Comments */}
                <div className="border-t border-gray-100 pt-6">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Comentarios
                  </h4>

                  <div className="space-y-3 mb-4 max-h-48 overflow-y-auto custom-scrollbar">
                    {selectedTask.comments && selectedTask.comments.length > 0 ? (
                      selectedTask.comments.map((c: TaskComment) => (
                        <div key={c.id} className="bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center text-white text-xs font-medium">
                              {c.user?.name?.charAt(0) || '?'}
                            </div>
                            <span className="font-medium text-sm text-gray-900">{c.user?.name}</span>
                            <span className="text-xs text-gray-400">
                              {new Date(c.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-gray-700 text-sm whitespace-pre-wrap">
                            {c.content.split(/(@\w+)/g).map((part, i) =>
                              part.match(/^@\w+$/) ? (
                                <span key={i} className="text-blue-600 font-bold bg-blue-50 px-1 rounded">
                                  {part}
                                </span>
                              ) : (
                                part
                              )
                            )}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-gray-400 text-sm">
                        No hay comentarios aún
                      </div>
                    )}
                  </div>

                  {/* Add comment form */}
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Escribe un comentario..."
                      className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                    />
                    <button
                      onClick={handleAddComment}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all"
                    >
                      Enviar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div >
        )
      }
      {/* Invite Member Modal */}
      {
        showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-900">Invitar al Proyecto</h3>
                <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="p-4">
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Seleccionar Usuario</label>
                  <select
                    value={inviteUserId}
                    onChange={(e) => setInviteUserId(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar...</option>
                    {availableUsers
                      .filter(u => !localProject.members?.some(m => m.userId === u.id)) // Filter already assigned
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                  </select>
                </div>
                <button
                  onClick={handleInviteMember}
                  disabled={!inviteUserId}
                  className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                  Agregar Miembro
                </button>
              </div>
            </div>
          </div>
        )
      }
    </>
  );
}
