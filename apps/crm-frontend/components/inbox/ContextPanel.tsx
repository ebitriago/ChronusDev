'use client';

import { useState } from 'react';
import { Conversation, MatchedClient, PLATFORM_CONFIG } from './types';
import { API_URL, getHeaders } from '../../app/api';

type ContextPanelProps = {
    selectedConversation: Conversation | null;
    matchedClient: MatchedClient | null;
    onCreateClient: () => void;
    onLinkClient: () => void;
    onView360: () => void;
    onCreateLead: () => void;
    onCreateTicket: () => void;
    showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
    onBack?: () => void;
};

export default function ContextPanel({
    selectedConversation,
    matchedClient,
    onCreateClient,
    onLinkClient,
    onView360,
    onCreateLead,
    onCreateTicket,
    showToast,
    onBack
}: ContextPanelProps) {
    if (!selectedConversation) {
        return (
            <div className="w-full lg:w-72 border-l border-gray-100 bg-white p-4 hidden lg:flex flex-col h-full">
                <div className="flex-1 flex items-center justify-center text-gray-300">
                    <p className="text-sm">Sin contexto</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full lg:w-72 border-l border-gray-100 bg-white p-4 flex flex-col h-full overflow-y-auto">
            {/* Mobile Back Button */}
            {onBack && (
                <button
                    onClick={onBack}
                    className="mb-4 flex items-center gap-2 text-gray-500 hover:text-gray-900 lg:hidden"
                >
                    <span>← Volver al chat</span>
                </button>
            )}

            {/* Contact Avatar & Info */}
            <div className="text-center mb-4 pb-4 border-b border-gray-100">
                <div className={`w-14 h-14 xl:w-16 xl:h-16 rounded-full mx-auto mb-2 flex items-center justify-center text-xl xl:text-2xl text-white shadow-lg ${PLATFORM_CONFIG[selectedConversation.platform]?.color}`}>
                    {selectedConversation.customerName?.charAt(0) || '?'}
                </div>
                <h3 className="font-bold text-gray-900 text-sm">{selectedConversation.customerName || 'Visitante'}</h3>
                <p className="text-xs text-gray-500 truncate">{selectedConversation.customerContact}</p>
            </div>

            {/* Client Status */}
            <div className="mb-4">
                {matchedClient ? (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">✅</span>
                            <span className="text-xs font-bold text-emerald-700">Cliente Vinculado</span>
                        </div>
                        <p className="text-sm font-bold text-emerald-800">{matchedClient.name}</p>

                        {/* Quick Client Info */}
                        <div className="mt-2 space-y-1 text-xs text-gray-600">
                            {matchedClient.email && (
                                <p className="truncate">📧 {matchedClient.email}</p>
                            )}
                            {matchedClient.phone && (
                                <p>📱 {matchedClient.phone}</p>
                            )}
                            {matchedClient.company && (
                                <p className="truncate">🏢 {matchedClient.company}</p>
                            )}
                            {matchedClient.plan && (
                                <p className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${matchedClient.plan === 'PREMIUM' ? 'bg-purple-100 text-purple-700' :
                                    matchedClient.plan === 'PRO' ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                    {matchedClient.plan}
                                </p>
                            )}
                        </div>

                        <button
                            onClick={onView360}
                            className="mt-3 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold w-full hover:bg-emerald-700 transition-colors"
                        >
                            Ver Vista 360° →
                        </button>
                    </div>
                ) : (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">❓</span>
                            <span className="text-xs font-bold text-amber-700">Contacto Nuevo</span>
                        </div>
                        <button
                            onClick={onCreateClient}
                            className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-bold w-full hover:bg-amber-600 transition-colors"
                        >
                            + Crear Cliente
                        </button>
                        <button
                            onClick={onLinkClient}
                            className="mt-2 text-xs bg-white text-amber-600 px-3 py-1.5 rounded-lg border border-amber-300 font-bold w-full hover:bg-amber-50 transition-colors"
                        >
                            🔗 Vincular a Cliente
                        </button>
                    </div>
                )}
            </div>

            {/* Channel & Stats */}
            <div className="space-y-2 mb-4">
                <div className="p-2.5 bg-gray-50 rounded-lg flex justify-between items-center">
                    <span className="text-xs text-gray-600">Canal</span>
                    <span className="text-xs font-bold text-gray-800">{PLATFORM_CONFIG[selectedConversation.platform]?.label}</span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg flex justify-between items-center">
                    <span className="text-xs text-gray-600">Mensajes</span>
                    <span className="text-xs font-bold text-gray-800">{selectedConversation.messages.length}</span>
                </div>
            </div>

            {/* Actions */}
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <h4 className="font-bold text-blue-800 text-xs mb-2">Acciones</h4>
                <button
                    onClick={onCreateLead}
                    className="text-xs bg-white text-blue-600 px-3 py-1.5 rounded border border-blue-200 font-bold w-full hover:bg-blue-50 transition-colors"
                >
                    + Crear Lead
                </button>
                <button
                    onClick={onCreateTicket}
                    disabled={!matchedClient}
                    title={!matchedClient ? "Vincula un cliente para crear un ticket" : "Crear nuevo ticket"}
                    className={`mt-2 text-xs px-3 py-1.5 rounded border font-bold w-full transition-colors ${!matchedClient
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50'
                        }`}
                >
                    + Crear Ticket
                </button>
                <div className="mt-4 pt-4 border-t border-blue-200">
                    <button
                        onClick={() => {
                            import('../../app/api').then(mod => {
                                mod.exportConversation(selectedConversation.sessionId, 'txt')
                                    .then(() => showToast('Conversación descargada', 'success'))
                                    .catch(() => showToast('Error al descargar', 'error'));
                            });
                        }}
                        className="flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-800 w-full transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Descargar Chat (TXT)
                    </button>
                </div>
            </div>
        </div>
    );
}
