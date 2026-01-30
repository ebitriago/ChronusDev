'use client';

import { useState, useEffect } from 'react';
import { API_URL } from '../app/api';

type Activity = {
    id: string;
    type: string;
    description: string;
    createdAt: string;
    user?: { id: string; name: string; avatar?: string };
    customer?: { id: string; name: string };
    lead?: { id: string; name: string };
    ticket?: { id: string; title: string };
    metadata?: any;
};

interface ActivityTimelineProps {
    customerId?: string;
    leadId?: string;
    ticketId?: string;
    limit?: number;
    showEntityLinks?: boolean;
}

const TYPE_ICONS: Record<string, string> = {
    CREATED: '🆕',
    UPDATED: '✏️',
    DELETED: '🗑️',
    STATUS_CHANGE: '🔄',
    ASSIGNMENT: '👤',
    COMMENT: '💬',
    EMAIL_SENT: '📧',
    CALL: '📞',
    MEETING: '📅',
    NOTE: '📝',
};

const TYPE_COLORS: Record<string, string> = {
    CREATED: 'bg-emerald-500',
    UPDATED: 'bg-blue-500',
    DELETED: 'bg-red-500',
    STATUS_CHANGE: 'bg-amber-500',
    ASSIGNMENT: 'bg-purple-500',
    COMMENT: 'bg-gray-500',
    EMAIL_SENT: 'bg-cyan-500',
    CALL: 'bg-green-500',
    MEETING: 'bg-indigo-500',
    NOTE: 'bg-slate-500',
};

export default function ActivityTimeline({
    customerId,
    leadId,
    ticketId,
    limit = 20,
    showEntityLinks = true
}: ActivityTimelineProps) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchActivities() {
            setLoading(true);
            try {
                let url = `${API_URL}/activities?limit=${limit}`;
                if (customerId) url = `${API_URL}/customers/${customerId}/activities?limit=${limit}`;
                if (leadId) url = `${API_URL}/leads/${leadId}/activities?limit=${limit}`;
                if (ticketId) url = `${API_URL}/tickets/${ticketId}/activities?limit=${limit}`;

                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setActivities(data);
                }
            } catch (err) {
                console.error('Error fetching activities:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchActivities();
    }, [customerId, leadId, ticketId, limit]);

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `Hace ${diffMins}m`;
        if (diffMins < 1440) return `Hace ${Math.floor(diffMins / 60)}h`;
        if (diffMins < 10080) return `Hace ${Math.floor(diffMins / 1440)}d`;
        return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
    };

    if (loading) {
        return (
            <div className="p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-4 mb-4">
                        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                        <div className="flex-1">
                            <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-2 bg-gray-100 rounded w-1/4"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400">
                <span className="text-4xl mb-2 block">📋</span>
                <p className="text-sm">Sin actividad registrada</p>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100"></div>

            <div className="space-y-4">
                {activities.map((activity, idx) => (
                    <div key={activity.id} className="relative flex gap-4 pl-10">
                        {/* Icon */}
                        <div className={`absolute left-0 w-8 h-8 rounded-full ${TYPE_COLORS[activity.type] || 'bg-gray-400'} flex items-center justify-center text-white text-sm shadow-sm`}>
                            {TYPE_ICONS[activity.type] || '📌'}
                        </div>

                        {/* Content */}
                        <div className="flex-1 bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-sm text-gray-800">{activity.description}</p>
                                <span className="text-xs text-gray-400 whitespace-nowrap">{formatTime(activity.createdAt)}</span>
                            </div>

                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {activity.user && (
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <span className="w-4 h-4 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-[10px] font-bold">
                                            {activity.user.name?.charAt(0) || 'U'}
                                        </span>
                                        {activity.user.name}
                                    </span>
                                )}

                                {showEntityLinks && activity.customer && (
                                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                                        👥 {activity.customer.name}
                                    </span>
                                )}

                                {showEntityLinks && activity.lead && (
                                    <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                                        🎯 {activity.lead.name}
                                    </span>
                                )}

                                {showEntityLinks && activity.ticket && (
                                    <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                                        🎫 {activity.ticket.title}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
