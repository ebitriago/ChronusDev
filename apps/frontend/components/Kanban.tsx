'use client';

import { useEffect, useState, useCallback } from 'react';
import { getTasks, createTask, assignTask, getTask, addTaskComment, updateTask, getUsers, assignProjectMember, type Task, type Project, type TaskComment, type TaskStatus, type User, type ProjectMember, API_URL } from '../app/api';
import { io } from 'socket.io-client';
import { Skeleton } from './Skeleton';
import { useToast } from './Toast';

type KanbanProps = {
  project: Project;
  allProjects?: Project[];
  onSwitchProject?: (project: Project) => void;
};

const COLUMNS = [
  { status: 'BACKLOG' as const, title: 'Backlog', icon: '📋', bg: 'from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700', border: 'border-slate-200 dark:border-slate-600' },
  { status: 'TODO' as const, title: 'Por Hacer', icon: '📝', bg: 'from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30', border: 'border-blue-200 dark:border-blue-700' },
  { status: 'IN_PROGRESS' as const, title: 'En Progreso', icon: '🔄', bg: 'from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30', border: 'border-amber-200 dark:border-amber-700' },
  { status: 'REVIEW' as const, title: 'Revisión', icon: '👁️', bg: 'from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30', border: 'border-purple-200 dark:border-purple-700' },
  { status: 'DONE' as const, title: 'Completado', icon: '✅', bg: 'from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30', border: 'border-emerald-200 dark:border-emerald-700' },
];

