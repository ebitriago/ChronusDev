'use client';

import { useState, useEffect } from 'react';

type Lead = {
    id?: string;
    name: string;
    email: string;
    company?: string;
    value: number;
    status: string;
    notes?: string;
    source?: string;
};

interface LeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    leadToEdit?: Lead | null;
}

const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://127.0.0.1:3002';

export default function LeadModal({ isOpen, onClose, onSuccess, leadToEdit }: LeadModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Lead>({
        name: '',
        email: '',
        company: '',
        value: 0,
        status: 'NEW',
        notes: '',
        source: 'MANUAL'
    });

    useEffect(() => {
        if (leadToEdit) {
            setFormData(leadToEdit);
        } else {
            setFormData({
                name: '',
                email: '',
                company: '',
                value: 0,
                status: 'NEW',
                notes: '',
                source: 'MANUAL'
            });
        }
    }, [leadToEdit, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const url = leadToEdit ? `${API_URL}/leads/${leadToEdit.id}` : `${API_URL}/leads`;
            const method = leadToEdit ? 'PUT' : 'POST';

            const token = localStorage.getItem('crm_token');
            const headers: any = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(url, {
                method,
                headers,
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                alert('Error al guardar lead');
            }
        } catch (error) {
            console.error(error);
            alert('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900">{leadToEdit ? 'Editar Lead' : 'Nuevo Lead'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre</label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                            <input
                                type="email"
                                required
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empresa</label>
                            <input
                                type="text"
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                                value={formData.company || ''}
                                onChange={e => setFormData({ ...formData, company: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor Estimado ($)</label>
                            <input
                                type="number"
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                                value={formData.value}
                                onChange={e => setFormData({ ...formData, value: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado</label>
                        <select
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                        >
                            <option value="NEW">Nuevo (New)</option>
                            <option value="CONTACTED">Contactado</option>
                            <option value="QUALIFIED">Calificado</option>
                            <option value="NEGOTIATION">Negociación</option>
                            <option value="WON">Ganado (Won)</option>
                            <option value="LOST">Perdido (Lost)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notas</label>
                        <textarea
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 h-24 resize-none"
                            value={formData.notes || ''}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        ></textarea>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg text-sm bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'Guardando...' : 'Guardar Lead'}
                    </button>

                    {leadToEdit && (
                        <button
                            type="button"
                            onClick={async () => {
                                if (!confirm('¿Estás seguro de convertir este lead en cliente? Se eliminará de leads.')) return;
                                setLoading(true);
                                try {
                                    const token = localStorage.getItem('crm_token');
                                    const headers: any = { 'Content-Type': 'application/json' };
                                    if (token) headers['Authorization'] = `Bearer ${token}`;

                                    const res = await fetch(`${API_URL}/clients/from-lead/${leadToEdit.id}`, {
                                        method: 'POST',
                                        headers,
                                        body: JSON.stringify({ plan: 'STARTER' })
                                    });
                                    if (res.ok) {
                                        onSuccess();
                                        onClose();
                                        // Optional: Redirect to client page or show toast
                                    } else {
                                        alert('Error al convertir lead');
                                    }
                                } catch (err) {
                                    console.error(err);
                                    alert('Error de conexión');
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            className="w-full py-3 rounded-xl font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-colors text-sm"
                            disabled={loading}
                        >
                            ⚡ Convertir a Cliente
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}
