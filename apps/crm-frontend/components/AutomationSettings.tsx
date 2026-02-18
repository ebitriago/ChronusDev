'use client';

import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../app/apiHelper';

export default function AutomationSettings() {
    const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules');
    const [logs, setLogs] = useState<any[]>([]);
    const [rules, setRules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [triggerType, setTriggerType] = useState('INVOICE_DUE');
    const [offsetDays, setOffsetDays] = useState(0);
    const [channel, setChannel] = useState('EMAIL');
    const [template, setTemplate] = useState('');

    useEffect(() => {
        loadRules();
    }, []);

    useEffect(() => {
        if (activeTab === 'logs') loadLogs();
    }, [activeTab]);

    const loadRules = async () => {
        try {
            const data = await apiGet('/reminders');
            setRules(data as any[]);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    const loadLogs = async () => {
        try {
            setLoading(true);
            const data = await apiGet('/reminders/logs');
            setLogs(data as any[]);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiPost('/reminders', { name, triggerType, offsetDays, channel, template });
            setIsCreating(false);
            // Reset form
            setName('');
            setOffsetDays(0);
            setTemplate('');
            loadRules();
        } catch (error) {
            alert('Error creating rule');
        }
    };

    const handleTestValues = async () => {
        if (!confirm("Esto buscará facturas/eventos que coincidan y generará notificaciones reales. ¿Continuar?")) return;
        try {
            const res = await apiPost('/reminders/check', {}) as any;
            alert(`Proceso completado. Notificaciones enviadas: ${res.newNotifications}`);
            loadRules();
            if (activeTab === 'logs') loadLogs();
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    if (loading && rules.length === 0 && logs.length === 0) return <div className="p-8 text-center text-gray-500">Cargando...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Automatización</h3>
                    <p className="mt-1 text-sm text-gray-500">Configura recordatorios automáticos y revisa el historial.</p>
                </div>
                <div className="flex gap-2">
                    <div className="flex bg-gray-100 p-1 rounded-lg mr-4">
                        <button
                            onClick={() => setActiveTab('rules')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'rules' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                        >
                            Reglas
                        </button>
                        <button
                            onClick={() => setActiveTab('logs')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'logs' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                        >
                            Historial
                        </button>
                    </div>

                    <button
                        onClick={handleTestValues}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
                    >
                        Ejecutar Test Manual
                    </button>
                    {activeTab === 'rules' && (
                        <button
                            onClick={() => setIsCreating(true)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                        >
                            Nueva Regla
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'rules' && (
                <>
                    {isCreating && (
                        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                            <h4 className="text-md font-medium mb-4">Nueva Regla de Automatización</h4>
                            <form onSubmit={handleCreate} className="space-y-4 max-w-2xl">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nombre de la Regla</label>
                                    <input value={name} onChange={e => setName(e.target.value)} required className="w-full mt-1 px-3 py-2 border rounded-md" placeholder="Ej. Recordatorio de Pago" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Disparador (Trigger)</label>
                                        <select value={triggerType} onChange={e => setTriggerType(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-md">
                                            <option value="INVOICE_DUE">Vencimiento de Factura</option>
                                            <option value="BIRTHDAY">Cumpleaños</option>
                                            <option value="CUSTOM_DATE">Fecha Personalizada</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Canal</label>
                                        <select value={channel} onChange={e => setChannel(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-md">
                                            <option value="EMAIL">Email</option>
                                            <option value="WHATSAPP">WhatsApp</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Offset (Días)</label>
                                    <p className="text-xs text-gray-500 mb-1">-3 = 3 días antes del evento. 0 = El mismo día. 3 = 3 días después.</p>
                                    <input type="number" value={offsetDays} onChange={e => setOffsetDays(Number(e.target.value))} required className="w-full px-3 py-2 border rounded-md" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Mensaje / Plantilla</label>
                                    <textarea value={template} onChange={e => setTemplate(e.target.value)} required rows={3} className="w-full mt-1 px-3 py-2 border rounded-md" placeholder="Hola, te recordamos que tu factura vence pronto..." />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md text-sm">Guardar Regla</button>
                                    <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm">Cancelar</button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
                        <ul role="list" className="divide-y divide-gray-200">
                            {rules.map((rule) => (
                                <li key={rule.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <p className="text-sm font-medium text-indigo-600 truncate">{rule.name}</p>
                                            <p className="text-sm text-gray-500">
                                                {rule.triggerType} • Offset: {rule.offsetDays} días • {rule.channel}
                                            </p>
                                        </div>
                                        <div className="ml-2 flex-shrink-0 flex">
                                            <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${rule.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {rule.isActive ? 'Activo' : 'Inactivo'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-sm text-gray-500">
                                        <span className="font-mono text-xs bg-gray-100 p-1 rounded">{rule.template}</span>
                                    </div>
                                </li>
                            ))}
                            {rules.length === 0 && (
                                <li className="px-4 py-8 text-center text-gray-500">No hay reglas de automatización configuradas.</li>
                            )}
                        </ul>
                    </div>
                </>
            )}

            {activeTab === 'logs' && (
                <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Regla</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Canal</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entidad</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {logs.map((log) => (
                                <tr key={log.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(log.sentAt).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {log.reminder?.name || 'Regla eliminada'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {log.channel}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.status === 'SENT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {log.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {log.entityId || '-'}
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                        No hay historial de envíos reciente.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
