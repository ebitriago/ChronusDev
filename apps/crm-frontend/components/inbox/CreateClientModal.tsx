'use client';

import { useState } from 'react';
import { Conversation, PLATFORM_CONFIG } from './types';
import { API_URL, getHeaders } from '../../app/api';

type CreateClientModalProps = {
    isOpen: boolean;
    onClose: () => void;
    conversation: Conversation;
    onSuccess: (client: { id: string; name: string; contacts: any[] }) => void;
    showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
};

export default function CreateClientModal({
    isOpen,
    onClose,
    conversation,
    onSuccess,
    showToast
}: CreateClientModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        company: '',
        notes: ''
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!formData.name.trim()) return;

        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/clients/from-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify({
                    ...formData,
                    sessionId: conversation.sessionId,
                    platform: conversation.platform,
                    contactValue: conversation.customerContact
                })
            });

            if (res.ok) {
                const data = await res.json();
                onSuccess(data.client);
                onClose();
                setFormData({ name: '', email: '', phone: '', company: '', notes: '' });
                showToast('Cliente creado exitosamente', 'success');
            } else {
                showToast('Error al crear cliente', 'error');
            }
        } catch (err) {
            console.error('Error creating client:', err);
            showToast('Error de conexión', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-fadeIn" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <span>👤</span> Crear Cliente desde Chat
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div className="mb-6 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm text-white ${PLATFORM_CONFIG[conversation.platform]?.color || 'bg-gray-500'}`}>
                        {PLATFORM_CONFIG[conversation.platform]?.icon}
                    </span>
                    <div>
                        <p className="text-xs text-blue-600 font-bold uppercase">Contacto Vinculado</p>
                        <p className="font-mono text-sm text-gray-900 font-medium">{conversation.customerContact}</p>
                    </div>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                            placeholder="Ej: Juan Pérez"
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
                                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                placeholder="juan@empresa.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Teléfono (Opcional)</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                placeholder="+58..."
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empresa</label>
                        <input
                            type="text"
                            value={formData.company}
                            onChange={e => setFormData({ ...formData, company: e.target.value })}
                            className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                            placeholder="Nombre de la empresa..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notas Iniciales</label>
                        <textarea
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none h-20 resize-none"
                            placeholder="Detalles importantes del cliente..."
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={handleSubmit}
                        disabled={!formData.name.trim() || saving}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
                    >
                        {saving ? 'Guardando...' : 'Guardar Cliente'}
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
