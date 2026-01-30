'use client';

import { useState } from 'react';
import { useToast } from './Toast';
import { API_URL } from '../app/api';

type ScheduleInteractionModalProps = {
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    onClose: () => void;
};

type InteractionType = 'VOICE' | 'WHATSAPP' | 'EMAIL';

export default function ScheduleInteractionModal({ customerId, customerName, customerPhone, customerEmail, onClose }: ScheduleInteractionModalProps) {
    const [scheduledAt, setScheduledAt] = useState('');
    const [type, setType] = useState<InteractionType>('VOICE');
    const [content, setContent] = useState('');
    const [subject, setSubject] = useState('');
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    const handleSchedule = async () => {
        if (!scheduledAt) {
            alert('Selecciona fecha y hora');
            return;
        }
        if ((type === 'WHATSAPP' || type === 'EMAIL') && !content) {
            alert('El mensaje es requerido');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                customerId,
                scheduledAt,
                type,
                content: (type === 'WHATSAPP' || type === 'EMAIL') ? content : undefined,
                subject: type === 'EMAIL' ? subject : undefined,
                metadata: {
                    customer_name: customerName,
                    call_reason: type === 'VOICE' ? content : undefined // For voice, content is the "reason"
                }
            };

            const res = await fetch(`${API_URL}/interactions/schedule`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showToast('Interacción programada exitosamente', 'success');
                onClose();
            } else {
                const data = await res.json();
                alert('Error: ' + data.error);
            }
        } catch (err) {
            console.error(err);
            alert('Error al programar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fadeIn">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Programar Interacción</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div className="space-y-4">
                    {/* Type Selector */}
                    <div className="flex p-1 bg-gray-100 rounded-xl">
                        {(['VOICE', 'WHATSAPP', 'EMAIL'] as InteractionType[]).map(t => (
                            <button
                                key={t}
                                onClick={() => setType(t)}
                                className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${type === t
                                    ? 'bg-white text-emerald-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {t === 'VOICE' ? '📞 Llamada' : t === 'WHATSAPP' ? '💬 WhatsApp' : '✉️ Email'}
                            </button>
                        ))}
                    </div>

                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                        <p className="text-sm text-orange-800 font-medium">Cliente: {customerName}</p>
                        <p className="text-xs text-orange-600">
                            {type === 'EMAIL' ? `Email: ${customerEmail || 'No registrado'}` : `Teléfono: ${customerPhone}`}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y Hora</label>
                        <input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={e => setScheduledAt(e.target.value)}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        />
                    </div>

                    {type === 'EMAIL' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                placeholder="Asunto del correo..."
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {type === 'VOICE' ? 'Contexto / Razón' : 'Mensaje'}
                        </label>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                            placeholder={type === 'VOICE' ? "Razón de la llamada (para la IA)..." : "Escribe tu mensaje aquí..."}
                        />
                        {type === 'VOICE' && (
                            <p className="text-xs text-gray-500 mt-1">
                                Esta información se enviará al Agente de IA para personalizar la llamada.
                            </p>
                        )}
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSchedule}
                            disabled={loading || (type === 'EMAIL' && !customerEmail)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Programando...' : 'Programar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
