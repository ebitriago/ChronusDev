'use client';

import { useState, useEffect } from 'react';
import { API_URL, getHeaders } from '../app/api';

type TeamUser = {
    id: string;
    name: string;
    email: string;
    role: string;
};

export default function AdminBroadcast() {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [targetMode, setTargetMode] = useState<'all' | 'selected'>('all');
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        fetchTeamUsers();
    }, []);

    const fetchTeamUsers = async () => {
        try {
            const res = await fetch(`${API_URL}/organization/users`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setTeamUsers(data);
            }
        } catch (e) {
            console.error('Error fetching team users:', e);
        }
    };

    const handleSend = async () => {
        if (!title.trim() || !body.trim()) return;
        setSending(true);
        setResult(null);

        try {
            const payload: any = { title: title.trim(), body: body.trim(), type: 'SYSTEM' };
            if (targetMode === 'selected' && selectedUsers.length > 0) {
                payload.targetUserIds = selectedUsers;
            }

            const res = await fetch(`${API_URL}/notifications/broadcast`, {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                const data = await res.json();
                setResult({ success: true, message: data.message });
                setTitle('');
                setBody('');
                setSelectedUsers([]);
            } else {
                const err = await res.json();
                setResult({ success: false, message: err.error || 'Error enviando notificación' });
            }
        } catch (e) {
            setResult({ success: false, message: 'Error de conexión' });
        } finally {
            setSending(false);
        }
    };

    const toggleUser = (userId: string) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Enviar Notificación</h3>
                    <p className="text-sm text-gray-500">Envía una notificación push a tu equipo</p>
                </div>
            </div>

            {/* Target Selection */}
            <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Destinatarios</label>
                <div className="flex gap-2">
                    <button
                        onClick={() => setTargetMode('all')}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${targetMode === 'all'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        👥 Todos
                    </button>
                    <button
                        onClick={() => setTargetMode('selected')}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${targetMode === 'selected'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        🎯 Seleccionar
                    </button>
                </div>
            </div>

            {/* User Selection (if specific) */}
            {targetMode === 'selected' && (
                <div className="mb-5 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1">
                    {teamUsers.map(user => (
                        <label
                            key={user.id}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${selectedUsers.includes(user.id)
                                    ? 'bg-emerald-50 border border-emerald-200'
                                    : 'hover:bg-gray-50'
                                }`}
                        >
                            <input
                                type="checkbox"
                                checked={selectedUsers.includes(user.id)}
                                onChange={() => toggleUser(user.id)}
                                className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                                <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
                            </div>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded uppercase">
                                {user.role}
                            </span>
                        </label>
                    ))}
                    {teamUsers.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">No hay usuarios</p>
                    )}
                </div>
            )}

            {/* Title */}
            <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Título</label>
                <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ej: Reunión de equipo mañana"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    maxLength={100}
                />
            </div>

            {/* Body */}
            <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mensaje</label>
                <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Escribe el contenido de la notificación..."
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                    maxLength={500}
                />
                <p className="text-[10px] text-gray-400 mt-1 text-right">{body.length}/500</p>
            </div>

            {/* Result */}
            {result && (
                <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${result.success
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {result.success ? '✅' : '❌'} {result.message}
                </div>
            )}

            {/* Send Button */}
            <button
                onClick={handleSend}
                disabled={sending || !title.trim() || !body.trim() || (targetMode === 'selected' && selectedUsers.length === 0)}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {sending ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white/30 rounded-full animate-spin border-t-white" />
                        Enviando...
                    </>
                ) : (
                    <>
                        🔔 Enviar Notificación
                        {targetMode === 'all'
                            ? ` a todos (${teamUsers.length})`
                            : ` a ${selectedUsers.length} usuario${selectedUsers.length !== 1 ? 's' : ''}`
                        }
                    </>
                )}
            </button>
        </div>
    );
}
