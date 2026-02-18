'use client';

import { useEffect, useState, useMemo } from 'react';
import { getTasks, getProjects, getUsers, updateTask, type Task, type Project, type User, type TaskStatus } from '../app/api';
import { useToast } from './Toast';
import { Skeleton } from './Skeleton';
import { io, Socket } from 'socket.io-client';
import TaskDetailModal from './TaskDetailModal';

type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

const COLUMNS: { status: TaskStatus; title: string; icon: string; bg: string; border: string }[] = [
    { status: 'BACKLOG', title: 'Backlog', icon: '📋', bg: 'from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900', border: 'border-slate-200 dark:border-slate-700' },
    { status: 'TODO', title: 'Por Hacer', icon: '📝', bg: 'from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20', border: 'border-yellow-200 dark:border-yellow-800' },
    { status: 'IN_PROGRESS', title: 'En Progreso', icon: '🔨', bg: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20', border: 'border-blue-200 dark:border-blue-800' },
    { status: 'REVIEW', title: 'En Review', icon: '👀', bg: 'from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20', border: 'border-purple-200 dark:border-purple-800' },
    { status: 'DONE', title: 'Completado', icon: '✅', bg: 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20', border: 'border-green-200 dark:border-green-800' },
];

const PRIORITY_STYLES: Record<TaskPriority, { color: string; icon: string }> = {
    LOW: { color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: '🔵' },
    MEDIUM: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: '🟡' },
    HIGH: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', icon: '🟠' },
    URGENT: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: '🔴' },
};

type MasterKanbanProps = {
    onTaskClick?: (task: Task) => void;
};

