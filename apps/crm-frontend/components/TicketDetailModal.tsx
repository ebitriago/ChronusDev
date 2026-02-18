import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TicketDetailModalProps {
    ticket: any;
    onClose: () => void;
    onEdit?: (ticket: any) => void;
    onStatusChange?: (newStatus: string) => void;
}

export default function TicketDetailModal({ ticket, onClose, onEdit, onStatusChange }: TicketDetailModalProps) {
    if (!ticket) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] animate-fadeIn" onClick={onClose}>
            <div
                className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-slideUp m-4"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gray-50 p-6 border-b border-gray-100 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">
                                #{ticket.id.slice(-6).toUpperCase()}
                            </span>
                            {onStatusChange ? (
                                <select
                                    value={ticket.status}
                                    onChange={(e) => onStatusChange(e.target.value)}
                                    className={`text-xs font-bold px-2 py-1 rounded-full border-none cursor-pointer focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none ${ticket.status === 'OPEN' ? 'bg-red-100 text-red-700' :
                                        ticket.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                            ticket.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                                                'bg-gray-100 text-gray-700'
                                        }`}
                                >
                                    <option value="OPEN">OPEN</option>
                                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                                    <option value="RESOLVED">RESOLVED</option>
                                    <option value="CLOSED">CLOSED</option>
                                </select>
                            ) : (
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${ticket.status === 'OPEN' ? 'bg-red-100 text-red-700' :
                                    ticket.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                        ticket.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                                            'bg-gray-100 text-gray-700'
                                    }`}>
                                    {ticket.status}
                                </span>
                            )}
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${ticket.priority === 'URGENT' ? 'bg-red-50 text-red-700 border border-red-100' :
                                ticket.priority === 'HIGH' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                                    'bg-blue-50 text-blue-700 border border-blue-100'
                                }`}>
                                {ticket.priority}
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">{ticket.title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-900 transition-colors p-2 hover:bg-gray-200 rounded-full"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Cliente</label>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                    {ticket.customer?.name?.[0] || 'C'}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">{ticket.customer?.name || ticket.client?.name || 'Cliente Desconocido'}</p>
                                    <p className="text-xs text-gray-500">{ticket.customer?.email || ticket.client?.email}</p>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Asignado A</label>
                            {ticket.assignedTo ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                                        {ticket.assignedTo.name?.[0] || 'U'}
                                    </div>
                                    <p className="font-medium text-gray-900">{ticket.assignedTo.name}</p>
                                </div>
                            ) : (
                                <p className="text-gray-400 italic text-sm">Sin asignar</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Descripción</label>
                        <div className="bg-gray-50 p-4 rounded-xl text-gray-700 text-sm leading-relaxed whitespace-pre-wrap border border-gray-100">
                            {ticket.description || 'Sin descripción'}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Etiquetas</label>
                        <div className="flex flex-wrap gap-2">
                            {ticket.tags && ticket.tags.length > 0 ? (
                                ticket.tags.map((t: any) => (
                                    <span key={t.tag.id} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs border border-gray-200">
                                        #{t.tag.name}
                                    </span>
                                ))
                            ) : (
                                <span className="text-sm text-gray-400 italic">Sin etiquetas</span>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
                        <span>Creado el {ticket.createdAt ? format(new Date(ticket.createdAt), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es }) : '-'}</span>
                        {ticket.updatedAt && <span>Actualizado el {format(new Date(ticket.updatedAt), "d MMM, HH:mm", { locale: es })}</span>}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                    >
                        Cerrar
                    </button>
                    <button
                        className="px-4 py-2 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg shadow-black/10"
                    >
                        Responder / Editar
                    </button>
                </div>
            </div>
        </div>
    );
}
