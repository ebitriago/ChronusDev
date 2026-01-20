'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://127.0.0.1:3002';

type Notification = {
    id: string;
    userId: string;
    type: 'lead' | 'client' | 'ticket' | 'message' | 'conversion' | 'system';
    title: string;
    body: string;
    data?: any;
    read: boolean;
    createdAt: string;
};

const TYPE_ICONS: Record<string, string> = {
    lead: '📥',
    client: '🎉',
    ticket: '🎫',
    message: '💬',
    conversion: '🌟',
    system: '🔔'
};

const TYPE_COLORS: Record<string, string> = {
    lead: 'bg-blue-500',
    client: 'bg-emerald-500',
    ticket: 'bg-orange-500',
    message: 'bg-purple-500',
    conversion: 'bg-yellow-500',
    system: 'bg-gray-500'
};

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [socket, setSocket] = useState<Socket | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load notifications on mount
    useEffect(() => {
        fetch(`${API_URL}/notifications?userId=all`)
            .then(res => res.json())
            .then(data => {
                const notifs = Array.isArray(data) ? data : [];
                setNotifications(notifs.slice(0, 20)); // Keep last 20
                setUnreadCount(notifs.filter((n: Notification) => !n.read).length);
            })
            .catch(console.error);
    }, []);

    // Socket connection for real-time notifications
    useEffect(() => {
        const newSocket = io(API_URL);
        setSocket(newSocket);

        newSocket.on('notification', (notif: Notification) => {
            setNotifications(prev => [notif, ...prev].slice(0, 20));
            setUnreadCount(prev => prev + 1);

            // Play sound (optional)
            try {
                const audio = new Audio('/notification.mp3');
                audio.volume = 0.3;
                audio.play().catch(() => { }); // Ignore autoplay restrictions
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
            await fetch(`${API_URL}/notifications/mark-all-read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 'all' })
            });
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Error marking all as read:', err);
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
