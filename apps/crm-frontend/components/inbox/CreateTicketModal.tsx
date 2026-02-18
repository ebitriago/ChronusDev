'use client';

import { useState, useEffect } from 'react';
import { API_URL, getHeaders } from '../../app/api';
import TagInput from '../TagInput';

type CreateTicketModalProps = {
    isOpen: boolean;
    onClose: () => void;
    customerName?: string;
    customerContact: string;
    platform: string;
    clientId?: string;
    showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
};

export default function CreateTicketModal({
    isOpen,
    onClose,
    customerName,
    customerContact,
    platform,
    clientId,
    showToast
}: CreateTicketModalProps) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'medium',
        type: 'support',
        tags: [] as string[]
    });
    const [saving, setSaving] = useState(false);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                title: '',
                description: `Ticket creado desde conversación de ${platform} con ${customerName || customerContact}`,
                priority: 'medium',
                type: 'support',
                tags: []
            });
        }
    }, [isOpen, platform, customerName, customerContact]);

    const handleSubmit = async () => {
        if (!formData.title.trim()) {
            showToast('El título es requerido', 'error');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/tickets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify({
                    ...formData,
                    customerId: clientId,
                    source: platform,
                    contactInfo: customerContact
                })
            });

            if (res.ok) {
                showToast('Ticket creado exitosamente', 'success');
                onClose();
                setFormData({
                    title: '',
                    description: '',
                    priority: 'medium',
                    type: 'support',
                    tags: []
                });
            } else {
                const data = await res.json();
                showToast(data.error || 'Error al crear ticket', 'error');
            }
        } catch (err) {
            console.error('Error creating ticket:', err);
            showToast('Error de conexión', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-orange-500 to-red-500">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <span>🎫</span> Crear Ticket de Soporte
                        </h3>
                        <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
                    </div>
                    <p className="text-orange-100 text-xs mt-1">Cliente: {customerName || customerContact}</p>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            Título del Ticket <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                            placeholder="Resumen del problema o solicitud"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Prioridad</label>
                            <select
                                value={formData.priority}
                                onChange={e => setFormData({ ...formData, priority: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500/20 outline-none bg-white"
                            >
                                <option value="low">🟢 Baja</option>
                                <option value="medium">🟡 Media</option>
                                <option value="high">🟠 Alta</option>
                                <option value="urgent">🔴 Urgente</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo</label>
                            <select
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500/20 outline-none bg-white"
                            >
                                <option value="support">Soporte</option>
                                <option value="bug">Bug/Error</option>
                                <option value="feature">Solicitud</option>
                                <option value="billing">Facturación</option>
                                <option value="other">Otro</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descripción</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500/20 outline-none h-28 resize-none"
                            placeholder="Describe el problema o solicitud en detalle..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Etiquetas</label>
                        <TagInput
                            selectedTags={formData.tags}
                            onChange={(newTags) => setFormData({ ...formData, tags: newTags })}
                            placeholder="Añadir etiquetas..."
                        />
                    </div>

                    <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-600">
                        <strong>Origen:</strong> {platform} • <strong>Contacto:</strong> {customerContact}
                    </div>
                </div>

                <div className="p-5 border-t border-gray-100 flex gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={!formData.title.trim() || saving}
                        className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-orange-500/20"
                    >
                        {saving ? 'Creando...' : 'Crear Ticket'}
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
