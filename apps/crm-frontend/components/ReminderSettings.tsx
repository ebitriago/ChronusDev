'use client';

import { useState, useEffect } from 'react';
import { API_URL } from '../app/api';

type ReminderTemplate = {
    id: string;
    name: string;
    triggerType: 'BIRTHDAY' | 'PAYMENT_DUE' | 'CUSTOM_DATE';
    daysBefore: number;
    channel: 'WHATSAPP' | 'EMAIL' | 'VOICE';
    subject?: string;
    content: string;
    isEnabled: boolean;
    createdAt: string;
};

const triggerTypeLabels: Record<string, string> = {
    BIRTHDAY: '🎂 Cumpleaños',
    PAYMENT_DUE: '💳 Fecha de Pago',
    CUSTOM_DATE: '📅 Fecha Personalizada'
};

const channelLabels: Record<string, string> = {
    WHATSAPP: '💬 WhatsApp',
    EMAIL: '✉️ Email',
    VOICE: '📞 Llamada'
};

export default function ReminderSettings() {
    const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ReminderTemplate | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        triggerType: 'BIRTHDAY' as 'BIRTHDAY' | 'PAYMENT_DUE' | 'CUSTOM_DATE',
        daysBefore: 0,
        channel: 'WHATSAPP' as 'WHATSAPP' | 'EMAIL' | 'VOICE',
        subject: '',
        content: '',
        isEnabled: true
    });

    const getHeaders = () => {
        const token = localStorage.getItem('crm_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await fetch(`${API_URL}/reminders/templates`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setTemplates(data);
            }
        } catch (err) {
            console.error('Error loading templates:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.content) {
            alert('Nombre y contenido son requeridos');
            return;
        }

        try {
            const method = editingTemplate ? 'PUT' : 'POST';
            const url = editingTemplate
                ? `${API_URL}/reminders/templates/${editingTemplate.id}`
                : `${API_URL}/reminders/templates`;

            const res = await fetch(url, {
                method,
                headers: getHeaders(),
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setShowModal(false);
                resetForm();
                fetchTemplates();
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (err) {
            console.error(err);
            alert('Error guardando template');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este template de recordatorio?')) return;

        try {
            const res = await fetch(`${API_URL}/reminders/templates/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            if (res.ok) {
                fetchTemplates();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggle = async (template: ReminderTemplate) => {
        try {
            await fetch(`${API_URL}/reminders/templates/${template.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ ...template, isEnabled: !template.isEnabled })
            });
            fetchTemplates();
        } catch (err) {
            console.error(err);
        }
    };

    const openEdit = (template: ReminderTemplate) => {
        setEditingTemplate(template);
        setFormData({
            name: template.name,
            triggerType: template.triggerType,
            daysBefore: template.daysBefore,
            channel: template.channel,
            subject: template.subject || '',
            content: template.content,
            isEnabled: template.isEnabled
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setEditingTemplate(null);
        setFormData({
            name: '',
            triggerType: 'BIRTHDAY',
            daysBefore: 0,
            channel: 'WHATSAPP',
            subject: '',
            content: '',
            isEnabled: true
        });
    };

    if (loading) {
        return <div className="p-6 text-gray-400">Cargando recordatorios...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Recordatorios Automatizados</h2>
                    <p className="text-sm text-gray-500">Programa mensajes automáticos para cumpleaños y fechas de pago</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20"
                >
                    + Nuevo Recordatorio
                </button>
            </div>

            {/* Placeholders info */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-sm text-blue-800 font-medium">Variables disponibles en los mensajes:</p>
                <div className="flex flex-wrap gap-2 mt-2">
                    <code className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{'{{name}}'}</code>
                    <code className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{'{{company}}'}</code>
                    <code className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{'{{email}}'}</code>
                    <code className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{'{{birthDate}}'}</code>
                    <code className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{'{{paymentDueDay}}'}</code>
                </div>
            </div>

            {/* Templates List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {templates.length === 0 ? (
                    <div className="p-10 text-center text-gray-400">
                        <div className="text-4xl mb-2">🔔</div>
                        <p>No hay recordatorios configurados</p>
                        <p className="text-sm">Crea tu primer template de recordatorio</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100 text-left">
                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Nombre</th>
                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Trigger</th>
                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Canal</th>
                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Días Antes</th>
                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Estado</th>
                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {templates.map(template => (
                                <tr key={template.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-gray-900">{template.name}</p>
                                        <p className="text-xs text-gray-500 line-clamp-1">{template.content}</p>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {triggerTypeLabels[template.triggerType]}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {channelLabels[template.channel]}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {template.daysBefore === 0 ? 'El mismo día' : `${template.daysBefore} días antes`}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggle(template)}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold ${template.isEnabled
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-gray-100 text-gray-500'
                                                }`}
                                        >
                                            {template.isEnabled ? 'Activo' : 'Inactivo'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => openEdit(template)}
                                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => handleDelete(template.id)}
                                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingTemplate ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                    placeholder="Ej: Felicitación de Cumpleaños"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Trigger</label>
                                    <select
                                        value={formData.triggerType}
                                        onChange={e => setFormData({ ...formData, triggerType: e.target.value as any })}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                                    >
                                        <option value="BIRTHDAY">Cumpleaños</option>
                                        <option value="PAYMENT_DUE">Fecha de Pago</option>
                                        {/* <option value="CUSTOM_DATE">Fecha Personalizada</option> */}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Días Antes</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="30"
                                        value={formData.daysBefore}
                                        onChange={e => setFormData({ ...formData, daysBefore: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">0 = el mismo día</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Canal</label>
                                <select
                                    value={formData.channel}
                                    onChange={e => setFormData({ ...formData, channel: e.target.value as any })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                                >
                                    <option value="WHATSAPP">WhatsApp</option>
                                    <option value="EMAIL">Email</option>
                                    <option value="VOICE">Llamada de Voz</option>
                                </select>
                            </div>

                            {formData.channel === 'EMAIL' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Asunto del Email</label>
                                    <input
                                        type="text"
                                        value={formData.subject}
                                        onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                        placeholder="Ej: ¡Feliz cumpleaños, {{name}}!"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje *</label>
                                <textarea
                                    value={formData.content}
                                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                                    rows={4}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                    placeholder="Hola {{name}}, ¡te deseamos un feliz cumpleaños! 🎉"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isEnabled"
                                    checked={formData.isEnabled}
                                    onChange={e => setFormData({ ...formData, isEnabled: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300"
                                />
                                <label htmlFor="isEnabled" className="text-sm text-gray-700">Activar inmediatamente</label>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold"
                                >
                                    {editingTemplate ? 'Guardar Cambios' : 'Crear Recordatorio'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
