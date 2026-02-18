'use client';

import { useState } from 'react';

export type View = 'dashboard' | 'projects' | 'kanban' | 'tickets' | 'backlog' | 'clients' | 'team' | 'reports' | 'reportes-pro' | 'earnings' | 'superadmin' | 'settings';
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'DEV' | 'AGENT' | 'VIEWER';

interface SidebarProps {
    currentView: View;
    onChangeView: (view: View) => void;
    isCollapsed: boolean;
    toggleCollapse: () => void;
    isSuperAdmin: boolean;
    userRole?: UserRole;
    isCrmLinked?: boolean;
    crmUrl?: string;
    user?: any;
}

interface MenuGroup {
    label: string;
    items: { id: string; label: string; icon: React.ReactNode }[];
}

const icons = {
    dashboard: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg>,
    projects: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
    kanban: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
    masterKanban: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>,
    clients: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    team: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    reports: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    reportsPro: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    earnings: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    settings: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    superAdmin: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    crm: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    chat: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    logout: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
    collapse: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>,
    expand: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>,
    external: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
};

export default function Sidebar({ currentView, onChangeView, isCollapsed, toggleCollapse, isSuperAdmin, userRole = 'DEV', isCrmLinked = false, crmUrl, user }: SidebarProps) {
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    const isManagerOrAbove = isAdmin || userRole === 'MANAGER';
    const [showUserMenu, setShowUserMenu] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('crm_token');
        localStorage.removeItem('userId');
        window.location.href = '/';
    };

    // Build grouped menu
    const menuGroups: MenuGroup[] = [
        {
            label: 'TRABAJO',
            items: [
                { id: 'dashboard', label: 'Dashboard', icon: icons.dashboard },
                { id: 'projects', label: 'Proyectos', icon: icons.projects },
                { id: 'kanban', label: 'Tareas', icon: icons.kanban },
                { id: 'tickets', label: 'Tickets', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg> },
                ...(isAdmin ? [{ id: 'backlog', label: 'Master Kanban', icon: icons.masterKanban }] : []),
            ]
        },
        ...(isManagerOrAbove ? [{
            label: 'EQUIPO',
            items: [
                { id: 'clients', label: 'Clientes', icon: icons.clients },
                { id: 'team', label: 'Equipo', icon: icons.team },
            ]
        }] : []),
        {
            label: 'REPORTES',
            items: [
                { id: 'reports', label: 'Reportes', icon: icons.reports },
                { id: 'reportes-pro', label: 'Reportes Pro', icon: icons.reportsPro },
                ...(isAdmin ? [{ id: 'earnings', label: 'Nómina', icon: icons.earnings }] : []),
            ]
        },
        ...(isAdmin ? [{
            label: 'CONFIGURACIÓN',
            items: [
                { id: 'settings', label: 'Ajustes', icon: icons.settings },
            ]
        }] : []),
    ];

    if (isSuperAdmin) {
        menuGroups.push({
            label: 'ADMIN',
            items: [{ id: 'superadmin', label: 'Organizaciones', icon: icons.superAdmin }]
        });
    }

    const userInitials = user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'U';

    return (
        <aside
            data-tour="sidebar"
            className={`h-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 transition-all duration-300 flex flex-col border-r border-gray-200 dark:border-slate-800 ${isCollapsed ? 'w-20' : 'w-72'}`}
        >
            {/* Header / Logo */}
            <div className="h-16 flex items-center justify-center border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3 overflow-hidden px-4">
                    <div className="w-8 h-8 min-w-[32px] bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <span className="text-white text-sm font-bold">P</span>
                    </div>
                    {!isCollapsed && (
                        <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent whitespace-nowrap">
                            ChronusDev
                        </span>
                    )}
                </div>
            </div>

            {/* Grouped Menu Items */}
            <div className="flex-1 overflow-y-auto py-6 space-y-2 custom-scrollbar">
                {menuGroups.map((group, gi) => (
                    <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
                        {!isCollapsed ? (
                            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-4 mb-2">
                                {group.label}
                            </p>
                        ) : (
                            gi > 0 && <hr className="border-gray-100 dark:border-slate-800 mx-2 mb-2" />
                        )}

                        <div className="space-y-0.5 px-2">
                            {group.items.map((item) => (
                                <button
                                    key={item.id}
                                    data-tour={item.id}
                                    onClick={() => onChangeView(item.id as View)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${currentView === item.id
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                                        : 'text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    title={isCollapsed ? item.label : ''}
                                >
                                    <span className={`min-w-[20px] flex items-center justify-center transition-colors ${currentView === item.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
                                        {item.icon}
                                    </span>
                                    {!isCollapsed && (
                                        <span className="text-sm whitespace-nowrap">
                                            {item.label}
                                        </span>
                                    )}

                                    {currentView === item.id && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 dark:bg-blue-500 rounded-r-full" />
                                    )}

                                    {isCollapsed && (
                                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-gray-700 dark:border-slate-700">
                                            {item.label}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}

                {/* CRM Chat Link */}
                {isCrmLinked && crmUrl && (
                    <div className="mt-4 px-2">
                        {!isCollapsed && (
                            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-2 mb-2">
                                CRM
                            </p>
                        )}
                        <a
                            href={`${crmUrl}/inbox`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                            title={isCollapsed ? 'Chat de Equipo' : ''}
                        >
                            <span className="min-w-[20px] flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                                {icons.chat}
                            </span>
                            {!isCollapsed && (
                                <span className="text-sm whitespace-nowrap font-medium">Chat de Equipo</span>
                            )}
                            {isCollapsed && (
                                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-gray-700 dark:border-slate-700">
                                    Chat de Equipo
                                </div>
                            )}
                        </a>
                    </div>
                )}
            </div>

            {/* Footer: CRM link + User Profile */}
            <div className="border-t border-gray-100 dark:border-slate-800 relative bg-gray-50/50 dark:bg-slate-900/50">
                {/* CRM Link */}
                <div className="px-3 pt-3">
                    <a
                        href={crmUrl || process.env.NEXT_PUBLIC_CRM_APP_URL ||
                            (process.env.NODE_ENV === 'development' ? "http://localhost:3003" : "https://chronuscrm.assistai.work")}
                        target="_blank"
                        className={`w-full flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 text-slate-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700 rounded-xl transition-all group shadow-sm ${isCollapsed ? 'justify-center' : ''}`}
                        title={isCollapsed ? 'Ir al CRM' : ''}
                    >
                        <span className="min-w-[20px] flex items-center justify-center">{icons.crm}</span>
                        {!isCollapsed && (
                            <>
                                <span className="font-medium text-sm">Ir al CRM</span>
                                <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">{icons.external}</span>
                            </>
                        )}
                    </a>
                </div>

                {/* User Profile */}
                <div className="p-3">
                    <button
                        onClick={() => !isCollapsed && setShowUserMenu(!showUserMenu)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white dark:hover:bg-slate-800 hover:shadow-md border border-transparent hover:border-gray-100 dark:hover:border-slate-700 group ${isCollapsed ? 'justify-center' : ''}`}
                        title={isCollapsed ? user?.name || 'Usuario' : ''}
                    >
                        <div className="w-8 h-8 min-w-[32px] bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg text-white">
                            <span className="text-xs font-bold">{userInitials}</span>
                        </div>
                        {!isCollapsed && (
                            <>
                                <div className="flex-1 text-left min-w-0">
                                    <p className="text-sm font-bold text-gray-700 dark:text-slate-200 truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{user?.name || 'Usuario'}</p>
                                    <p className="text-[10px] text-gray-500 dark:text-slate-500 truncate">{userRole}</p>
                                </div>
                                <svg className="w-4 h-4 text-gray-400 dark:text-slate-600 group-hover:text-gray-600 dark:group-hover:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                                </svg>
                            </>
                        )}
                    </button>

                    {showUserMenu && !isCollapsed && (
                        <div className="absolute bottom-20 left-4 right-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fadeIn z-50">
                            <button
                                onClick={() => { onChangeView('settings'); setShowUserMenu(false); }}
                                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                                {icons.settings}
                                <span>Configuración</span>
                            </button>
                            <hr className="border-gray-100 dark:border-slate-700" />
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                            >
                                {icons.logout}
                                <span>Cerrar Sesión</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Collapse */}
                <div className="px-3 pb-3">
                    <button
                        onClick={toggleCollapse}
                        className="w-full flex items-center justify-center p-2 rounded-lg text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                        title={isCollapsed ? 'Expandir' : 'Colapsar'}
                    >
                        {isCollapsed ? icons.expand : icons.collapse}
                    </button>
                </div>
            </div>
        </aside>
    );
}
