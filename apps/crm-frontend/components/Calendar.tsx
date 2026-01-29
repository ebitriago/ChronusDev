'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://localhost:3002';

type CalendarEvent = {
    id: string;
    summary: string;
    description?: string;
    start: string;
    end: string;
    location?: string;
    htmlLink?: string;
    meetLink?: string;
};

export default function Calendar() {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [newEvent, setNewEvent] = useState({ summary: '', description: '', start: '', end: '', attendees: '' });

    useEffect(() => {
        fetchEvents();
    }, []);

    async function fetchEvents() {
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/calendar/events`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                if (res.status === 401) throw new Error("No conectado a Google Calendar");
                throw new Error("Error al cargar eventos");
            }
            const data = await res.json();
            setEvents(data.events || []);
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateEvent() {
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/calendar/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...newEvent,
                    start: new Date(newEvent.start).toISOString(),
                    end: new Date(newEvent.end).toISOString(),
                    attendees: newEvent.attendees.split(',').map(e => e.trim()).filter(Boolean)
                })
            });

            if (res.ok) {
                setShowModal(false);
                setNewEvent({ summary: '', description: '', start: '', end: '', attendees: '' });
                fetchEvents();
            } else {
                alert("Error al crear evento");
            }
        } catch (err) {
            console.error(err);
        }
    }

    /* Simplified Auth Flow Trigger */
    function connectGoogle() {
        window.location.href = `${API_URL}/auth/google`;
    }

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando calendario...</div>;

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Calendario</h2>
                <div className="flex gap-2">
                    {!events.length && error && (
                        <button onClick={connectGoogle} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-blue-700 transition">
                            Conectar Google Calendar
                        </button>
                    )}
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors text-sm font-bold shadow-lg"
                    >
                        + Nuevo Evento
                    </button>
                </div>
            </div>

            {error && !events.length ? (
                <div className="bg-orange-50 text-orange-700 p-4 rounded-xl border border-orange-100 flex flex-col items-center">
                    <p className="mb-2">⚠️ {error}</p>
                    <button onClick={connectGoogle} className="text-sm underline font-bold">Conectar ahora</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Próximos Eventos</h3>
                        <div className="space-y-3">
                            {events.length === 0 && <p className="text-gray-400 text-sm">No hay eventos próximos.</p>}
                            {events.map(event => (
                                <div key={event.id} className="flex gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100 group">
                                    <div className="flex flex-col items-center justify-center bg-emerald-50 text-emerald-700 rounded-lg w-14 h-14 shrink-0">
                                        <span className="text-xs font-bold uppercase">{new Date(event.start).toLocaleString('es-ES', { month: 'short' })}</span>
                                        <span className="text-xl font-bold">{new Date(event.start).getDate()}</span>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-800 line-clamp-1">{event.summary}</h4>
                                        <p className="text-xs text-gray-500 line-clamp-2">{event.description || 'Sin descripción'}</p>
                                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                                            <span>⏰ {new Date(event.start).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                                            {event.meetLink && <a href={event.meetLink} target="_blank" className="text-blue-600 hover:underline flex items-center gap-1">📹 Google Meet</a>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Nuevo Evento</h3>
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Título del evento"
                                className="w-full p-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
                                value={newEvent.summary}
                                onChange={e => setNewEvent({ ...newEvent, summary: e.target.value })}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500">Inicio</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full p-2 border border-gray-200 rounded-xl text-sm"
                                        value={newEvent.start}
                                        onChange={e => setNewEvent({ ...newEvent, start: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Fin</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full p-2 border border-gray-200 rounded-xl text-sm"
                                        value={newEvent.end}
                                        onChange={e => setNewEvent({ ...newEvent, end: e.target.value })}
                                    />
                                </div>
                            </div>
                            <textarea
                                placeholder="Descripción"
                                className="w-full p-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 h-24"
                                value={newEvent.description}
                                onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                            />
                            <input
                                type="text"
                                placeholder="Invitados (emails separados por coma)"
                                className="w-full p-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
                                value={newEvent.attendees}
                                onChange={e => setNewEvent({ ...newEvent, attendees: e.target.value })}
                            />
                            <div className="flex gap-3 pt-4">
                                <button onClick={handleCreateEvent} className="flex-1 bg-emerald-600 text-white py-2 rounded-xl font-bold hover:bg-emerald-700">Guardar</button>
                                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-xl">Cancelar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
