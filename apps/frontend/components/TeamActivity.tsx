'use client';

import { useEffect, useState } from 'react';
import { getTeamStatus, type TeamStatus } from '../app/api';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TeamActivity() {
    const [team, setTeam] = useState<TeamStatus[]>([]);
    const [loading, setLoading] = useState(true);

    // Poll for updates every 30 seconds
    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, []);

    async function loadData() {
        try {
            const data = await getTeamStatus();
            setTeam(data);
        } catch (error) {
            console.error('Error loading team status:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading && team.length === 0) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white dark:bg-slate-800 h-32 rounded-2xl border border-gray-100 dark:border-slate-700" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg">Actividad del Equipo</h3>
                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                    {team.filter(m => m.status === 'ACTIVE').length} activos
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {team.map(member => (
                    <div
                        key={member.id}
                        className={`relative p-4 rounded-2xl border transition-all ${member.status === 'ACTIVE'
                                ? 'bg-white dark:bg-slate-900 border-green-500/30 shadow-lg shadow-green-500/5' // Active style
                                : 'bg-gray-50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-800' // Offline style
                            }`}
                    >
                        {/* Status Indicator */}
                        <div className={`absolute top-4 right-4 w-3 h-3 rounded-full ${member.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-slate-600'
                            }`} />

                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold overflow-hidden">
                                {member.avatar ? (
                                    <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                                ) : (
                                    member.name.charAt(0)
                                )}
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-1">{member.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {member.hoursToday}h hoy
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {member.status === 'ACTIVE' && member.currentTask ? (
                                <>
                                    <div className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider">Trabajando en</div>
                                    <div className="font-medium text-gray-800 dark:text-gray-200 text-sm line-clamp-2" title={member.currentTask.title}>
                                        {member.currentTask.title}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                        <span className="truncate">{member.currentTask.project}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Última actividad</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        {member.lastActive
                                            ? formatDistanceToNow(new Date(member.lastActive), { addSuffix: true, locale: es })
                                            : 'Sin actividad reciente'}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Daily Goal Progress (Assuming 8h) */}
                        <div className="mt-4 h-1.5 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${member.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'
                                    }`}
                                style={{ width: `${Math.min((member.hoursToday / 8) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
