'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    createProject,
    updateProject,
    assignProjectMember,
    removeProjectMember,
    getProject,
    type Project,
    type Client,
    type User
} from '../app/api';
import { useToast } from './Toast';

type ProjectModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    project?: Project | null;
    clients: Client[];
    users: User[];
    defaultMonth?: string;
};

export default function ProjectModal({
    isOpen,
    onClose,
    onSuccess,
    project,
    clients,
    users
}: ProjectModalProps) {
    // Form State
    const [name, setName] = useState('');
    const [budget, setBudget] = useState(10000);
    const [clientId, setClientId] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [originalMemberIds, setOriginalMemberIds] = useState<string[]>([]);

    // UI State
    const [submitting, setSubmitting] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const { showToast } = useToast();

    // Reset form when opening/changing project
    useEffect(() => {
        if (isOpen) {
            if (project) {
                setName(project.name);
                setBudget(project.budget || 0);
                setClientId(project.clientId || '');

                // Load full project details to get members
                loadProjectDetails(project.id);
            } else {
                // New Project Defaults
                setName('');
                setBudget(10000);
                setClientId('');
                setSelectedMemberIds([]);
                setOriginalMemberIds([]);
            }
        }
    }, [isOpen, project]);

    async function loadProjectDetails(id: string) {
        try {
            setLoadingDetails(true);
            const fullProject = await getProject(id);
            if (fullProject.members && Array.isArray(fullProject.members)) {
                const mids = fullProject.members.map((m: any) => m.userId);
                setSelectedMemberIds(mids);
                setOriginalMemberIds(mids);
            } else {
                setSelectedMemberIds([]);
                setOriginalMemberIds([]);
            }
        } catch (e) {
            console.error("Error fetching project details", e);
            showToast('Error cargando miembros del proyecto', 'error');
        } finally {
            setLoadingDetails(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!clientId) {
            showToast('Selecciona un cliente', 'error');
            return;
        }

        try {
            setSubmitting(true);
            let projectId = project?.id;

            if (projectId) {
                // UPDATE
                await updateProject(projectId, {
                    name,
                    clientId,
                    budget
                });
                showToast('Proyecto actualizado', 'success');
            } else {
                // CREATE
                const newProject = await createProject({
                    name,
                    clientId,
                    budget
                });
                projectId = newProject.id;
                showToast('Proyecto creado exitosamente', 'success');
            }

            // 1. Assign New Members
            const toAdd = selectedMemberIds.filter(id => !originalMemberIds.includes(id));
            if (projectId && toAdd.length > 0) {
                for (const userId of toAdd) {
                    const user = users.find(u => u.id === userId);
                    await assignProjectMember(projectId, {
                        userId,
                        payRate: user?.defaultPayRate || 20,
                        billRate: 50,
                        role: user?.role === 'MANAGER' ? 'MANAGER' : 'DEV'
                    });
                }
            }

            // 2. Remove Unselected Members
            if (project && projectId) {
                const toRemove = originalMemberIds.filter(id => !selectedMemberIds.includes(id));
                for (const userId of toRemove) {
                    await removeProjectMember(projectId, userId);
                }
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            showToast(err.message || 'Error guardando proyecto', 'error');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">
                                    {project ? 'Editar Proyecto' : 'Nuevo Proyecto'}
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {project ? 'Modifica los detalles y miembros' : 'Crea un nuevo proyecto y asigna equipo'}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1">

                                {/* Project Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre del Proyecto <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white text-gray-900"
                                        placeholder="Ej: Rediseño Sitio Web"
                                    />
                                </div>

                                {/* Client Select */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente <span className="text-red-500">*</span></label>
                                    <select
                                        required
                                        value={clientId}
                                        onChange={e => setClientId(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white text-gray-900"
                                    >
                                        <option value="">Seleccionar Cliente...</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    {clients.length === 0 && (
                                        <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                                            ⚠️ No hay clientes. Crea uno primero en la sección "Clientes".
                                        </p>
                                    )}
                                </div>

                                {/* Budget */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Presupuesto (USD)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.01"
                                            value={budget}
                                            onChange={e => setBudget(Number(e.target.value))}
                                            className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white text-gray-900"
                                        />
                                    </div>
                                </div>

                                {/* Member Selection */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium text-gray-700">Miembros del Equipo</label>
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                            {selectedMemberIds.length} seleccionados
                                        </span>
                                    </div>

                                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                                        {loadingDetails ? (
                                            <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                                                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                                                <span className="text-sm">Cargando miembros...</span>
                                            </div>
                                        ) : (
                                            <div className="max-h-52 overflow-y-auto p-1 bg-gray-50/50">
                                                {users.length === 0 ? (
                                                    <div className="p-4 text-center text-sm text-gray-500">
                                                        No hay usuarios disponibles.
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {users.map(u => (
                                                            <div
                                                                key={u.id}
                                                                onClick={() => {
                                                                    if (selectedMemberIds.includes(u.id)) {
                                                                        setSelectedMemberIds(prev => prev.filter(id => id !== u.id));
                                                                    } else {
                                                                        setSelectedMemberIds(prev => [...prev, u.id]);
                                                                    }
                                                                }}
                                                                className={`flex items-center gap-3 cursor-pointer p-2 rounded-lg transition-all border ${selectedMemberIds.includes(u.id)
                                                                    ? 'bg-white border-blue-200 shadow-sm'
                                                                    : 'hover:bg-white border-transparent'
                                                                    }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedMemberIds.includes(u.id)}
                                                                    readOnly
                                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 transition-colors pointer-events-none"
                                                                />

                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                                                                    {u.name.charAt(0).toUpperCase()}
                                                                </div>

                                                                <div className="flex-1 min-w-0">
                                                                    <p className={`text-sm font-medium truncate ${selectedMemberIds.includes(u.id) ? 'text-gray-900' : 'text-gray-600'}`}>
                                                                        {u.name}
                                                                    </p>
                                                                    <p className="text-xs text-gray-400 truncate">{u.role}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-white hover:shadow-sm transition-all focus:ring-2 focus:ring-gray-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || loadingDetails}
                                    className={`flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all focus:ring-2 focus:ring-blue-500/50 ${(submitting || loadingDetails) ? 'opacity-70 cursor-wait' : ''
                                        }`}
                                >
                                    {submitting ? 'Guardando...' : (project ? 'Guardar Cambios' : 'Crear Proyecto')}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
