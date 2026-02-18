'use client';

import { useState } from 'react';
import { API_URL } from '../app/api';
import { useToast } from './Toast';

type Automation = {
    id: string;
    trigger: string;
    actionType: string;
    delayMinutes: number;
    config: any;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    stageId: string;
    stageName: string;
    automations: Automation[] | undefined;
    onUpdate: () => void;
};

const VARIABLES = [
    { label: 'Nombre Cliente', value: '{{name}}' },
    { label: 'Email', value: '{{email}}' },
    { label: 'Empresa', value: '{{company}}' },
    { label: 'Teléfono', value: '{{phone}}' },
];

export default function PipelineAutomationsModal({ isOpen, onClose, stageId, stageName, automations = [], onUpdate }: Props) {
    const [isAdding, setIsAdding] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        actionType: 'EMAIL',
        delayMinutes: 0,
        subject: '',
        body: '',
        toType: 'LEAD', // LEAD or CUSTOM
        customEmail: '',
        url: '',
        taskTitle: '',
        taskDescription: ''
    });

    const { showToast } = useToast();

    if (!isOpen) return null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const config: any = {};
        if (form.actionType === 'EMAIL') {
            config.subject = form.subject;
            config.body = form.body;
            config.to = form.toType;
            if (form.toType === 'CUSTOM') config.customEmail = form.customEmail;
        } else if (form.actionType === 'WEBHOOK') {
            config.url = form.url;
        } else if (form.actionType === 'CREATE_TASK') {
            config.title = form.taskTitle;
            config.description = form.taskDescription;
        }

        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/pipeline-stages/${stageId}/automations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    actionType: form.actionType,
                    delayMinutes: parseInt(form.delayMinutes.toString()),
                    config
                })
            });

            if (res.ok) {
                showToast('Automatización agregada', 'success');
                setIsAdding(false);
                setForm({
                    actionType: 'EMAIL',
                    delayMinutes: 0,
                    subject: '',
                    body: '',
                    toType: 'LEAD',
                    customEmail: '',
                    url: '',
                    taskTitle: '',
                    taskDescription: ''
                });
                onUpdate();
            } else {
                showToast('Error al guardar', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de conexión', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta automatización?')) return;
        try {
            const token = localStorage.getItem('crm_token');
            await fetch(`${API_URL}/pipeline-stages/automations/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            onUpdate();
            showToast('Eliminada', 'success');
        } catch (err) {
            showToast('Error al eliminar', 'error');
        }
    };

    const insertVariable = (fieldName: 'body' | 'taskDescription', value: string) => {
        setForm(prev => ({
            ...prev,
            [fieldName]: prev[fieldName] + value
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">⚡ Automatizaciones del Pipeline</h3>
                        <p className="text-xs text-gray-500">
                            Cuando un lead entra a <span className="font-bold text-blue-600 bg-blue-50 px-1 rounded">{stageName}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2">✕</button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">

                    {!isAdding ? (
                        <div className="space-y-4">
                            {automations.length === 0 ? (
                                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                    <div className="text-4xl mb-3">🤖</div>
                                    <h4 className="font-bold text-gray-700">Sin reglas activas</h4>
                                    <p className="text-sm text-gray-500 mb-4">Automatiza emails, tareas o webhooks cuando los leads lleguen aquí.</p>
                                    <button
                                        onClick={() => setIsAdding(true)}
                                        className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                                    >
                                        + Crear primera automatización
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {automations.map(auto => (
                                        <div key={auto.id} className="p-4 border border-gray-100 rounded-xl bg-white shadow-sm flex justify-between items-center hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-lg ${auto.actionType === 'EMAIL' ? 'bg-blue-100 text-blue-600' :
                                                        auto.actionType === 'CREATE_TASK' ? 'bg-green-100 text-green-600' :
                                                            'bg-purple-100 text-purple-600'
                                                    }`}>
                                                    {auto.actionType === 'EMAIL' ? '📧' :
                                                        auto.actionType === 'CREATE_TASK' ? '✅' : '🔗'}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="font-bold text-gray-800 text-sm">
                                                            {auto.actionType === 'EMAIL' ? 'Enviar Email' :
                                                                auto.actionType === 'CREATE_TASK' ? 'Crear Tarea' : 'Webhook'}
                                                        </span>
                                                        <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                                            {auto.delayMinutes === 0 ? 'Inmediato' : `+${auto.delayMinutes} min`}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 truncate max-w-[300px]">
                                                        {auto.actionType === 'EMAIL' ? `Asunto: ${auto.config?.subject}` :
                                                            auto.actionType === 'WEBHOOK' ? `URL: ${auto.config?.url}` :
                                                                auto.actionType === 'CREATE_TASK' ? `Tarea: ${auto.config?.title}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(auto.id)}
                                                className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => setIsAdding(true)}
                                        className="w-full py-3 border border-dashed border-gray-300 rounded-xl text-gray-500 text-sm font-bold hover:bg-gray-50 hover:text-gray-700 hover:border-gray-400 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span>+</span> Agregar otra regla
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSave} className="space-y-5 animate-fadeIn">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Tipo de Acción</label>
                                    <select
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 focus:bg-white transition-colors"
                                        value={form.actionType}
                                        onChange={e => setForm({ ...form, actionType: e.target.value })}
                                    >
                                        <option value="EMAIL">📧 Enviar Email</option>
                                        <option value="CREATE_TASK">✅ Crear Tarea</option>
                                        <option value="WEBHOOK">🔗 Integración Webhook</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Ejecutar</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            className="w-20 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                            value={form.delayMinutes}
                                            onChange={e => setForm({ ...form, delayMinutes: parseInt(e.target.value) || 0 })}
                                            min="0"
                                        />
                                        <span className="text-sm text-gray-500">minutos después</span>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            {form.actionType === 'EMAIL' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Destinatario</label>
                                            <select
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                                value={form.toType}
                                                onChange={e => setForm({ ...form, toType: e.target.value })}
                                            >
                                                <option value="LEAD">El Lead (Email del cliente)</option>
                                                <option value="CUSTOM">Email Específico (Equipo)</option>
                                            </select>
                                        </div>
                                        {form.toType === 'CUSTOM' && (
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 mb-1">Email del Equipo</label>
                                                <input
                                                    type="email"
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                                    value={form.customEmail}
                                                    onChange={e => setForm({ ...form, customEmail: e.target.value })}
                                                    placeholder="equipo@empresa.com"
                                                    required
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Asunto</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                            value={form.subject}
                                            onChange={e => setForm({ ...form, subject: e.target.value })}
                                            placeholder="Bienvenido a ChronusCRM..."
                                            required
                                        />
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-xs font-bold text-gray-700">Contenido del Correo</label>
                                            <div className="flex gap-1">
                                                {VARIABLES.map(v => (
                                                    <button
                                                        key={v.value}
                                                        type="button"
                                                        onClick={() => insertVariable('body', v.value)}
                                                        className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
                                                    >
                                                        {v.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <textarea
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm h-32 font-mono"
                                            value={form.body}
                                            onChange={e => setForm({ ...form, body: e.target.value })}
                                            placeholder="Hola {{name}}, gracias por tu interés..."
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {form.actionType === 'CREATE_TASK' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Título de la Tarea</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                            value={form.taskTitle}
                                            onChange={e => setForm({ ...form, taskTitle: e.target.value })}
                                            placeholder="Llamar a cliente..."
                                            required
                                        />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-xs font-bold text-gray-700">Descripción / Detalles</label>
                                            <div className="flex gap-1">
                                                {VARIABLES.map(v => (
                                                    <button
                                                        key={v.value}
                                                        type="button"
                                                        onClick={() => insertVariable('taskDescription', v.value)}
                                                        className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
                                                    >
                                                        {v.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <textarea
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm h-24"
                                            value={form.taskDescription}
                                            onChange={e => setForm({ ...form, taskDescription: e.target.value })}
                                            placeholder="Recordar preguntar por..."
                                        />
                                    </div>
                                </div>
                            )}

                            {form.actionType === 'WEBHOOK' && (
                                <div className="space-y-4">
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                                        ℹ️ Enviaremos un POST request con los datos del Lead a esta URL.
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">URL del Webhook</label>
                                        <input
                                            type="url"
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono"
                                            value={form.url}
                                            onChange={e => setForm({ ...form, url: e.target.value })}
                                            placeholder="https://api.example.com/webhook"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-600/20 transition-all"
                                >
                                    {loading ? 'Guardando...' : 'Guardar Automatización'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