export default function MasterKanban({ onTaskClick }: MasterKanbanProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [projectFilter, setProjectFilter] = useState<string>('ALL');
    const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');

    // Drag state
    const [draggedTask, setDraggedTask] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    useEffect(() => {
        loadData();

        // Setup Socket.IO for real-time updates
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
        const newSocket = io(apiUrl, {
            withCredentials: true,
            transports: ['websocket', 'polling']
        });

        newSocket.on('task:created', (task: Task) => {
            setTasks(prev => [task, ...prev]);
        });

        newSocket.on('task:updated', (updatedTask: Task) => {
            setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
        });

        newSocket.on('task:deleted', (taskId: string) => {
            setTasks(prev => prev.filter(t => t.id !== taskId));
        });

        return () => {
            newSocket.close();
        };
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            const [tasksData, projectsData, usersData] = await Promise.all([
                getTasks(),
                getProjects(),
                getUsers()
            ]);
            setTasks(tasksData);
            setProjects(projectsData);
            setUsers(usersData);
        } catch (error) {
            console.error('Error loading data:', error);
            showToast('Error al cargar datos', 'error');
        } finally {
            setLoading(false);
        }
    }

    // Filter tasks
    const filteredTasks = useMemo(() => {
        let result = [...tasks];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(t =>
                t.title.toLowerCase().includes(query) ||
                t.description?.toLowerCase().includes(query)
            );
        }

        if (projectFilter !== 'ALL') {
            result = result.filter(t => t.projectId === projectFilter);
        }

        if (assigneeFilter !== 'ALL') {
            if (assigneeFilter === 'UNASSIGNED') {
                result = result.filter(t => !t.assignedToId);
            } else {
                result = result.filter(t => t.assignedToId === assigneeFilter);
            }
        }

        return result;
    }, [tasks, searchQuery, projectFilter, assigneeFilter]);

    // Group tasks by status
    const tasksByStatus = useMemo(() => {
        const grouped: Record<TaskStatus, Task[]> = {
            BACKLOG: [],
            TODO: [],
            IN_PROGRESS: [],
            REVIEW: [],
            DONE: [],
        };

        filteredTasks.forEach(task => {
            if (grouped[task.status]) {
                grouped[task.status].push(task);
            }
        });

        return grouped;
    }, [filteredTasks]);

    // Status change via drag & drop
    async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
        try {
            // Optimistic update
            setTasks(prev => prev.map(t =>
                t.id === taskId ? { ...t, status: newStatus } : t
            ));

            await updateTask(taskId, { status: newStatus });
            showToast('Estado actualizado', 'success');
        } catch (error) {
            // Revert on error
            loadData();
            showToast('Error al actualizar estado', 'error');
        }
    }

    // Drag handlers
    function handleDragStart(e: React.DragEvent, taskId: string) {
        setDraggedTask(taskId);
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragOver(e: React.DragEvent, status: TaskStatus) {
        e.preventDefault();
        setDragOverColumn(status);
    }

    function handleDragLeave() {
        setDragOverColumn(null);
    }

    function handleDrop(e: React.DragEvent, status: TaskStatus) {
        e.preventDefault();
        if (draggedTask) {
            const task = tasks.find(t => t.id === draggedTask);
            if (task && task.status !== status) {
                handleStatusChange(draggedTask, status);
            }
        }
        setDraggedTask(null);
        setDragOverColumn(null);
    }

    function getProjectName(projectId: string) {
        return projects.find(p => p.id === projectId)?.name || 'Sin proyecto';
    }

    function getAssigneeName(userId?: string) {
        if (!userId) return null;
        return users.find(u => u.id === userId)?.name || 'Desconocido';
    }

    function clearFilters() {
        setSearchQuery('');
        setProjectFilter('ALL');
        setAssigneeFilter('ALL');
    }

    const hasActiveFilters = searchQuery || projectFilter !== 'ALL' || assigneeFilter !== 'ALL';

    // Stats
    const stats = useMemo(() => ({
        total: tasks.length,
        backlog: tasks.filter(t => t.status === 'BACKLOG').length,
        todo: tasks.filter(t => t.status === 'TODO').length,
        inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
        review: tasks.filter(t => t.status === 'REVIEW').length,
        done: tasks.filter(t => t.status === 'DONE').length,
    }), [tasks]);

    if (loading) {
        return (
            <div className="p-6 max-w-full mx-auto space-y-4">
                <Skeleton height="60px" width="300px" />
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex-shrink-0 w-72">
                            <Skeleton height="400px" variant="rect" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-full mx-auto animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        🎯 Master Kanban
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        Vista global de {filteredTasks.length} tickets de {projects.length} proyectos
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="text"
                        placeholder="🔍 Buscar..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-40 md:w-48 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                    />

                    <select
                        value={projectFilter}
                        onChange={e => setProjectFilter(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                    >
                        <option value="ALL">Todos los proyectos</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>

                    <select
                        value={assigneeFilter}
                        onChange={e => setAssigneeFilter(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                    >
                        <option value="ALL">Todos</option>
                        <option value="UNASSIGNED">Sin asignar</option>
                        {users.filter(u => u.role === 'DEV').map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>

                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="px-3 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
                        >
                            ✕
                        </button>
                    )}

                    <button
                        onClick={loadData}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors text-sm font-medium"
                    >
                        🔄
                    </button>
                </div>
            </div>

            {/* Kanban Columns */}
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4" style={{ minHeight: '70vh' }}>
                {COLUMNS.map(column => {
                    const columnTasks = tasksByStatus[column.status] || [];
                    const isOver = dragOverColumn === column.status;

                    return (
                        <div
                            key={column.status}
                            className={`flex-shrink-0 w-72 md:w-80 flex flex-col rounded-2xl bg-gradient-to-b ${column.bg} border ${column.border} ${isOver ? 'ring-2 ring-purple-500 ring-offset-2' : ''} transition-all`}
                            onDragOver={(e) => handleDragOver(e, column.status)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, column.status)}
                        >
                            {/* Column Header */}
                            <div className="p-4 border-b border-gray-200/50 dark:border-slate-700/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{column.icon}</span>
                                        <h3 className="font-semibold text-gray-800 dark:text-white">{column.title}</h3>
                                    </div>
                                    <span className="bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300 shadow-sm">
                                        {columnTasks.length}
                                    </span>
                                </div>
                            </div>

                            {/* Column Tasks */}
                            <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(70vh-80px)]">
                                {columnTasks.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                                        Sin tickets
                                    </div>
                                ) : (
                                    columnTasks.map(task => {
                                        const priority = PRIORITY_STYLES[task.priority];
                                        const assignee = getAssigneeName(task.assignedToId);
                                        const isDragging = draggedTask === task.id;

                                        return (
                                            <div
                                                key={task.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, task.id)}
                                                onClick={() => {
                                                    setSelectedTaskId(task.id);
                                                    // onTaskClick?.(task); 
                                                }}
                                                className={`
                                                    bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700
                                                    hover:shadow-md hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing
                                                    ${isDragging ? 'opacity-50 scale-95' : ''}
                                                `}
                                            >
                                                {/* Project Badge */}
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-medium truncate max-w-[150px]">
                                                        {getProjectName(task.projectId)}
                                                    </span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${priority.color} font-medium`}>
                                                        {priority.icon}
                                                    </span>
                                                </div>

                                                {/* Title */}
                                                <h4 className="font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
                                                    {task.title}
                                                </h4>

                                                {/* Description preview */}
                                                {task.description && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                                                        {task.description}
                                                    </p>
                                                )}

                                                {/* Footer */}
                                                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-700">
                                                    {assignee ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-5 h-5 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                                                {assignee.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[80px]">
                                                                {assignee}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">Sin asignar</span>
                                                    )}

                                                    {task.dueDate && (
                                                        <span className={`text-xs ${new Date(task.dueDate) < new Date() && task.status !== 'DONE' ? 'text-red-500' : 'text-gray-400'}`}>
                                                            📅 {new Date(task.dueDate).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Meta info */}
                                                {(task.totalHours || task.commentsCount) && (
                                                    <div className="flex gap-3 mt-2 text-xs text-gray-400">
                                                        {task.totalHours && task.totalHours > 0 && (
                                                            <span>⏱️ {task.totalHours.toFixed(1)}h</span>
                                                        )}
                                                        {task.commentsCount && task.commentsCount > 0 && (
                                                            <span>💬 {task.commentsCount}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Stats Footer */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500 justify-center">
                <span className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg shadow-sm">
                    📊 Total: <strong className="text-gray-900 dark:text-white">{stats.total}</strong>
                </span>
                <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg">
                    🔨 En progreso: <strong>{stats.inProgress}</strong>
                </span>
                <span className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-lg">
                    👀 Review: <strong>{stats.review}</strong>
                </span>
                <span className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-3 py-1.5 rounded-lg">
                    ✅ Completados: <strong>{stats.done}</strong>
                </span>
            </div>

            {selectedTaskId && (
                <TaskDetailModal
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                    onUpdate={loadData}
                    members={projects.find(p => p.id === tasks.find(t => t.id === selectedTaskId)?.projectId)?.members || []}
                />
            )
            }
        </div >
    );
}
