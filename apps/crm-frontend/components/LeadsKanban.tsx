'use client';

import { useState, useEffect } from 'react';
import LeadModal from './LeadModal';

const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://127.0.0.1:3002';

type Lead = {
    id: string;
    name: string;
    email: string;
    company?: string;
    value: number;
    status: string;
    notes?: string;
    source: string;
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

export default function LeadsKanban() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingLead, setEditingLead] = useState<Lead | null>(null);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/leads`);
            if (res.ok) {
                const data = await res.json();
                setLeads(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, []);

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('leadId', id);
    };

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
        const id = e.dataTransfer.getData('leadId');
        if (!id) return;

        // Optimistic update
        const originalLeads = [...leads];
        const updatedLeads = leads.map(l => l.id === id ? { ...l, status: newStatus } : l);
        setLeads(updatedLeads);

        try {
            const res = await fetch(`${API_URL}/leads/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error('Failed to update');
        } catch (err) {
            console.error(err);
            setLeads(originalLeads); // Revert
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
                <button
                    onClick={() => { setEditingLead(null); setShowModal(true); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors text-sm font-bold shadow-lg shadow-emerald-500/20"
                >
                    + Nuevo Lead
                </button>
            </div>

            {loading ? (
                <div className="text-center text-gray-400 mt-20">Cargando pipeline...</div>
            ) : (
                <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
                    {Object.entries(STAGES).map(([status, config]) => (
                        <div
                            key={status}
                            className="w-80 flex-shrink-0 bg-gray-50 rounded-2xl flex flex-col max-h-full border border-gray-200/50"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, status)}
                        >
                            <div className={`p-4 border-b border-gray-100 rounded-t-2xl font-bold text-sm flex justify-between items-center bg-white sticky top-0 z-10`}>
                                <span className={`px-2 py-1 rounded-md text-xs ${config.color.replace('bg-', 'bg-opacity-20 ')}`}>
                                    {config.label}
                                </span>
                                <span className="text-gray-400 text-xs">{getLeadsByStatus(status).length}</span>
                            </div>

                            <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                {getLeadsByStatus(status).map(lead => (
                                    <div
                                        key={lead.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, lead.id)}
                                        onClick={() => { setEditingLead(lead); setShowModal(true); }}
                                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md cursor-grab active:cursor-grabbing transition-all hover:border-emerald-200 group"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-gray-800 text-sm">{lead.name}</h4>
                                            {lead.value > 0 && (
                                                <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                    ${lead.value.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mb-2 truncate">{lead.company || lead.email}</p>
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
            )}

            <LeadModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={fetchLeads}
                leadToEdit={editingLead}
            />
        </div>
    );
}
