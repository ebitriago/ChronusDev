'use client';

import { useState, useEffect, useCallback } from 'react';

interface Notification {
    id: string;
    type: 'TASK' | 'TICKET' | 'MESSAGE' | 'SYSTEM';
    title: string;
    message: string;
    read: boolean;
    link?: string;
    createdAt: string;
}

interface NotificationCenterProps {
    apiUrl?: string;
}

export default function NotificationCenter({ apiUrl = '/api' }: NotificationCenterProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const unreadCount = notifications.filter(n => !n.read).length;

    const fetchNotifications = useCallback(async () => {
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${apiUrl}/notifications`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    }, [apiUrl]);

    useEffect(() => {
        fetchNotifications();
        // Poll for new notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const markAsRead = async (id: string) => {
        try {
            const token = localStorage.getItem('crm_token');
            await fetch(`${apiUrl}/notifications/${id}/read`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n =>
                n.id === id ? { ...n, read: true } : n
            ));
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            const token = localStorage.getItem('crm_token');
            await fetch(`${apiUrl}/notifications/read-all`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'TASK': return '📋';
            case 'TICKET': return '🎫';
            case 'MESSAGE': return '💬';
            case 'SYSTEM': return '⚙️';
            default: return '🔔';
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return 'ahora';
        if (minutes < 60) return `hace ${minutes}m`;
        if (hours < 24) return `hace ${hours}h`;
        return `hace ${days}d`;
    };

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>

                {/* Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-medium">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Panel */}
                    <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                        {/* Header */}
                        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900">Notificaciones</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    Marcar todas como leídas
                                </button>
                            )}
                        </div>

                        {/* List */}
                        <div className="max-h-96 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <div className="text-3xl mb-2">🔔</div>
                                    <p>No hay notificaciones</p>
                                </div>
                            ) : (
                                notifications.slice(0, 10).map(notification => (
                                    <div
                                        key={notification.id}
                                        onClick={() => {
                                            markAsRead(notification.id);
                                            if (notification.link) {
                                                window.location.href = notification.link;
                                            }
                                        }}
                                        className={`px-4 py-3 border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50 ${!notification.read ? 'bg-blue-50/50' : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="text-xl">{getIcon(notification.type)}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className={`text-sm font-medium truncate ${!notification.read ? 'text-gray-900' : 'text-gray-600'
                                                        }`}>
                                                        {notification.title}
                                                    </p>
                                                    <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                                                        {formatTime(notification.createdAt)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-500 truncate">
                                                    {notification.message}
                                                </p>
                                            </div>
                                            {!notification.read && (
                                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        {notifications.length > 10 && (
                            <div className="px-4 py-2 text-center border-t border-gray-100">
                                <a href="/notifications" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                                    Ver todas las notificaciones
                                </a>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
