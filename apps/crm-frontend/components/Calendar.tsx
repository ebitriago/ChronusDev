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
    eventType?: 'MEETING' | 'CALL' | 'TASK';
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
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDayModal, setShowDayModal] = useState(false);
    const [showEventModal, setShowEventModal] = useState(false);

    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    const [newEvent, setNewEvent] = useState({ summary: '', description: '', start: '', end: '', attendees: '', eventType: 'MEETING' });
    const [creating, setCreating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Connection status
    const [status, setStatus] = useState<ConnectionStatus | null>(null);
    const [bypassConnection, setBypassConnection] = useState(false);

    // Check connection status on mount
    useEffect(() => {
        checkConnectionStatus();
        const storedBypass = localStorage.getItem('calendar_bypass');
        if (storedBypass === 'true') setBypassConnection(true);
    }, []);

    // Fetch events when month changes or after connecting
    // Fetch events when month changes or after connecting
    useEffect(() => {
        if (status?.connected || bypassConnection) {
            fetchEvents();
        }
    }, [currentDate, status?.connected, bypassConnection]);

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
            const url = isEditing && selectedEvent
                ? `${API_URL}/calendar/events/${selectedEvent.id}`
                : `${API_URL}/calendar/events`;

            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
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
                setShowCreateModal(false);
                setNewEvent({ summary: '', description: '', start: '', end: '', attendees: '', eventType: 'MEETING' });
                setIsEditing(false);
                fetchEvents();
            } else {
                const data = await res.json();
                alert(data.error || "Error al guardar evento");
            }
        } catch (err) {
            console.error(err);
            alert("Error de conexión");
        } finally {
            setCreating(false);
        }
    }

    async function handleDeleteEvent() {
        if (!selectedEvent) return;
        if (!confirm('¿Estás seguro de eliminar este evento?')) return;

        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/calendar/events/${selectedEvent.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                setShowEventModal(false);
                setSelectedEvent(null);
                fetchEvents();
            } else {
                alert("Error al eliminar evento");
            }
        } catch (err) {
            console.error("Error deleting event:", err);
            alert("Error de conexión");
        }
    }

    function connectGoogle() {
        window.location.href = `${API_URL}/calendar/connect`;
    }

    function openCreateModal(date?: Date, eventToEdit?: CalendarEvent) {
        if (eventToEdit) {
            setIsEditing(true);
            setSelectedEvent(eventToEdit);

            const formatForInput = (d: string) => format(parseISO(d), "yyyy-MM-dd'T'HH:mm");

            setNewEvent({
                summary: eventToEdit.summary,
                description: eventToEdit.description || '',
                start: formatForInput(eventToEdit.start),
                end: formatForInput(eventToEdit.end),
                attendees: eventToEdit.attendees?.join(', ') || '',
                eventType: eventToEdit.eventType || 'MEETING'
            });
            setShowCreateModal(true);
        } else {
            setIsEditing(false);
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
                attendees: '',
                eventType: 'MEETING'
            });
            setShowCreateModal(true);
        }
    }

    function openDayModal(day: Date) {
        setSelectedDay(day);
        setShowDayModal(true);
    }

    function openEventDetails(event: CalendarEvent) {
        setSelectedEvent(event);
        setShowEventModal(true);
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
    if (status && !status.connected && !bypassConnection) {
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
                            <button
                                onClick={() => {
                                    setBypassConnection(true);
                                    localStorage.setItem('calendar_bypass', 'true');
                                }}
                                className="mt-3 text-sm font-bold text-amber-900 underline hover:text-amber-700"
                            >
                                Continuar en modo local
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
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
                            <button
                                onClick={() => {
                                    setBypassConnection(true);
                                    localStorage.setItem('calendar_bypass', 'true');
                                }}
                                className="w-full text-gray-500 font-medium text-sm hover:text-gray-800 transition-colors py-2"
                            >
                                Continuar sin conectar (modo local)
                            </button>
                        </div>
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
                    {status?.connected ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            Google conectado
                        </div>
                    ) : (
                        <button
                            onClick={connectGoogle}
                            className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border border-blue-200"
                        >
                            Conectar Google
                        </button>
                    )}
                    <button
                        onClick={() => openCreateModal()}
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
                                onClick={() => openDayModal(day)}
                                className={`
                                    min-h-[80px] border-b border-r border-gray-50 p-1.5 transition-colors hover:bg-gray-50 cursor-pointer relative group
                                    ${!isCurrentMonth ? 'bg-gray-50/30' : 'bg-white'}
                                    ${isToday(day) ? 'bg-blue-50/40' : ''}
                                `}
                            >
                                <div className="flex justify-between items-start">
                                    <div className={`
                                        text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1
                                        ${isToday(day) ? 'bg-blue-600 text-white shadow-sm' : isCurrentMonth ? 'text-gray-700' : 'text-gray-400'}
                                    `}>
                                        {format(day, 'd')}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openCreateModal(day); }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-emerald-100 rounded-lg text-emerald-600 transition-all"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="space-y-0.5">
                                    {dayEvents.slice(0, 4).map(event => {
                                        const isGoogle = (event as any).source === 'google';
                                        const typeColor = event.eventType === 'CALL' ? 'bg-purple-100 text-purple-800'
                                            : event.eventType === 'TASK' ? 'bg-orange-100 text-orange-800'
                                                : isGoogle ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-emerald-100 text-emerald-800';

                                        return (
                                            <div
                                                key={event.id}
                                                className={`
                                                    text-[10px] px-1.5 py-0.5 rounded truncate font-medium transition cursor-pointer flex items-center gap-1
                                                    ${typeColor} hover:opacity-80
                                                `}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEventDetails(event);
                                                }}
                                                title={`${format(parseISO(event.start), 'HH:mm')} - ${event.summary}`}
                                            >
                                                {event.eventType === 'CALL' && <span>📞</span>}
                                                {event.eventType === 'TASK' && <span>✓</span>}
                                                {isGoogle && !event.eventType && <span className="text-blue-600 font-bold">G</span>}

                                                <span className="opacity-70 text-[9px]">
                                                    {format(parseISO(event.start), 'HH:mm')}
                                                </span>
                                                <span className="truncate">{event.summary}</span>
                                            </div>
                                        );
                                    })}
                                    {dayEvents.length > 4 && (
                                        <div className="text-[10px] text-gray-400 font-medium px-1">
                                            +{dayEvents.length - 4} más
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Day Details Modal */}
            {showDayModal && selectedDay && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4" onClick={() => setShowDayModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 capitalize">
                                    {format(selectedDay, 'EEEE d de MMMM', { locale: es })}
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {getEventsForDay(selectedDay).length} eventos programados
                                </p>
                            </div>
                            <button onClick={() => setShowDayModal(false)} className="p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-lg">
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3">
                            {getEventsForDay(selectedDay).length === 0 ? (
                                <div className="h-40 flex flex-col items-center justify-center text-gray-400">
                                    <span className="text-4xl mb-2">📅</span>
                                    <p>No hay eventos este día</p>
                                </div>
                            ) : (
                                getEventsForDay(selectedDay)
                                    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                                    .map(event => (
                                        <div
                                            key={event.id}
                                            onClick={() => { setShowDayModal(false); openEventDetails(event); }}
                                            className="p-3 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer group transition-colors flex gap-3"
                                        >
                                            <div className="flex flex-col items-center justify-center px-3 bg-gray-50 rounded-lg text-xs font-bold text-gray-600 w-16">
                                                <span>{format(parseISO(event.start), 'HH:mm')}</span>
                                                <span className="text-gray-400 text-[10px]">{format(parseISO(event.end), 'HH:mm')}</span>
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-gray-800 text-sm">{event.summary}</h4>
                                                <div className="flex gap-2 text-xs mt-1">
                                                    {event.eventType && (
                                                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase
                                                        ${event.eventType === 'CALL' ? 'bg-purple-100 text-purple-700' :
                                                                event.eventType === 'TASK' ? 'bg-orange-100 text-orange-700' :
                                                                    'bg-blue-100 text-blue-700'}
                                                    `}>{event.eventType}</span>
                                                    )}
                                                    {(event as any).source === 'google' && (
                                                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-bold text-[10px]">Google</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <button
                                onClick={() => { setShowDayModal(false); openCreateModal(selectedDay); }}
                                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                            >
                                <span>+</span> Agregar Evento
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Event Details Modal */}
            {showEventModal && selectedEvent && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4" onClick={() => setShowEventModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
                                    ${selectedEvent.eventType === 'CALL' ? 'bg-purple-100 text-purple-600' :
                                        selectedEvent.eventType === 'TASK' ? 'bg-orange-100 text-orange-600' :
                                            'bg-emerald-100 text-emerald-600'}
                                `}>
                                    {selectedEvent.eventType === 'CALL' ? '📞' : selectedEvent.eventType === 'TASK' ? '✓' : '📅'}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 leading-tight">{selectedEvent.summary}</h3>
                                    <p className="text-emerald-600 font-bold text-sm mt-1">
                                        {format(parseISO(selectedEvent.start), 'EEEE d MMMM, HH:mm', { locale: es })}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowEventModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg">✕</button>
                        </div>

                        <div className="space-y-4 mb-8">
                            {selectedEvent.description && (
                                <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-700 whitespace-pre-wrap">
                                    {selectedEvent.description}
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                    <span className="w-5 text-center">🕒</span>
                                    <span>
                                        {format(parseISO(selectedEvent.start), 'HH:mm')} - {format(parseISO(selectedEvent.end), 'HH:mm')}
                                    </span>
                                </div>
                                {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                                    <div className="flex items-start gap-3 text-sm text-gray-600">
                                        <span className="w-5 text-center mt-0.5">👥</span>
                                        <div className="flex-1 flex flex-wrap gap-1">
                                            {selectedEvent.attendees.map(email => (
                                                <span key={email} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium border border-blue-100">
                                                    {email}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {selectedEvent.meetLink && (
                                <a href={selectedEvent.meetLink} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-3 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors border border-blue-200 group">
                                    <div className="bg-blue-200 p-2 rounded-lg group-hover:bg-white transition-colors">📹</div>
                                    <div className="font-bold">Unirse a Google Meet</div>
                                </a>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { setShowEventModal(false); openCreateModal(undefined, selectedEvent); }}
                                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                ✏️ Editar
                            </button>
                            <button
                                onClick={handleDeleteEvent}
                                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-100 text-red-600 font-bold hover:bg-red-50 transition-colors"
                            >
                                🗑️ Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create/Edit Event Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4" onClick={() => setShowCreateModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${isEditing ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            {isEditing ? 'Editar Evento' : 'Nuevo Evento'}
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

                            <div className="grid grid-cols-3 gap-3">
                                <div
                                    onClick={() => setNewEvent({ ...newEvent, eventType: 'MEETING' })}
                                    className={`p-2 rounded-xl border text-center cursor-pointer transition-all ${newEvent.eventType === 'MEETING' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-gray-200 hover:border-emerald-200'}`}
                                >
                                    <div className="text-lg">📅</div>
                                    <div className="text-xs font-bold mt-1">Reunión</div>
                                </div>
                                <div
                                    onClick={() => setNewEvent({ ...newEvent, eventType: 'CALL' })}
                                    className={`p-2 rounded-xl border text-center cursor-pointer transition-all ${newEvent.eventType === 'CALL' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'border-gray-200 hover:border-purple-200'}`}
                                >
                                    <div className="text-lg">📞</div>
                                    <div className="text-xs font-bold mt-1">Llamada</div>
                                </div>
                                <div
                                    onClick={() => setNewEvent({ ...newEvent, eventType: 'TASK' })}
                                    className={`p-2 rounded-xl border text-center cursor-pointer transition-all ${newEvent.eventType === 'TASK' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'border-gray-200 hover:border-orange-200'}`}
                                >
                                    <div className="text-lg">✓</div>
                                    <div className="text-xs font-bold mt-1">Tarea</div>
                                </div>
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

                            {newEvent.eventType === 'MEETING' && (
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
                            )}

                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <button
                                    onClick={handleCreateEvent}
                                    disabled={creating || !newEvent.summary}
                                    className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {creating ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                            {isEditing ? 'Guardando...' : 'Creando...'}
                                        </>
                                    ) : (
                                        isEditing ? 'Guardar Cambios' : 'Crear Evento'
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowCreateModal(false)}
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
