
'use client';

import { useState, useEffect } from 'react';
import { API_URL } from '../app/api';
import { useToast } from './Toast';
import PipelineAutomationsModal from './PipelineAutomationsModal';

type Stage = {
    id: string;
    name: string;
    color: string;
    order: number;
    automations?: any[];
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
};

export default function PipelineSettings({ isOpen, onClose, onSuccess }: Props) {
    const [stages, setStages] = useState<Stage[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', color: '' });
    const [automationStage, setAutomationStage] = useState<Stage | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        if (isOpen) fetchStages();
    }, [isOpen]);

    const fetchStages = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/pipeline-stages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStages(data);
            }
        } catch (error) {
            console.error(error);
            showToast('Error cargando etapas', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editForm.name) return;

        try {
            const token = localStorage.getItem('crm_token');
            const url = editingId
                ? `${API_URL}/pipeline-stages/${editingId}`
                : `${API_URL}/pipeline-stages`;

            const method = editingId ? 'PUT' : 'POST';

            // If creating, set order to last + 1
            const body: any = { ...editForm };
            if (!editingId) {
                body.order = stages.length;
            }

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                showToast('Etapa guardada', 'success');
                setEditingId(null);
                setEditForm({ name: '', color: '' });
                fetchStages();
                onSuccess();
            } else {
                showToast('Error al guardar', 'error');
            }
        } catch (err) {
            showToast('Error de conexión', 'error');
        }
    };

    const handleDelete = (id: string) => {
        setDeleteConfirmationId(id);
    };

    const confirmDelete = async (id: string) => {
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/pipeline-stages/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.movedLeads && data.movedLeads > 0) {
                    showToast(`Etapa eliminada. ${data.movedLeads} leads movidos a 'Nuevo'.`, 'success');
                } else {
                    showToast('Etapa eliminada', 'success');
                }
                setDeleteConfirmationId(null);
                fetchStages();
                onSuccess();
            } else {
                const data = await res.json();
                showToast(data.error || 'No se pudo eliminar', 'error');
            }
        } catch (err) {
            showToast('Error de conexión', 'error');
        }
    };

    const startEdit = (stage: Stage) => {
        setEditingId(stage.id);
        setEditForm({ name: stage.name, color: stage.color || 'bg-gray-100' });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({ name: '', color: '' });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fadeIn">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800">Editar Pipeline</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto">

                    {/* Form */}
                    <div className="bg-gray-50 p-4 rounded-xl mb-6 border border-gray-100">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">
                            {editingId ? 'Editar Etapa' : 'Nueva Etapa'}
                        </h4>
                        <form onSubmit={handleSave} className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Nombre (ej. Negociación)"
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                value={editForm.name}
                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                required
                            />
                            <select
                                className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                value={editForm.color}
                                onChange={e => setEditForm({ ...editForm, color: e.target.value })}
                            >
                                <option value="">Color...</option>
                                <option value="bg-blue-50 text-blue-700 border-blue-100">Azul</option>
                                <option value="bg-green-50 text-green-700 border-green-100">Verde</option>
                                <option value="bg-purple-50 text-purple-700 border-purple-100">Morado</option>
                                <option value="bg-amber-50 text-amber-700 border-amber-100">Ámbar</option>
                                <option value="bg-red-50 text-red-700 border-red-100">Rojo</option>
                            </select>
                            <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold">
                                {editingId ? 'Guardar' : 'Agregar'}
                            </button>
                            {editingId && (
                                <button type="button" onClick={cancelEdit} className="bg-white border px-3 rounded-lg">✕</button>
                            )}
                        </form>
                    </div>

                    {/* List */}
                    <div className="space-y-2">
                        {stages.map((stage, index) => (
                            <div
                                key={stage.id}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('text/plain', index.toString());
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault(); // Necessary to allow dropping
                                }}
                                onDrop={async (e) => {
                                    e.preventDefault();
                                    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
                                    if (sourceIndex === index) return;

                                    // Reorder local
                                    const newStages = [...stages];
                                    const [moved] = newStages.splice(sourceIndex, 1);
                                    newStages.splice(index, 0, moved);
                                    setStages(newStages);

                                    // Save to backend
                                    try {
                                        const token = localStorage.getItem('crm_token');
                                        await fetch(`${API_URL}/pipeline-stages/reorder`, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${token}`
                                            },
                                            body: JSON.stringify({ stageIds: newStages.map(s => s.id) })
                                        });
                                        onSuccess(); // Refresh Kanban
                                    } catch (err) {
                                        showToast('Error al guardar orden', 'error');
                                    }
                                }}
                                className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-move"
                            >
                                <div className="flex items-center gap-3 pointer-events-none">
                                    <span className="text-gray-400">☰</span>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${stage.color || 'bg-gray-100'}`}>
                                        {stage.name}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    {deleteConfirmationId === stage.id ? (
                                        <div className="flex items-center gap-2 animate-fadeIn">
                                            <span className="text-[10px] text-red-600 font-medium">¿Eliminar y mover leads?</span>
                                            <button
                                                onClick={() => confirmDelete(stage.id)}
                                                className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded"
                                            >
                                                Sí
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirmationId(null)}
                                                className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs px-2 py-1 rounded"
                                            >
                                                No
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => setAutomationStage(stage)}
                                                className="text-amber-500 text-xs font-bold hover:bg-amber-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                                title="Automatizaciones"
                                            >
                                                ⚡ {(stage.automations?.length || 0) > 0 && <span className="bg-amber-500 text-white text-[9px] px-1 rounded-full">{stage.automations?.length}</span>}
                                            </button>
                                            <button onClick={() => startEdit(stage)} className="text-blue-600 text-xs font-bold hover:underline">Editar</button>
                                            <button onClick={() => handleDelete(stage.id)} className="text-red-500 text-xs font-bold hover:underline">Eliminar</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && <p className="text-center text-xs text-gray-400">Cargando...</p>}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-50 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 font-bold text-sm">Cerrar</button>
                </div>
            </div>

            {automationStage && (
                <PipelineAutomationsModal
                    isOpen={!!automationStage}
                    onClose={() => setAutomationStage(null)}
                    stageId={automationStage.id}
                    stageName={automationStage.name}
                    automations={automationStage.automations}
                    onUpdate={fetchStages}
                />
            )}
        </div>
    );
}
