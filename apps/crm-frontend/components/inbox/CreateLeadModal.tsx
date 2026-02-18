'use client';

import { useState, useEffect } from 'react';
import { API_URL, getHeaders } from '../../app/api';

type CreateLeadModalProps = {
    isOpen: boolean;
    onClose: () => void;
    customerName?: string;
    customerContact: string;
    platform: string;
    showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
};

export default function CreateLeadModal({
    isOpen,
    onClose,
    customerName,
    customerContact,
    platform,
    showToast
}: CreateLeadModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        company: '',
        value: 0,
        notes: '',
        source: platform,
        status: 'Nuevo'
    });
    const [saving, setSaving] = useState(false);
    const [stages, setStages] = useState<any[]>([]);

    // Pre-fill name from conversation
    useEffect(() => {
        if (customerName) {
            setFormData(prev => ({ ...prev, name: customerName }));
        }
    }, [customerName, isOpen]);

    // Fetch pipeline stages
    useEffect(() => {
        if (isOpen) {
            fetch(`${API_URL}/pipeline-stages`, { headers: getHeaders() })
                .then(r => r.ok ? r.json() : [])
                .then(data => {
                    if (Array.isArray(data) && data.length > 0) {
                        setStages(data);
                    } else {
                        // Default Fallback matching Kanban
                        setStages([
                            { name: 'Nuevo' },
                            { name: 'Contactado' },
                            { name: 'Calificado' },
                            { name: 'Negociación' },
                            { name: 'Ganado' },
                            { name: 'Perdido' }
                        ]);
                    }
                })
                .catch(() => {
                    setStages([
                        { name: 'Nuevo' },
                        { name: 'Contactado' },
                        { name: 'Calificado' },
                        { name: 'Negociación' },
                        { name: 'Ganado' },
                        { name: 'Perdido' }
                    ]);
                });
        }
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            showToast('El nombre es requerido', 'error');
            return;
        }

        // Map platform to LeadSource enum
        let validSource = 'MANUAL';
        const lowerPlatform = platform.toLowerCase();
        if (['whatsapp', 'instagram', 'messenger', 'facebook'].includes(lowerPlatform)) {
            validSource = 'SOCIAL';
        } else if (lowerPlatform === 'assistai') {
            validSource = 'ASSISTAI';
        }

        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify({
                    ...formData,
                    email: formData.email || `lead-${Date.now()}@noemail.com`, // Fallback for email requirement
                    source: validSource,
                    notes: (formData.notes || '') + `\n\n[Origen: ${platform} - ${customerContact}]`
                })
            });

            if (res.ok) {
                showToast('Lead creado exitosamente', 'success');
                onClose();
                setFormData({
                    name: '',
                    email: '',
                    company: '',
                    value: 0,
                    notes: '',
                    source: platform,
                    status: 'Nuevo'
                });
            } else {
                const data = await res.json();
                showToast(data.error || 'Error al crear lead', 'error');
            }
        } catch (err) {
            console.error('Error creating lead:', err);
            showToast('Error de conexión', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-blue-500 to-indigo-600">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <span>📊</span> Crear Lead desde Conversación
                        </h3>
                        <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
                    </div>
                    <p className="text-blue-100 text-xs mt-1">Contacto: {customerContact}</p>
                </div>

                <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            Nombre del Lead <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            placeholder="Nombre completo"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                placeholder="email@empresa.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empresa</label>
                            <input
                                type="text"
                                value={formData.company}
                                onChange={e => setFormData({ ...formData, company: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                placeholder="Nombre de la empresa"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor Estimado ($)</label>
                            <input
                                type="number"
                                value={formData.value}
                                onChange={e => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                placeholder="0.00"
                                min="0"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Etapa</label>
                            <select
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white"
                            >
                                {stages.map((stage, idx) => (
                                    <option key={stage.id || idx} value={stage.name}>
                                        {stage.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notas</label>
                        <textarea
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 outline-none h-20 resize-none"
                            placeholder="Notas adicionales sobre este lead..."
                        />
                    </div>
                </div>

                <div className="p-5 border-t border-gray-100 flex gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={!formData.name.trim() || saving}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
                    >
                        {saving ? 'Creando...' : 'Crear Lead'}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}
