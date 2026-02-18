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
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        🔔 Recordatorios Automatizados
                    </h2>
                    <p className="text-gray-500 mt-1">Programa mensajes automáticos para cumpleaños, cobros y seguimientos.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="group bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30 flex items-center gap-2"
                >
                    <span>+</span> Nuevo Recordatorio
                </button>
            </div>

            {/* Placeholders info */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <div>
                        <h4 className="font-bold text-blue-900 text-sm">Personalización Dinámica</h4>
                        <p className="text-xs text-blue-700 mt-1 max-w-lg">
                            Usa variables para personalizar cada mensaje automáticamente con los datos del cliente.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <code className="px-2.5 py-1 bg-white border border-blue-200 text-blue-700 rounded-lg text-xs font-mono shadow-sm">{'{{name}}'}</code>
                    <code className="px-2.5 py-1 bg-white border border-blue-200 text-blue-700 rounded-lg text-xs font-mono shadow-sm">{'{{company}}'}</code>
                    <code className="px-2.5 py-1 bg-white border border-blue-200 text-blue-700 rounded-lg text-xs font-mono shadow-sm">{'{{birthDate}}'}</code>
                    <code className="px-2.5 py-1 bg-white border border-blue-200 text-blue-700 rounded-lg text-xs font-mono shadow-sm">{'{{paymentDueDay}}'}</code>
                </div>
            </div>

            {/* Templates List */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {templates.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner">
                            🔔
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">No hay recordatorios configurados</h3>
                        <p className="text-gray-500 mb-8 max-w-sm mx-auto">Crea tu primer recordatorio automático para mantener el contacto con tus clientes sin esfuerzo.</p>
                        <button
                            onClick={() => { resetForm(); setShowModal(true); }}
                            className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-black transition-colors"
                        >
                            Crear Primer Recordatorio
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-200 text-left">
                                    <th className="px-8 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre / Contenido</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Trigger</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Canal</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Programación</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {templates.map(template => (
                                    <tr key={template.id} className="group hover:bg-gray-50/50 transition-colors">
                                        <td className="px-8 py-5">
                                            <p className="font-bold text-gray-900 mb-1">{template.name}</p>
                                            <p className="text-xs text-gray-500 line-clamp-1 max-w-xs">{template.content}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200">
                                                {triggerTypeLabels[template.triggerType]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100">
                                                {channelLabels[template.channel]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-sm text-gray-600 font-medium">
                                            {template.daysBefore === 0 ? 'El mismo día (09:00 AM)' : `${template.daysBefore} días antes`}
                                        </td>
                                        <td className="px-6 py-5">
                                            <button
                                                onClick={() => handleToggle(template)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${template.isEnabled ? 'bg-emerald-500' : 'bg-gray-200'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${template.isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEdit(template)}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    ✎
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(template.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto scale-100 transition-transform">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-xl font-bold text-gray-900">
                                {editingTemplate ? '✏️ Editar Recordatorio' : '✨ Nuevo Recordatorio'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors">✕</button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Nombre del Recordatorio</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-gray-300"
                                    placeholder="Ej: Felicitación de Cumpleaños"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Evento Disparador</label>
                                    <div className="relative">
                                        <select
                                            value={formData.triggerType}
                                            onChange={e => setFormData({ ...formData, triggerType: e.target.value as any })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white appearance-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                        >
                                            <option value="BIRTHDAY">🎂 Cumpleaños</option>
                                            <option value="PAYMENT_DUE">💳 Fecha de Pago</option>
                                            {/* <option value="CUSTOM_DATE">📅 Fecha Personalizada</option> */}
                                        </select>
                                        <div className="absolute right-3 top-3 pointer-events-none text-gray-500">▼</div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Antelación (Días)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="30"
                                        value={formData.daysBefore}
                                        onChange={e => setFormData({ ...formData, daysBefore: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">0 = Enviar el mismo día del evento</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Canal de Envío</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['WHATSAPP', 'EMAIL', 'VOICE'] as const).map(channel => (
                                        <button
                                            key={channel}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, channel })}
                                            className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${formData.channel === channel
                                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-500/30'
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            {channelLabels[channel]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {formData.channel === 'EMAIL' && (
                                <div className="animate-fadeIn">
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Asunto del Correo</label>
                                    <input
                                        type="text"
                                        value={formData.subject}
                                        onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                        placeholder="Ej: ¡Feliz cumpleaños, {{name}}!"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Contenido del Mensaje</label>
                                <textarea
                                    value={formData.content}
                                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                                    rows={5}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none"
                                    placeholder="Hola {{name}}, ¡te deseamos un feliz cumpleaños! Esperamos que pases un día excelente. 🎉"
                                />
                                <p className="text-[10px] text-gray-400 mt-2 text-right">
                                    {formData.content.length} caracteres
                                </p>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, isEnabled: !formData.isEnabled })}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.isEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                                <label className="text-sm font-medium text-gray-700 cursor-pointer" onClick={() => setFormData({ ...formData, isEnabled: !formData.isEnabled })}>
                                    Activar recordatorio inmediatamente
                                </label>
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-700 font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="flex-1 bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-gray-200 transition-all transform hover:-translate-y-0.5"
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
