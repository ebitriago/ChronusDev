'use client';

import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../app/apiHelper';

export default function CampaignsList() {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // New Campaign Form State
    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [segmentId, setSegmentId] = useState('');
    const [segments, setSegments] = useState<any[]>([]);

    useEffect(() => {
        loadCampaigns();
        loadSegments();
    }, []);

    const loadCampaigns = async () => {
        try {
            const data = await apiGet('/marketing/campaigns');
            setCampaigns(data as any[]);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadSegments = async () => {
        try {
            const data = await apiGet('/marketing/segments');
            setSegments(data as any[]);
        } catch (error) { console.error(error); }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiPost('/marketing/campaigns', { name, subject, content, segmentId });
            setIsCreating(false);
            setName('');
            setSubject('');
            setContent('');
            setSegmentId('');
            loadCampaigns();
        } catch (error) {
            alert('Error creating campaign');
        }
    };

    const handleSend = async (id: string) => {
        if (!confirm('¿Estás seguro de enviar esta campaña ahora?')) return;
        try {
            await apiPost(`/marketing/campaigns/${id}/send`, {});
            alert('Envío iniciado');
            loadCampaigns();
        } catch (error: any) {
            alert('Error: ' + error.message);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando campañas...</div>;

    if (isCreating) {
        return (
            <div className="p-6">
                <h3 className="text-lg font-medium mb-4">Nueva Campaña</h3>
                <form onSubmit={handleCreate} className="space-y-4 max-w-2xl">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nombre Interno</label>
                        <input value={name} onChange={e => setName(e.target.value)} required className="w-full mt-1 px-3 py-2 border rounded-md" placeholder="Newsletter Enero" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Asunto del Correo</label>
                        <input value={subject} onChange={e => setSubject(e.target.value)} required className="w-full mt-1 px-3 py-2 border rounded-md" placeholder="¡Ofertas Especiales!" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Lista de Destino</label>
                        <select value={segmentId} onChange={e => setSegmentId(e.target.value)} required className="w-full mt-1 px-3 py-2 border rounded-md">
                            <option value="">Seleccionar Lista...</option>
                            {segments.map(s => <option key={s.id} value={s.id}>{s.name} ({s._count?.customers || 0} contactos)</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Contenido (HTML)</label>
                        <textarea value={content} onChange={e => setContent(e.target.value)} required rows={6} className="w-full mt-1 px-3 py-2 border rounded-md font-mono text-sm" placeholder="<h1>Hola!</h1>..." />
                    </div>
                    <div className="flex gap-2 pt-4">
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md">Guardar Borrador</button>
                        <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md">Cancelar</button>
                    </div>
                </form>
            </div>
        )
    }

    return (
        <div className="p-6">
            <div className="flex justify-between mb-4">
                <h3 className="text-lg font-medium">Campañas de Email</h3>
                <button
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                >
                    Nueva Campaña
                </button>
            </div>

            <div className="space-y-4">
                {campaigns.map(campaign => (
                    <div key={campaign.id} className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors flex justify-between items-center">
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="font-medium text-gray-900">{campaign.name}</h4>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${campaign.status === 'SENT' ? 'bg-green-100 text-green-800' :
                                    campaign.status === 'SENDING' ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                    {campaign.status}
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">Asunto: {campaign.subject}</p>
                            <div className="text-xs text-gray-400 mt-2 flex gap-4">
                                <span>Lista: {campaign.segment?.name || '---'}</span>
                                <span>Creado: {new Date(campaign.createdAt).toLocaleDateString()}</span>
                                {campaign.status === 'SENT' && <span>Enviados: {campaign.sentCount}</span>}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {campaign.status === 'DRAFT' && (
                                <button
                                    onClick={() => handleSend(campaign.id)}
                                    className="px-3 py-1.5 border border-indigo-600 text-indigo-600 rounded text-sm hover:bg-indigo-50 font-medium"
                                >
                                    Enviar Ahora
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {campaigns.length === 0 && (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
                        No has creado ninguna campaña aún.
                    </div>
                )}
            </div>
        </div>
    );
}
