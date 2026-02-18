'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

import { API_URL } from '../app/api';

type Notification = {
    id: string;
    userId: string;
    type: 'lead' | 'client' | 'ticket' | 'message' | 'conversion' | 'system';
    title: string;
    body: string;
    data?: any;
    read: boolean;
    link?: string;
    createdAt: string;
};

const TYPE_ICONS: Record<string, string> = {
    LEAD: '📥',
    CLIENT: '🎉',
    TICKET: '🎫',
    MESSAGE: '💬',
    CONVERSION: '🌟',
    SYSTEM: '🔔'
};

const TYPE_COLORS: Record<string, string> = {
    LEAD: 'bg-blue-500',
    CLIENT: 'bg-emerald-500',
    TICKET: 'bg-orange-500',
    MESSAGE: 'bg-purple-500',
    CONVERSION: 'bg-yellow-500',
    SYSTEM: 'bg-gray-500'
};

export default function NotificationBell() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [socket, setSocket] = useState<Socket | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Helper for auth headers
    function getAuthHeaders() {
        if (typeof window === 'undefined') return {};
        const token = localStorage.getItem('crm_token'); // Fix: consistent token key
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    // Load notifications on mount
    useEffect(() => {
        const headers = getAuthHeaders() as any;
        fetch(`${API_URL}/notifications`, { headers }) // Endpoint is /notifications based on backend
            .then(res => {
                if (res.status === 401) throw new Error('Unauthorized');
                return res.json();
            })
            .then(data => {
                const notifs = Array.isArray(data) ? data : [];
                setNotifications(notifs); // Already taken 20 in backend
                setUnreadCount(notifs.filter((n: Notification) => !n.read).length);
            })
            .catch(console.error);
    }, []);

    // Socket connection for real-time notifications
    useEffect(() => {
        const token = localStorage.getItem('crm_token');
        // Using explicit socket.io path from next.config.js rewrite
        const newSocket = io({
            path: '/api/socket.io',
            auth: { token }
        });
        setSocket(newSocket);

        newSocket.on('notification', (notif: Notification) => {
            setNotifications(prev => [notif, ...prev].slice(0, 20));
            setUnreadCount(prev => prev + 1);

            // Play sound (optional)
            try {
                const audio = new Audio('/notification.mp3');
                audio.volume = 0.3;
                audio.play().catch(() => { });
            } catch { }
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAllRead = async () => {
        try {
            const headers = getAuthHeaders() as any;
            await fetch(`${API_URL}/notifications/read-all`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' }
            });
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    const handleMarkRead = async (id: string, currentReadStatus: boolean) => {
        // Optimistic update regardless of current status to ensure UI feels responsive
        // though strictly unnecessary if already read.
        if (currentReadStatus) return;

        try {
            const headers = getAuthHeaders() as any;
            // Optimistic update
            setNotifications(prev => {
                const newState = prev.map(n => n.id === id ? { ...n, read: true } : n);
                setUnreadCount(newState.filter(n => !n.read).length);
                return newState;
            });

            await fetch(`${API_URL}/notifications/${id}/read`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' }
            });
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `Hace ${diffMins}m`;
        if (diffMins < 1440) return `Hace ${Math.floor(diffMins / 60)}h`;
        return date.toLocaleDateString();
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
                title="Notificaciones"
            >
                <span className="text-xl">🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-fadeIn">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50">
                        <h3 className="font-bold text-gray-800">Notificaciones</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                            >
                                Marcar todas leídas
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                <span className="text-4xl mb-2 block">🔕</span>
                                <p className="text-sm">Sin notificaciones</p>
                            </div>
                        ) : (
                            notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    onClick={() => {
                                        handleMarkRead(notif.id, notif.read);
                                        if (notif.link) {
                                            router.push(notif.link);
                                            setIsOpen(false);
                                        }
                                    }}
                                    className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${!notif.read ? 'bg-blue-50/50' : ''}`}
                                >
                                    <div className="flex gap-3">
                                        <div className={`w-10 h-10 rounded-full ${TYPE_COLORS[notif.type] || 'bg-gray-500'} flex items-center justify-center text-white text-lg flex-shrink-0`}>
                                            {TYPE_ICONS[notif.type] || '🔔'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="font-bold text-sm text-gray-800 truncate">{notif.title}</p>
                                                {!notif.read && (
                                                    <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-600 line-clamp-2">{notif.body}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">{formatTime(notif.createdAt)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="p-3 border-t border-gray-100 text-center">
                            <button className="text-xs text-purple-600 hover:text-purple-800 font-medium">
                                Ver todas →
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
