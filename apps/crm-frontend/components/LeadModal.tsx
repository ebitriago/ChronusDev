'use client';

import { useState, useEffect } from 'react';
import { API_URL } from '../app/api';
import UserSelect from './UserSelect';
import TagInput from './TagInput';

type Lead = {
    id?: string;
    name: string;
    email: string;
    company?: string;
    value: number;
    status: string;
    notes?: string;
    source?: string;
    assignedToId?: string;
    tags?: string[];
};

interface LeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    leadToEdit?: Lead | null;
    stages: any[];
}

export default function LeadModal({ isOpen, onClose, onSuccess, leadToEdit, stages }: LeadModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Lead>({
        name: '',
        email: '',
        company: '',
        value: 0,
        status: 'Nuevo',
        notes: '',
        source: 'MANUAL',
        assignedToId: undefined,
        tags: []
    });

    useEffect(() => {
        if (leadToEdit) {
            setFormData(leadToEdit);
        } else {
            setFormData({
                name: '',
                email: '',
                company: '',
                value: 0,
                status: 'Nuevo',
                notes: '',
                source: 'MANUAL',
                assignedToId: undefined,
                tags: []
            });
        }
    }, [leadToEdit, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const url = leadToEdit ? `${API_URL}/leads/${leadToEdit.id}` : `${API_URL}/leads`;
            const method = leadToEdit ? 'PUT' : 'POST';

            const token = localStorage.getItem('crm_token');
            const headers: any = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(url, {
                method,
                headers,
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                const err = await res.json().catch(() => ({}));
                const msg = err.error || err.message || 'Error desconocido al guardar';
                console.error('Error saving lead:', res.status, err);
                alert(`Error al guardar lead: ${msg} (${res.status})`);
            }
        } catch (error) {
            console.error(error);
            alert('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const [showProposalForm, setShowProposalForm] = useState(false);
    const [proposalData, setProposalData] = useState({ description: 'Servicio Profesional', amount: 0 });

    useEffect(() => {
        if (leadToEdit) {
            setProposalData(prev => ({ ...prev, amount: leadToEdit.value }));
        }
    }, [leadToEdit]);

    const handleCreateProposal = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem('crm_token');
            const headers: any = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_URL}/invoices`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    leadId: leadToEdit?.id,
                    type: 'QUOTE',
                    amount: proposalData.amount,
                    currency: 'USD',
                    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 days
                    items: [{
                        description: proposalData.description,
                        quantity: 1,
                        unitPrice: proposalData.amount,
                        total: proposalData.amount
                    }]
                })
            });

            if (res.ok) {
                alert('Propuesta generada exitosamente');
                setShowProposalForm(false);
                onSuccess();
                onClose();
            } else {
                const err = await res.json();
                alert('Error al crear propuesta: ' + (err.error || 'Desconocido'));
            }
        } catch (error) {
            console.error(error);
            alert('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    // Attachment State
    const [attachments, setAttachments] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (leadToEdit) {
            // Fetch attachments
            const fetchAttachments = async () => {
                try {
                    const token = localStorage.getItem('crm_token');
                    const res = await fetch(`${API_URL}/clients/${leadToEdit.id}`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {}
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setAttachments(data.attachments || []);
                    }
                } catch (e) {
                    console.error("Error fetching attachments", e);
                }
            };
            fetchAttachments();
        } else {
            setAttachments([]);
        }
    }, [leadToEdit, isOpen]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !leadToEdit) return;

        setUploading(true);
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);

        try {
            // 1. Upload file
            const uploadRes = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                body: formData // No headers for multipart/form-data
            });

            if (!uploadRes.ok) throw new Error('Error subiendo archivo');
            const uploadData = await uploadRes.json();

            // 2. Link to client
            const token = localStorage.getItem('crm_token');
            const linkRes = await fetch(`${API_URL}/clients/${leadToEdit.id}/attachments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    name: file.name,
                    url: uploadData.url,
                    type: file.type,
                    size: file.size
                })
            });

            if (linkRes.ok) {
                const newAtt = await linkRes.json();
                setAttachments(prev => [newAtt, ...prev]);
            }
        } catch (error) {
            console.error(error);
            alert('Error al subir archivo');
        } finally {
            setUploading(false);
            e.target.value = ''; // Reset input
        }
    };

    const handleDeleteAttachment = async (attId: string) => {
        if (!confirm('¿Eliminar archivo?') || !leadToEdit) return;
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/clients/${leadToEdit.id}/attachments/${attId}`, {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            if (res.ok) {
                setAttachments(prev => prev.filter(a => a.id !== attId));
            }
        } catch (error) {
            console.error(error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900">
                        {showProposalForm ? 'Nueva Propuesta' : (leadToEdit ? 'Editar Lead' : 'Nuevo Lead')}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        ✕
                    </button>
                </div>

                {showProposalForm ? (
                    <form onSubmit={handleCreateProposal} className="p-6 space-y-4">
                        <div className="p-4 bg-blue-50 text-blue-800 rounded-xl text-sm mb-4">
                            Creando propuesta económica para <strong>{leadToEdit?.name}</strong>.
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Concepto / Descripción</label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                                value={proposalData.description}
                                onChange={e => setProposalData({ ...proposalData, description: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto ($)</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                                value={proposalData.amount}
                                onFocus={(e) => e.target.select()}
                                onChange={e => setProposalData({ ...proposalData, amount: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                            />
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => setShowProposalForm(false)}
                                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600 font-medium"
                            >
                                Volver
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20"
                            >
                                {loading ? 'Generando...' : 'Generar Propuesta'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empresa</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                                    value={formData.company || ''}
                                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor Estimado ($)</label>
                                <input
                                    type="number"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                                    value={formData.value}
                                    onChange={e => setFormData({ ...formData, value: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Etiquetas</label>
                            <TagInput
                                selectedTags={formData.tags || []}
                                onChange={(tags) => setFormData({ ...formData, tags })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado</label>
                            <select
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                            >
                                {stages && stages.length > 0 ? (
                                    stages.map((stage) => (
                                        <option key={stage.id} value={stage.name}>
                                            {stage.name}
                                        </option>
                                    ))
                                ) : (
                                    <>
                                        <option value="NEW">Nuevo</option>
                                        <option value="CONTACTED">Contactado</option>
                                        <option value="QUALIFIED">Calificado</option>
                                        <option value="WON">Ganado</option>
                                        <option value="LOST">Perdido</option>
                                    </>
                                )}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notas</label>
                            <textarea
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 h-24 resize-none"
                                value={formData.notes || ''}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            ></textarea>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Asignar a</label>
                            <UserSelect
                                value={formData.assignedToId}
                                onChange={(userId) => setFormData({ ...formData, assignedToId: userId })}
                            />
                        </div>

                        {leadToEdit && (
                            <div className="border-t border-gray-100 pt-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Archivos Adjuntos</label>
                                <div className="space-y-2 mb-3">
                                    {attachments.map(att => (
                                        <div key={att.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm group">
                                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[200px]">
                                                {att.name}
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteAttachment(att.id)}
                                                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="relative">
                                    <input
                                        type="file"
                                        onChange={handleFileUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={uploading}
                                    />
                                    <div className="flex items-center justify-center w-full px-4 py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 text-sm hover:border-blue-400 hover:bg-blue-50 transition-colors">
                                        {uploading ? 'Subiendo...' : '📎 Adjuntar archivo'}
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg text-sm bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {loading ? 'Guardando...' : 'Guardar Lead'}
                        </button>

                        {leadToEdit && (
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowProposalForm(true)}
                                    className="flex-1 py-3 rounded-xl font-bold text-blue-700 border border-blue-200 hover:bg-blue-50 transition-colors text-sm"
                                >
                                    📄 Generar Propuesta
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!confirm('¿Estás seguro de convertir este lead en cliente? Se eliminará de leads.')) return;
                                        setLoading(true);
                                        try {
                                            const token = localStorage.getItem('crm_token');
                                            const headers: any = { 'Content-Type': 'application/json' };
                                            if (token) headers['Authorization'] = `Bearer ${token}`;

                                            const res = await fetch(`${API_URL}/leads/${leadToEdit.id}/convert`, {
                                                method: 'POST',
                                                headers,
                                                body: JSON.stringify({ plan: 'BASIC' })
                                            });
                                            if (res.ok) {
                                                onSuccess();
                                                onClose();
                                            } else {
                                                alert('Error al convertir lead');
                                            }
                                        } catch (err) {
                                            console.error(err);
                                            alert('Error de conexión');
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    className="flex-1 py-3 rounded-xl font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-colors text-sm"
                                    disabled={loading}
                                >
                                    ⚡ Convertir a Cliente
                                </button>
                            </div>
                        )}
                    </form>
                )}
            </div>
        </div >
    );
}