const PRIORITY_STYLES = {
  LOW: { bg: 'bg-gray-100 dark:bg-slate-700', text: 'text-gray-600 dark:text-gray-300', label: 'Baja' },
  MEDIUM: { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-700 dark:text-blue-300', label: 'Media' },
  HIGH: { bg: 'bg-orange-100 dark:bg-orange-900/50', text: 'text-orange-700 dark:text-orange-300', label: 'Alta' },
  URGENT: { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-700 dark:text-red-300', label: 'Urgente' },
};

export default function Kanban({ project, allProjects, onSwitchProject }: KanbanProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showNewTask, setShowNewTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [uploading, setUploading] = useState(false);

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

      if (selectedTask) {
        const updatedTask = { ...selectedTask, status: newStatus };
        setSelectedTask(updatedTask);
      }
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

      showToast('Estado actualizado', 'success');
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
  }

  function handleDragOver(e: React.DragEvent, status: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedOverColumn !== status) {
      setDraggedOverColumn(status);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    const target = e.currentTarget;
    const relatedTarget = e.relatedTarget as Node;
    if (!target.contains(relatedTarget)) {
      setDraggedOverColumn(null);
    }
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

  const loadTasks = useCallback(async () => {
    try {
      const ts = await getTasks(project.id);
      setTasks(Array.isArray(ts) ? ts : []);
      setError(null);
    } catch (err: any) {
      console.error('Error cargando tareas:', err);
      setError(err.message || 'No se pudieron cargar las tareas');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    loadTasks();

    // Real-time updates
    const socket = io({
      path: '/api/socket.io',
      auth: { token: localStorage.getItem('authToken') }
    });

    socket.on('notification', (data: any) => {
      if (data.type === 'TASK') {
        loadTasks();
        if (selectedTask && data.data?.taskId === selectedTask.id) {
          loadTaskDetails(selectedTask.id);
        }
      }
    });

    return () => { socket.disconnect(); };
  }, [loadTasks, selectedTask]);

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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length || !selectedTask) return;
    const file = e.target.files[0];
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) throw new Error('Error subiendo archivo');
      const uploadData = await uploadRes.json();

      const token = localStorage.getItem('authToken');
      await fetch(`/api/tasks/${selectedTask.id}/attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          url: uploadData.url,
          name: file.name,
          type: file.type,
          size: file.size
        })
      });

      showToast('Archivo adjuntado', 'success');
      await loadTaskDetails(selectedTask.id);
    } catch (err: any) {
      console.error(err);
      showToast('Error al subir archivo', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
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
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Algo salió mal</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
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
                {/* Project Switcher */}
                {allProjects && onSwitchProject && allProjects.length > 1 ? (
                  <div className="relative group/proj">
                    <button className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white focus:outline-none">
                      {localProject.name}
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div className="absolute left-0 top-full pt-2 w-64 hidden group-hover/proj:block z-50 animate-fadeIn">
                      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
                        <div className="p-1 max-h-64 overflow-y-auto custom-scrollbar">
                          {allProjects.map(p => (
                            <button
                              key={p.id}
                              onClick={() => onSwitchProject(p)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between ${p.id === localProject.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                              {p.name}
                              {p.id === localProject.id && <span className="text-blue-600">✓</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{localProject.name}</h2>
                    <button
                      onClick={() => window.location.href = `/projects/${localProject.id}`}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Configuración y Tarifas"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{tasks.length} tareas</span>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {localProject.members?.map(m => (
                        <div key={m.id} className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-600 border-2 border-white dark:border-slate-800 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-white" title={m.user?.name || 'User'}>
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
          <div className="mb-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700 p-5 animate-slideUp">
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
              className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl mb-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
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
                className="px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-all text-gray-600 dark:text-gray-300"
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
                className={`flex-shrink-0 w-80 bg-gray-50/50 dark:bg-slate-800/50 rounded-2xl p-4 border transition-colors ${isDragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent'
                  }`}
                onDragOver={(e) => handleDragOver(e, col.status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.status)}
              >
                <div className={`flex items-center justify-between mb-4 p-3 rounded-xl bg-gradient-to-br ${col.bg} border ${col.border}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{col.icon}</span>
                    <h3 className="font-bold text-gray-700 dark:text-gray-200">{col.title}</h3>
                  </div>
                  <span className="bg-white/50 px-2 py-1 rounded-lg text-xs font-bold text-gray-600">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-3 min-h-[500px]">
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => handleTaskClick(task)}
                      className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all group active:cursor-grabbing"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider ${PRIORITY_STYLES[task.priority].bg} ${PRIORITY_STYLES[task.priority].text}`}>
                          {PRIORITY_STYLES[task.priority].label}
                        </span>
                        {task.assignedUser && (
                          <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-600 border border-white shadow-sm" title={task.assignedUser.name}>
                            {task.assignedUser.name.charAt(0)}
                          </div>
                        )}
                        {task.activeWorkers && task.activeWorkers.length > 0 && (
                          <div className="flex -space-x-1 ml-2">
                            {task.activeWorkers.map((w) => (
                              <div
                                key={w.id}
                                className="w-6 h-6 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center text-[10px] font-bold text-green-700 dark:text-green-300 border border-white dark:border-slate-800 shadow-sm ring-2 ring-green-400 animate-pulse"
                                title={`Trabajando ahora: ${w.name}`}
                              >
                                {w.name.charAt(0)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {task.title}
                      </h4>

                      {task.attachments && task.attachments.filter(a => a.type?.startsWith('image/')).length > 0 && (
                        <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg overflow-hidden mt-2">
                          {task.attachments
                            .filter(a => a.type?.startsWith('image/'))
                            .slice(0, 3)
                            .map((att, idx) => (
                              <div key={att.id} className="relative aspect-square">
                                <img
                                  src={att.url}
                                  alt={att.name}
                                  className="w-full h-full object-cover"
                                />
                                {idx === 2 && task.attachments!.filter(a => a.type?.startsWith('image/')).length > 3 && (
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <span className="text-white font-bold text-xs">
                                      +{task.attachments!.filter(a => a.type?.startsWith('image/')).length - 3}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))
                          }
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mt-3 pt-3 border-t border-gray-50 dark:border-slate-700">
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

                      {!task.assignedTo && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAssignTask(task.id);
                          }}
                          className="w-full mt-3 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all font-medium flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                          </svg>
                          Tomar tarea
                        </button>
                      )}
                    </div>
                  ))}

                  {colTasks.length === 0 && (
                    <div className="text-center py-8 px-4 border-2 border-dashed border-gray-200 rounded-xl">
                      <div className="text-3xl mb-2 opacity-30 grayscale">{col.icon}</div>
                      <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">Soltar aquí</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div >

      {/* Task detail modal */}
      {selectedTask && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${PRIORITY_STYLES[selectedTask.priority].bg} ${PRIORITY_STYLES[selectedTask.priority].text}`}>
                      {PRIORITY_STYLES[selectedTask.priority].label}
                    </span>
                    <div className="relative">
                      <select
                        value={selectedTask.status}
                        onChange={(e) => handleUpdateStatus(selectedTask.id, e.target.value as TaskStatus)}
                        disabled={updatingStatus}
                        className="text-xs appearance-none bg-gray-100 dark:bg-slate-700 pl-2.5 pr-8 py-1 rounded-lg font-medium text-gray-700 dark:text-gray-200 border-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
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
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedTask.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
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
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Descripción</h4>
                  <p className="text-gray-700 dark:text-gray-300">{selectedTask.description}</p>
                </div>
              )}

              <div className="mb-6 bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Asignado a</div>
                    {selectedTask.assignedUser ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                          {selectedTask.assignedUser.name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{selectedTask.assignedUser.name}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">Sin asignar</span>
                    )}
                  </div>
                  <select
                    value={typeof selectedTask.assignedTo === 'string' ? selectedTask.assignedTo : (selectedTask.assignedTo?.id || '')}
                    onChange={async (e) => {
                      const newAssignee = e.target.value || undefined;
                      try {
                        await updateTask(selectedTask.id, { assignedToId: newAssignee });
                        showToast('Asignación actualizada', 'success');
                        await loadTaskDetails(selectedTask.id);
                        await loadTasks();
                      } catch (err: any) {
                        showToast(err.message || 'Error al asignar', 'error');
                      }
                    }}
                    className="text-sm appearance-none bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 pl-3 pr-8 py-2 rounded-xl font-medium text-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:border-blue-500 transition-colors"
                  >
                    <option value="">Sin asignar</option>
                    {localProject.members?.map(m => (
                      <option key={m.userId} value={m.userId}>{m.user?.name || 'Usuario'}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tiempo registrado</div>
                  <span className="font-medium text-gray-900 dark:text-white">{formatHours(selectedTask.totalHours)}</span>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">ID Tarea</div>
                  <span className="font-mono text-sm text-gray-600 dark:text-gray-300">#{selectedTask.id.slice(0, 8)}</span>
                </div>
              </div>

              {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                <div className="border-t border-gray-100 dark:border-slate-700 pt-6 mb-6">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    Adjuntos ({selectedTask.attachments.length})
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedTask.attachments.map(att => (
                      <a
                        key={att.id}
                        href={att.url.startsWith('http') ? att.url : `${API_URL}/${att.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden hover:shadow-md transition-all block"
                      >
                        {att.type.startsWith('image/') ? (
                          <div className="aspect-video bg-gray-100 dark:bg-slate-700 relative">
                            <img src={att.url.startsWith('http') ? att.url : `${API_URL}/${att.url}`} alt={att.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                          </div>
                        ) : (
                          <div className="aspect-video bg-gray-50 dark:bg-slate-800 flex flex-col items-center justify-center p-4">
                            <span className="text-3xl mb-2">📄</span>
                          </div>
                        )}
                        <div className="p-2 bg-white dark:bg-slate-800">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{att.name}</p>
                          <p className="text-[10px] text-gray-400">{(att.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 dark:border-slate-700 pt-6">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Comentarios
                </h4>

                <div className="space-y-3 mb-4 max-h-48 overflow-y-auto custom-scrollbar">
                  {selectedTask.comments && selectedTask.comments.length > 0 ? (
                    selectedTask.comments.map((c: TaskComment) => (
                      <div key={c.id} className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center text-white text-xs font-medium">
                            {c.user?.name?.charAt(0) || '?'}
                          </div>
                          <span className="font-medium text-sm text-gray-900">{c.user?.name}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
                          {c.content.split(/(@\w+)/g).map((part, i) =>
                            part.match(/^@\w+$/) ? (
                              <span key={i} className="text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 px-1 rounded">
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

                <div className="flex gap-3 items-end">
                  <div className="flex-1 relative">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Escribe un comentario..."
                      className="w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 resize-none min-h-[50px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment();
                        }
                      }}
                    />
                    <div className="absolute right-2 bottom-2 flex gap-2">
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                      <label
                        htmlFor="file-upload"
                        className={`p-2 rounded-lg hover:bg-gray-200 cursor-pointer text-gray-400 hover:text-gray-600 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Adjuntar archivo"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      </label>
                    </div>
                  </div>
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
                      .filter(u => !localProject.members?.some(m => m.userId === u.id))
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
