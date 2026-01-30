'use client';

import { useState, useEffect } from 'react';
import {
    format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
    isToday, parseISO, startOfDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import { API_URL } from '../app/api';

type CalendarEvent = {
    id: string;
    summary: string;
    description?: string;
    start: string;
    end: string;
    location?: string;
    htmlLink?: string;
    meetLink?: string;
    attendees?: string[];
};

type ConnectionStatus = {
    configured: boolean;
    connected: boolean;
    connectedAt?: string;
};

export default function Calendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [newEvent, setNewEvent] = useState({ summary: '', description: '', start: '', end: '', attendees: '' });
    const [creating, setCreating] = useState(false);

    // Connection status
    const [status, setStatus] = useState<ConnectionStatus | null>(null);

    // Check connection status on mount
    useEffect(() => {
        checkConnectionStatus();
    }, []);

    // Fetch events when month changes or after connecting
    useEffect(() => {
        if (status?.connected) {
            fetchEvents();
        }
    }, [currentDate, status?.connected]);

    async function checkConnectionStatus() {
        try {
            const token = localStorage.getItem('crm_token');
            if (!token) return;

            const res = await fetch(`${API_URL}/calendar/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setStatus(data);
                if (!data.connected) {
                    setLoading(false);
                }
            }
        } catch (err) {
            console.error('Error checking calendar status:', err);
            setLoading(false);
        }
    }

    async function fetchEvents() {
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('crm_token');
            if (!token) return;

            // Calculate range for the view (include padding days from prev/next months)
            const weekStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
            const weekEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });

            const params = new URLSearchParams({
                start: weekStart.toISOString(),
                end: weekEnd.toISOString()
            });

            const res = await fetch(`${API_URL}/calendar/events?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                const data = await res.json();
                if (res.status === 401 && data.notConnected) {
                    setStatus(prev => prev ? { ...prev, connected: false } : { configured: true, connected: false });
                    throw new Error("Google Calendar no conectado");
                }
                throw new Error(data.error || "Error al cargar eventos");
            }

            const data = await res.json();
            setEvents(data || []);
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateEvent() {
        if (!newEvent.summary || !newEvent.start || !newEvent.end) {
            alert("Por favor complete los campos requeridos");
            return;
        }

        setCreating(true);
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
                const data = await res.json();
                alert(data.error || "Error al crear evento");
            }
        } catch (err) {
            console.error(err);
            alert("Error de conexión");
        } finally {
            setCreating(false);
        }
    }

    function connectGoogle() {
        window.location.href = `${API_URL}/calendar/connect`;
    }

    function openNewEventModal(date?: Date) {
        const startDate = date ? startOfDay(date) : new Date();
        if (!date) {
            startDate.setMinutes(0, 0, 0);
            startDate.setHours(startDate.getHours() + 1);
        } else {
            startDate.setHours(9, 0, 0, 0);
        }

        const endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + 1);

        const formatForInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

        setNewEvent({
            summary: '',
            description: '',
            start: formatForInput(startDate),
            end: formatForInput(endDate),
            attendees: ''
        });
        setShowModal(true);
    }

    // Calendar Grid Generation
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

    const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    const getEventsForDay = (day: Date) => {
        return events.filter(event => {
            try {
                return isSameDay(parseISO(event.start), day);
            } catch {
                return false;
            }
        });
    };

    // Not connected view
    if (status && !status.connected) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Conecta tu Calendario</h2>
                    <p className="text-gray-500 mb-6">
                        Sincroniza tu Google Calendar para ver y crear eventos directamente desde el CRM.
                    </p>

                    {!status.configured ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                            <p className="text-sm text-amber-800">
                                ⚠️ La integración de Google Calendar no está configurada. Contacta al administrador.
                            </p>
                        </div>
                    ) : (
                        <button
                            onClick={connectGoogle}
                            className="w-full bg-white border-2 border-gray-200 text-gray-800 px-6 py-3 rounded-xl font-bold hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-3 group"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            <span className="group-hover:text-blue-600 transition-colors">Conectar con Google</span>
                        </button>
                    )}

                    <p className="text-xs text-gray-400 mt-4">
                        Se te pedirá permiso para acceder a tu calendario.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fadeIn h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800 capitalize">
                        {format(currentDate, 'MMMM yyyy', { locale: es })}
                    </h2>
                    <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                        <button
                            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                            className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-md transition shadow-sm text-gray-600 hover:text-gray-900"
                        >
                            ←
                        </button>
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="px-3 text-sm font-bold text-gray-600 hover:text-black hover:bg-white rounded-md transition"
                        >
                            Hoy
                        </button>
                        <button
                            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                            className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-md transition shadow-sm text-gray-600 hover:text-gray-900"
                        >
                            →
                        </button>
                    </div>
                    {loading && (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-500 border-t-transparent"></div>
                    )}
                </div>

                <div className="flex gap-2 items-center">
                    {status?.connected && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            Google conectado
                        </div>
                    )}
                    <button
                        onClick={() => openNewEventModal()}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors text-sm font-bold shadow-lg flex items-center gap-2"
                    >
                        <span>+</span> Nuevo Evento
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-[550px] overflow-hidden">
                {/* Days Header */}
                <div className="grid grid-cols-7 border-b border-gray-100">
                    {weekDays.map(day => (
                        <div key={day} className="py-2 text-center text-xs font-bold text-gray-500 bg-gray-50 uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 flex-1">
                    {calendarDays.map((day) => {
                        const dayEvents = getEventsForDay(day);
                        const isCurrentMonth = isSameMonth(day, monthStart);

                        return (
                            <div
                                key={day.toString()}
                                onClick={() => openNewEventModal(day)}
                                className={`
                                    min-h-[80px] border-b border-r border-gray-50 p-1.5 transition-colors hover:bg-gray-50 cursor-pointer relative
                                    ${!isCurrentMonth ? 'bg-gray-50/30' : 'bg-white'}
                                    ${isToday(day) ? 'bg-blue-50/40' : ''}
                                `}
                            >
                                <div className={`
                                    text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1
                                    ${isToday(day) ? 'bg-blue-600 text-white shadow-sm' : isCurrentMonth ? 'text-gray-700' : 'text-gray-400'}
                                `}>
                                    {format(day, 'd')}
                                </div>

                                <div className="space-y-0.5">
                                    {dayEvents.slice(0, 2).map(event => (
                                        <div
                                            key={event.id}
                                            className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 truncate font-medium hover:bg-emerald-200 transition cursor-pointer flex items-center gap-1"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (event.htmlLink) window.open(event.htmlLink, '_blank');
                                            }}
                                            title={`${format(parseISO(event.start), 'HH:mm')} - ${event.summary}`}
                                        >
                                            <span className="text-emerald-600">{format(parseISO(event.start), 'HH:mm')}</span>
                                            <span className="truncate">{event.summary}</span>
                                        </div>
                                    ))}
                                    {dayEvents.length > 2 && (
                                        <div className="text-[10px] text-gray-400 font-medium px-1">
                                            +{dayEvents.length - 2} más
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Create Event Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <div className="p-2 bg-emerald-100 rounded-lg">
                                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            Nuevo Evento
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-500 font-bold ml-1 block mb-1">Título *</label>
                                <input
                                    type="text"
                                    placeholder="Reunión con cliente, llamada, etc."
                                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                                    value={newEvent.summary}
                                    onChange={e => setNewEvent({ ...newEvent, summary: e.target.value })}
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 font-bold ml-1 block mb-1">Inicio *</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                                        value={newEvent.start}
                                        onChange={e => setNewEvent({ ...newEvent, start: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 font-bold ml-1 block mb-1">Fin *</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                                        value={newEvent.end}
                                        onChange={e => setNewEvent({ ...newEvent, end: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 font-bold ml-1 block mb-1">Descripción</label>
                                <textarea
                                    placeholder="Detalles del evento..."
                                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 h-20 resize-none focus:border-emerald-300"
                                    value={newEvent.description}
                                    onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 font-bold ml-1 block mb-1">Invitados</label>
                                <input
                                    type="text"
                                    placeholder="email1@ejemplo.com, email2@ejemplo.com"
                                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                                    value={newEvent.attendees}
                                    onChange={e => setNewEvent({ ...newEvent, attendees: e.target.value })}
                                />
                            </div>

                            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-blue-900">Google Meet incluido</h4>
                                    <p className="text-xs text-blue-700">Se generará automáticamente un enlace de videollamada.</p>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <button
                                    onClick={handleCreateEvent}
                                    disabled={creating || !newEvent.summary}
                                    className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {creating ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                            Creando...
                                        </>
                                    ) : (
                                        'Crear Evento'
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-5 py-3 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
