'use client';

import { useState, useEffect } from 'react';
import LeadModal from './LeadModal';

import { API_URL } from '../app/api';
import { io, Socket } from 'socket.io-client';
import { useToast } from './Toast';

type Lead = {
    id: string;
    name: string;
    email: string;
    company?: string;
    value: number;
    status: string;
    notes?: string;
    source: string;
    tags?: string[];
    score?: number;
    createdAt: string;
};

const STAGES = {
    'NEW': { label: 'Nuevo', color: 'bg-blue-50 text-blue-700 border-blue-100' },
    'CONTACTED': { label: 'Contactado', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    'QUALIFIED': { label: 'Calificado', color: 'bg-amber-50 text-amber-700 border-amber-100' },
    'NEGOTIATION': { label: 'Negociación', color: 'bg-purple-50 text-purple-700 border-purple-100' },
    'WON': { label: 'Ganado', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    'LOST': { label: 'Perdido', color: 'bg-gray-50 text-gray-500 border-gray-100' },
};


import PipelineSettings from './PipelineSettings';

export default function LeadsKanban() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [stages, setStages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showPipelineSettings, setShowPipelineSettings] = useState(false);

    // Tag Filters
    const [filterTags, setFilterTags] = useState<string[]>([]);
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [showTagFilter, setShowTagFilter] = useState(false);

    const [editingLead, setEditingLead] = useState<Lead | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importJson, setImportJson] = useState('');
    const [importing, setImporting] = useState(false);
    const { showToast } = useToast();

    const fetchPipeline = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('crm_token');
            const headers: any = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const [leadsRes, stagesRes, tagsRes] = await Promise.all([
                fetch(`${API_URL}/leads${filterTags.length > 0 ? `?tags=${filterTags.join(',')}` : ''}`, { headers }),
                fetch(`${API_URL}/pipeline-stages`, { headers }),
                fetch(`${API_URL}/tags`, { headers })
            ]);

            if (leadsRes.ok && stagesRes.ok) {
                const leadsData = await leadsRes.json();
                let stagesData = await stagesRes.json();

                // CRITICAL: Si no hay stages, usar valores por defecto
                if (!stagesData || stagesData.length === 0) {
                    console.warn('⚠️ No pipeline stages found, using defaults');
                    stagesData = [
                        { id: '1', name: 'Nuevo', color: 'bg-blue-50 text-blue-700 border-blue-100', order: 1 },
                        { id: '2', name: 'Contactado', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', order: 2 },
                        { id: '3', name: 'Calificado', color: 'bg-amber-50 text-amber-700 border-amber-100', order: 3 },
                        { id: '4', name: 'Negociación', color: 'bg-purple-50 text-purple-700 border-purple-100', order: 4 },
                        { id: '5', name: 'Ganado', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', order: 5 },
                        { id: '6', name: 'Perdido', color: 'bg-gray-50 text-gray-500 border-gray-100', order: 6 },
                    ];
                }

                setLeads(leadsData || []);
                setStages(stagesData);

                if (tagsRes.ok) {
                    const tagsData = await tagsRes.json();
                    setAvailableTags(tagsData.map((t: any) => t.name));
                }

                console.log('✅ Pipeline loaded:', { leads: leadsData?.length || 0, stages: stagesData?.length || 0 });
            } else {
                console.error('❌ Failed to fetch pipeline:', {
                    leadsStatus: leadsRes.status,
                    stagesStatus: stagesRes.status
                });

                // Usar stages por defecto incluso en error
                setStages([
                    { id: '1', name: 'Nuevo', color: 'bg-blue-50 text-blue-700 border-blue-100', order: 1 },
                    { id: '2', name: 'Contactado', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', order: 2 },
                    { id: '3', name: 'Calificado', color: 'bg-amber-50 text-amber-700 border-amber-100', order: 3 },
                    { id: '4', name: 'Negociación', color: 'bg-purple-50 text-purple-700 border-purple-100', order: 4 },
                    { id: '5', name: 'Ganado', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', order: 5 },
                    { id: '6', name: 'Perdido', color: 'bg-gray-50 text-gray-500 border-gray-100', order: 6 },
                ]);
                setLeads([]);
            }
        } catch (err) {
            console.error('❌ Error fetching pipeline:', err);

            // CRITICAL: Siempre mostrar stages por defecto en caso de error
            setStages([
                { id: '1', name: 'Nuevo', color: 'bg-blue-50 text-blue-700 border-blue-100', order: 1 },
                { id: '2', name: 'Contactado', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', order: 2 },
                { id: '3', name: 'Calificado', color: 'bg-amber-50 text-amber-700 border-amber-100', order: 3 },
                { id: '4', name: 'Negociación', color: 'bg-purple-50 text-purple-700 border-purple-100', order: 4 },
                { id: '5', name: 'Ganado', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', order: 5 },
                { id: '6', name: 'Perdido', color: 'bg-gray-50 text-gray-500 border-gray-100', order: 6 },
            ]);
            setLeads([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPipeline();
    }, [filterTags]); // Refresh on filter change

    useEffect(() => {

        // Socket connection
        const token = localStorage.getItem('crm_token');
        const socketUrl = API_URL.startsWith('http') ? API_URL : undefined;
        const socket = io(socketUrl, {
            path: '/api/socket.io',
            auth: { token },
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => console.log('✅ Leads socket connected'));

        socket.on('lead.created', (data: { lead?: Lead; leads?: Lead[]; count?: number }) => {
            console.log('🚀 Real-time lead received:', data);

            setLeads(prev => {
                const currentIds = new Set(prev.map(l => l.id));
                const newLeads: Lead[] = [];

                if (data.lead && !currentIds.has(data.lead.id)) {
                    newLeads.push(data.lead);
                }

                if (data.leads && Array.isArray(data.leads)) {
                    data.leads.forEach(l => {
                        if (!currentIds.has(l.id)) newLeads.push(l);
                    });
                }

                if (newLeads.length > 0) {
                    showToast(`received ${newLeads.length} new leads`, 'success');
                    return [...prev, ...newLeads];
                }
                return prev;
            });
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const handleImport = async () => {
        try {
            const parsed = JSON.parse(importJson);
            const leadsToImport = parsed.leads || parsed;

            if (!Array.isArray(leadsToImport)) {
                alert("Formato inválido: se espera un array de leads o un objeto con propiedad 'leads'.");
                return;
            }

            setImporting(true);
            const res = await fetch(`${API_URL}/leads/bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                },
                body: JSON.stringify({ leads: leadsToImport })
            });

            if (res.ok) {
                const data = await res.json();
                showToast(`Importados ${data.count} leads exitosamente`, 'success');
                setImportJson('');
                setShowImportModal(false);
                fetchPipeline(); // Refresh to be sure
            } else {
                const err = await res.json();
                alert("Error al importar: " + err.error);
            }
        } catch (e) {
            alert("JSON inválido");
        } finally {
            setImporting(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const content = evt.target?.result as string;
            if (file.name.endsWith('.json')) {
                setImportJson(content);
            } else if (file.name.endsWith('.csv')) {
                // Simple CSV Parser
                const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
                if (lines.length < 2) return alert('El CSV está vacío o no tiene cabeceras');

                const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
                const leads = [];

                for (let i = 1; i < lines.length; i++) {
                    // Handle comma inside quotes simply (basic regex split) or just simple split for now
                    // For robust parsing without lib, we assume simple CSV
                    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));

                    if (values.length !== headers.length) continue;

                    const lead: any = {};
                    headers.forEach((header, index) => {
                        if (header === 'nombre' || header === 'name') lead.name = values[index];
                        else if (header === 'email' || header === 'correo') lead.email = values[index];
                        else if (header === 'empresa' || header === 'company') lead.company = values[index];
                        else if (header === 'valor' || header === 'value') lead.value = Number(values[index]) || 0;
                        else if (header === 'estado' || header === 'status') lead.status = values[index];
                    });

                    if (lead.name || lead.email) {
                        if (!lead.status) lead.status = 'Nuevo';
                        leads.push(lead);
                    }
                }
                setImportJson(JSON.stringify({ leads }, null, 2));
            }
        };
        reader.readAsText(file);
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('leadId', id);
    };

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
        const id = e.dataTransfer.getData('leadId');
        if (!id) return;

        const originalLeads = [...leads];
        const updatedLeads = leads.map(l => l.id === id ? { ...l, status: newStatus } : l);
        setLeads(updatedLeads);

        try {
            const res = await fetch(`${API_URL}/leads/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error('Failed to update');
        } catch (err) {
            console.error(err);
            setLeads(originalLeads);
            alert("Error actualizando el estado");
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const getLeadsByStatus = (status: string) => leads.filter(l => l.status === status);

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col animate-fadeIn">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Leads Pipeline</h2>
                    <p className="text-sm text-gray-500">Gestión de prospectos y oportunidades</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 flex items-center gap-2"
                    >
                        📥 Importar
                    </button>
                    <button
                        onClick={() => setShowPipelineSettings(true)}
                        className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50"
                    >
                        ⚙️ Pipeline
                    </button>
                    <button
                        onClick={() => { setEditingLead(null); setShowModal(true); }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors text-sm font-bold shadow-lg shadow-emerald-500/20"
                    >
                        + Nuevo Lead
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="mb-4 flex items-center gap-2">
                <div className="relative">
                    <button
                        onClick={() => setShowTagFilter(!showTagFilter)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border flex items-center gap-2 transition-colors ${filterTags.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                        🏷️ Filtrar por Etiquetas {filterTags.length > 0 && `(${filterTags.length})`}
                    </button>

                    {showTagFilter && (
                        <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-gray-100 rounded-xl shadow-xl w-64 p-2 animate-fadeIn">
                            <div className="flex flex-wrap gap-1 max-h-60 overflow-y-auto">
                                {availableTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => {
                                            if (filterTags.includes(tag)) {
                                                setFilterTags(filterTags.filter(t => t !== tag));
                                            } else {
                                                setFilterTags([...filterTags, tag]);
                                            }
                                        }}
                                        className={`px-2 py-1 rounded text-xs font-medium border ${filterTags.includes(tag) ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100'}`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                                {availableTags.length === 0 && <span className="text-xs text-gray-400 p-2">No hay etiquetas disponibles</span>}
                            </div>
                            {filterTags.length > 0 && (
                                <button
                                    onClick={() => setFilterTags([])}
                                    className="w-full text-center text-xs text-red-500 mt-2 hover:underline"
                                >
                                    Limpiar filtros
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {filterTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {filterTags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs flex items-center gap-1">
                                {tag}
                                <button onClick={() => setFilterTags(filterTags.filter(t => t !== tag))} className="hover:text-red-500">×</button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {
                loading ? (
                    <div className="text-center text-gray-400 mt-20">Cargando pipeline...</div>
                ) : (
                    <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
                        {stages.map((stage) => (
                            <div
                                key={stage.id}
                                className="w-80 flex-shrink-0 bg-gray-50 rounded-2xl flex flex-col max-h-full border border-gray-200/50"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, stage.name)}
                            >
                                <div className={`p-4 border-b border-gray-100 rounded-t-2xl font-bold text-sm flex justify-between items-center bg-white sticky top-0 z-10`}>
                                    <span className={`px-2 py-1 rounded-md text-xs ${stage.color || 'bg-gray-100 text-gray-700'}`}>
                                        {stage.name}
                                    </span>
                                    <span className="text-gray-400 text-xs">{getLeadsByStatus(stage.name).length}</span>
                                </div>

                                <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                    {getLeadsByStatus(stage.name).map(lead => (
                                        <div
                                            key={lead.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, lead.id)}
                                            onClick={() => { setEditingLead(lead); setShowModal(true); }}
                                            className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md cursor-grab active:cursor-grabbing transition-all hover:border-emerald-200 group"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-gray-800 text-sm">{lead.name}</h4>
                                                <div className="flex items-center gap-1">
                                                    {/* Lead Score Badge */}
                                                    {lead.score !== undefined && (
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${lead.score >= 70 ? 'bg-emerald-100 text-emerald-700' :
                                                            lead.score >= 40 ? 'bg-amber-100 text-amber-700' :
                                                                'bg-red-100 text-red-600'
                                                            }`}>
                                                            📊 {lead.score}
                                                        </span>
                                                    )}
                                                    {lead.value > 0 && (
                                                        <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                            ${lead.value.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 mb-2 truncate">{lead.company || lead.email}</p>
                                            {/* Tags */}
                                            {lead.tags && lead.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mb-2">
                                                    {lead.tags.slice(0, 3).map((tag, i) => (
                                                        <span key={i} className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center text-[10px] text-gray-400">
                                                <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                                                <span className="uppercase tracking-wider font-semibold opacity-60">{lead.source}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }

            <LeadModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={fetchPipeline}
                leadToEdit={editingLead}
                stages={stages}
            />

            <PipelineSettings
                isOpen={showPipelineSettings}
                onClose={() => setShowPipelineSettings(false)}
                onSuccess={fetchPipeline}
            />

            {/* Import Modal */}
            {
                showImportModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-lg text-gray-800">Importar Leads (JSON)</h3>
                                <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                            </div>
                            <div className="p-6">
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Subir archivo (CSV o JSON)</label>
                                    <input
                                        type="file"
                                        accept=".csv,.json"
                                        onChange={handleFileUpload}
                                        className="block w-full text-sm text-gray-500
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-full file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-emerald-50 file:text-emerald-700
                                        hover:file:bg-emerald-100
                                    "
                                    />
                                    <p className="text-xs text-gray-400 mt-1">CSV: name, email, company, value, status</p>
                                </div>
                                <p className="text-sm text-gray-500 mb-2">O pega tu JSON aquí (Max 500 leads):</p>
                                <textarea
                                    value={importJson}
                                    onChange={e => setImportJson(e.target.value)}
                                    className="w-full h-40 p-4 border border-gray-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-gray-50"
                                    placeholder={`{ "leads": [ { "name": "Ejemplo", "email": "admin@test.com" } ] }`}
                                />
                            </div>
                            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                                <button
                                    onClick={() => setShowImportModal(false)}
                                    className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={importing || !importJson.trim()}
                                    className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/30 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {importing ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '🚀 Importar Leads'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
