'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTask, updateTask, addTaskComment, assignTask, getCurrentUser, type Task, type TaskStatus, type TaskComment, type ProjectMember, API_URL } from '../app/api';
import { useToast } from './Toast';

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

type TaskDetailModalProps = {
    taskId: string;
    onClose: () => void;
    onUpdate?: () => void;
    members?: ProjectMember[];
};

export default function TaskDetailModal({ taskId, onClose, onUpdate, members = [] }: TaskDetailModalProps) {
    const [task, setTask] = useState<Task | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [comment, setComment] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [addingComment, setAddingComment] = useState(false);

    // New fields state
    const [prLink, setPrLink] = useState('');
    const [checklist, setChecklist] = useState<{ text: string; checked: boolean }[]>([]);

    const { showToast } = useToast();

    useEffect(() => {
        loadTaskDetails();
        loadCurrentUser();
    }, [taskId]);

    async function loadCurrentUser() {
        try {
            const user = await getCurrentUser();
            setCurrentUserId(user.id);
        } catch (e) {
            console.error('Error loading current user', e);
        }
    }

    async function loadTaskDetails() {
        try {
            const t = await getTask(taskId);
            setTask(t);
            setPrLink(t.prLink || '');
            setChecklist(t.checklist || []);
        } catch (e) {
            console.error(e);
            showToast('Error cargando tarea', 'error');
        }
    }

    function formatHours(hours?: number): string {
        if (!hours || hours === 0) return '0h';
        if (hours < 1) return `${Math.round(hours * 60)}m`;
        return `${hours.toFixed(1)}h`;
    }

    async function handleUpdateStatus(newStatus: TaskStatus) {
        if (!task) return;
        setUpdatingStatus(true);
        try {
            await updateTask(task.id, { status: newStatus });
            setTask(prev => prev ? { ...prev, status: newStatus } : null);
            showToast('Estado actualizado', 'success');
            onUpdate?.();
        } catch (err) {
            console.error('Error updating status:', err);
            showToast('Error al actualizar estado', 'error');
        } finally {
            setUpdatingStatus(false);
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files?.length || !task) return;
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
            await fetch(`/api/tasks/${task.id}/attachments`, {
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
            await loadTaskDetails();
            onUpdate?.();
        } catch (err: any) {
            console.error(err);
            showToast('Error al subir archivo', 'error');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    }

    async function handleAddComment() {
        if (!task || !comment.trim()) return;
        try {
            setAddingComment(true);
            await addTaskComment(task.id, comment);
            setComment('');
            showToast('Comentario agregado', 'success');
            await loadTaskDetails();
            onUpdate?.();
        } catch (err) {
            console.error('Error agregando comentario:', err);
            showToast('Error al agregar comentario', 'error');
        } finally {
            setAddingComment(false);
        }
    }

    async function handleUpdatePrLink() {
        if (!task || prLink === task.prLink) return;
        try {
            await updateTask(task.id, { prLink });
            showToast('Enlace de PR actualizado', 'success');
            onUpdate?.();
        } catch (err) {
            showToast('Error actualizando PR', 'error');
        }
    }

    async function handleUpdateChecklist(newChecklist: { text: string; checked: boolean }[]) {
        if (!task) return;
        setChecklist(newChecklist); // Optimistic update
        try {
            await updateTask(task.id, { checklist: newChecklist });
            onUpdate?.();
        } catch (err) {
            showToast('Error actualizando checklist', 'error');
        }
    }

    function toggleChecklistItem(index: number) {
        const newChecklist = [...checklist];
        newChecklist[index].checked = !newChecklist[index].checked;
        handleUpdateChecklist(newChecklist);
    }

    function addChecklistItem(text: string) {
        if (!text.trim()) return;
        const newChecklist = [...checklist, { text, checked: false }];
        handleUpdateChecklist(newChecklist);
    }

    function removeChecklistItem(index: number) {
        const newChecklist = [...checklist];
        newChecklist.splice(index, 1);
        handleUpdateChecklist(newChecklist);
    }


    if (!task) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                    className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-4 md:p-6 border-b border-gray-100">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${PRIORITY_STYLES[task.priority].bg} ${PRIORITY_STYLES[task.priority].text}`}>
                                        {PRIORITY_STYLES[task.priority].label}
                                    </span>
                                    <div className="relative">
                                        <select
                                            value={task.status}
                                            onChange={(e) => handleUpdateStatus(e.target.value as TaskStatus)}
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
                                <h3 className="text-xl font-bold text-gray-900">{task.title}</h3>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 flex-shrink-0"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 md:p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                        {task.description && (
                            <div className="mb-6">
                                <h4 className="text-sm font-medium text-gray-500 mb-2">Descripción</h4>
                                <p className="text-gray-700">{task.description}</p>
                            </div>
                        )}

                        {/* PR Link */}
                        <div className="mb-6 bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                            <label className="text-xs font-medium text-blue-700 mb-1.5 flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                                Pull Request / Rama
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={prLink}
                                    onChange={(e) => setPrLink(e.target.value)}
                                    onBlur={handleUpdatePrLink}
                                    placeholder="https://github.com/..."
                                    className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800 placeholder:text-blue-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                />
                                {prLink && (
                                    <a
                                        href={prLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors flex items-center justify-center"
                                        title="Abrir enlace"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Checklist */}
                        <div className="mb-6">
                            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                                <span>☑️</span> Checklist
                                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                    {checklist.filter(i => i.checked).length}/{checklist.length}
                                </span>
                            </h4>
                            <div className="space-y-2 mb-3">
                                {checklist.map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-3 group">
                                        <input
                                            type="checkbox"
                                            checked={item.checked}
                                            onChange={() => toggleChecklistItem(idx)}
                                            className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <span className={`text-sm flex-1 break-words ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                            {item.text}
                                        </span>
                                        <button
                                            onClick={() => removeChecklistItem(idx)}
                                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Agregar item..."
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addChecklistItem(e.currentTarget.value);
                                            e.currentTarget.value = '';
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <div className="mb-6 bg-gray-50 rounded-xl p-4">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs text-gray-500">Asignado a</div>

                                    {(currentUserId && (task.assignedTo?.id !== currentUserId && task.assignedToId !== currentUserId)) && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await updateTask(task.id, { assignedToId: currentUserId });
                                                    showToast('Tarea asignada a ti', 'success');
                                                    await loadTaskDetails();
                                                    onUpdate?.();
                                                } catch (err: any) {
                                                    showToast(err.message || 'Error al asignar', 'error');
                                                }
                                            }}
                                            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-1 shadow-sm shadow-blue-500/20"
                                        >
                                            <span>✋</span> Tomar tarea
                                        </button>
                                    )}
                                    {(!task.assignedTo && !task.assignedUser && !currentUserId) && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await assignTask(task.id);
                                                    showToast('Tarea asignada', 'success');
                                                    await loadTaskDetails();
                                                    onUpdate?.();
                                                } catch (err: any) {
                                                    showToast(err.message || 'Error al asignar', 'error');
                                                }
                                            }}
                                            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-1 shadow-sm shadow-blue-500/20"
                                        >
                                            <span>✋</span> Tomar tarea
                                        </button>
                                    )}
                                </div>

                                <div className="relative">
                                    <select
                                        value={task.assignedTo?.id || task.assignedToId || ''}
                                        onChange={async (e) => {
                                            const newAssignee = e.target.value || undefined;
                                            try {
                                                await updateTask(task.id, { assignedToId: newAssignee });
                                                showToast('Asignación actualizada', 'success');
                                                await loadTaskDetails();
                                                onUpdate?.();
                                            } catch (err: any) {
                                                showToast(err.message || 'Error al asignar', 'error');
                                            }
                                        }}
                                        className="w-full appearance-none bg-white border border-gray-200 pl-10 pr-10 py-2.5 rounded-xl font-medium text-gray-700 focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:border-blue-500 transition-colors"
                                    >
                                        <option value="">Sin asignar</option>
                                        {members.map(m => (
                                            <option key={m.userId} value={m.userId}>{m.user?.name || 'Usuario'}</option>
                                        ))}
                                    </select>

                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                        {(task.assignedTo || task.assignedUser) ? (
                                            <div className="w-5 h-5 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                                {(task.assignedTo?.name || task.assignedUser?.name || '?').charAt(0)}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">👤</span>
                                        )}
                                    </div>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-gray-50 rounded-xl p-4">
                                <div className="text-xs text-gray-500 mb-1">Tiempo registrado</div>
                                <span className="font-medium text-gray-900">{formatHours(task.totalHours)}</span>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4">
                                <div className="text-xs text-gray-500 mb-1">ID Tarea</div>
                                <span className="font-mono text-sm text-gray-600">#{task.id.slice(0, 8)}</span>
                            </div>
                        </div>

                        {task.attachments && task.attachments.length > 0 && (
                            <div className="border-t border-gray-100 pt-6 mb-6">
                                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    Adjuntos ({task.attachments.length})
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {task.attachments.map(att => (
                                        <a
                                            key={att.id}
                                            href={att.url.startsWith('http') ? att.url : `${API_URL}/${att.url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group relative border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all block"
                                        >
                                            {att.type.startsWith('image/') ? (
                                                <div className="aspect-video bg-gray-100 relative">
                                                    <img src={att.url.startsWith('http') ? att.url : `${API_URL}/${att.url}`} alt={att.name} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                                </div>
                                            ) : (
                                                <div className="aspect-video bg-gray-50 flex flex-col items-center justify-center p-4">
                                                    <span className="text-3xl mb-2">📄</span>
                                                </div>
                                            )}
                                            <div className="p-2 bg-white">
                                                <p className="text-xs font-medium text-gray-700 truncate">{att.name}</p>
                                                <p className="text-[10px] text-gray-400">{(att.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="border-t border-gray-100 pt-6">
                            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                Comentarios
                            </h4>

                            <div className="space-y-3 mb-4 max-h-48 overflow-y-auto custom-scrollbar">
                                {task.comments && task.comments.length > 0 ? (
                                    task.comments.map((c: TaskComment) => (
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

                            <div className="flex gap-3 items-end">
                                <div className="flex-1 relative">
                                    <textarea
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder="Escribe un comentario..."
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 placeholder:text-gray-400 resize-none min-h-[50px]"
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
                                    disabled={addingComment}
                                    className={`bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all ${addingComment ? 'opacity-70 cursor-wait' : ''}`}
                                >
                                    {addingComment ? 'Enviando...' : 'Enviar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
