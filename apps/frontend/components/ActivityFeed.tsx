
'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_URL, getHeaders } from '../app/api';

type Activity = {
    id: string;
    type: string;
    description: string;
    createdAt: string;
    user?: {
        name: string;
        avatar: string | null;
    };
    task?: {
        id: string;
        title: string;
    };
    project?: {
        id: string;
        name: string;
    };
};

const ACTIVITY_ICONS: Record<string, string> = {
    CREATED: '✨',
    UPDATED: '📝',
    DELETED: '🗑️',
    STATUS_CHANGE: '🔄',
    ASSIGNMENT: '👉',
    COMMENT: '💬',
    TIMELOG_STARTED: '⏱️',
    TIMELOG_STOPPED: '⏹️',
    PAYOUT_CREATED: '💸',
    STANDUP: '📋',
};

function relativeTime(dateStr: string): string {
    const now = Date.now();
    const diff = now - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `hace ${days}d`;
    return new Date(dateStr).toLocaleDateString();
}

type ActivityFeedProps = {
    projectId?: string;
    limit?: number;
};

export default function ActivityFeed({ projectId, limit = 20 }: ActivityFeedProps) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadActivities = useCallback(async () => {
        try {
            setError(null);
            const params = new URLSearchParams({ limit: String(limit) });
            if (projectId) params.append('projectId', projectId);

            const res = await fetch(`${API_URL}/activity?${params}`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setActivities(Array.isArray(data) ? data : []);
            } else {
                setError('Error cargando actividad');
            }
        } catch (err) {
            console.error('Error loading activities:', err);
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    }, [projectId, limit]);

    useEffect(() => {
        loadActivities();
        const interval = setInterval(loadActivities, 30000);
        return () => clearInterval(interval);
    }, [loadActivities]);

    if (loading && activities.length === 0) {
        return <div className="animate-pulse space-y-3 p-4">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
        </div>;
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col h-full">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-xl">⚡️</span> Actividad Reciente
            </h3>

            {error && (
                <div className="mb-3 p-2 bg-red-50 text-red-600 rounded-lg text-xs flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={loadActivities} className="text-red-700 font-bold hover:underline text-[10px]">
                        Reintentar
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                {activities.length === 0 && !error ? (
                    <div className="text-center text-gray-400 py-8">
                        No hay actividad reciente
                    </div>
                ) : (
                    activities.map(activity => (
                        <div key={activity.id} className="flex gap-3 items-start group">
                            <div className="mt-1 w-8 h-8 rounded-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 flex items-center justify-center shrink-0 text-lg">
                                {ACTIVITY_ICONS[activity.type] || '📌'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {activity.user?.name || 'Sistema'}
                                    </span>
                                    {' '}
                                    {activity.description}
                                </p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-xs text-gray-400 dark:text-gray-500" title={new Date(activity.createdAt).toLocaleString()}>
                                        {relativeTime(activity.createdAt)}
                                    </span>
                                    {activity.project && (
                                        <span className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                                            {activity.project.name}
                                        </span>
                                    )}
                                    {activity.task && (
                                        <span className="text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded border border-purple-100 dark:border-purple-800 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors">
                                            📋 {activity.task.title}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
