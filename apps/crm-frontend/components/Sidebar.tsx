'use client';

import { useState } from 'react';

type View = 'dashboard' | 'customers' | 'tickets' | 'invoices' | 'finances' | 'leads' | 'inbox' | 'assistai' | 'ai-agents' | 'channels' | 'settings' | 'developers' | 'super-admin' | 'calendar' | 'kanban' | 'reports' | 'erp' | 'manual' | 'marketing';

interface SidebarProps {
    currentView: View;
    onChangeView: (view: View) => void;
    isCollapsed: boolean;
    toggleCollapse: () => void;
    userRole?: string;
    enabledServices?: string; // "CRM,CHRONUSDEV"
    user?: any; // Pass full user object for orgs
}

interface MenuGroup {
    label: string;
    items: { id: string; label: string; icon: React.ReactNode }[];
}

// SVG Icon components for a cleaner look
const icons = {
    dashboard: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg>,
    inbox: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>,
    leads: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    customers: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    calendar: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    channels: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" /></svg>,
    tickets: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>,
    kanban: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
    invoices: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>,
    finances: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    erp: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>,
    reports: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    aiAgents: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    settings: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    developers: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
    superAdmin: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    logout: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
    collapse: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>,
    expand: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>,
    external: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
    chronusDev: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    manual: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
    marketing: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
};

export default function Sidebar({ currentView, onChangeView, isCollapsed, toggleCollapse, userRole, enabledServices, user }: SidebarProps) {
    const hasChronusDev = enabledServices?.includes('CHRONUSDEV') || enabledServices?.includes('ALL') || userRole === 'SUPER_ADMIN';
    const [showOrgMenu, setShowOrgMenu] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);

    const handleSwitchOrg = async (orgId: string) => {
        try {
            const token = localStorage.getItem('crm_token');
            const response = await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/auth/switch-org`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ organizationId: orgId })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('crm_token', data.token);
                window.location.reload();
            }
        } catch (error) {
            console.error('Error switching org', error);
        }
    };

    const handleLogout = async () => {
        try {
            const token = localStorage.getItem('crm_token');
            if (token) {
                await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/auth/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
        } catch (e) {
            console.error("Logout error", e);
        } finally {
            localStorage.removeItem('crm_token');
            window.location.href = '/login';
        }
    };

    // Build grouped menu
    const menuGroups: MenuGroup[] = [
        {
            label: 'NEGOCIO',
            items: [
                { id: 'dashboard', label: 'Dashboard', icon: icons.dashboard },
                { id: 'leads', label: 'Pipeline', icon: icons.leads },
                { id: 'customers', label: 'Clientes', icon: icons.customers },
                { id: 'calendar', label: 'Calendario', icon: icons.calendar },
            ]
        },
        {
            label: 'COMUNICACIÓN',
            items: [
                { id: 'inbox', label: 'Inbox', icon: icons.inbox },
                { id: 'channels', label: 'Canales', icon: icons.channels },
            ]
        },
        {
            label: 'OPERACIONES',
            items: [
                { id: 'tickets', label: 'Soporte', icon: icons.tickets },
                { id: 'kanban', label: 'Kanban', icon: icons.kanban },
            ]
        },
        {
            label: 'FINANZAS',
            items: [
                { id: 'invoices', label: 'Facturación', icon: icons.invoices },
                { id: 'finances', label: 'Contabilidad', icon: icons.finances },
                { id: 'erp', label: 'Pedidos', icon: icons.erp },
            ]
        },
        {
            label: 'ANALYTICS',
            items: [
                { id: 'reports', label: 'Reportes', icon: icons.reports },
            ]
        },
        {
            label: 'MARKETING',
            items: [
                { id: 'marketing', label: 'Campañas', icon: icons.marketing },
            ]
        },
        {
            label: 'CONFIGURACIÓN',
            items: [
                { id: 'ai-agents', label: 'Agentes IA', icon: icons.aiAgents },
                { id: 'settings', label: 'Ajustes', icon: icons.settings },
                ...(hasChronusDev ? [{ id: 'developers', label: 'Developers', icon: icons.developers }] : []),
                { id: 'manual', label: 'Manual', icon: icons.manual },
            ]
        },
    ];

    if (userRole === 'SUPER_ADMIN') {
        menuGroups.push({
            label: 'ADMIN',
            items: [{ id: 'super-admin', label: 'Super Admin', icon: icons.superAdmin }]
        });
    }

    const userInitials = user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'U';

    return (
        <aside
            data-tour="sidebar"
            className={`bg-slate-900 text-white transition-all duration-300 flex flex-col h-full border-r border-slate-800 ${isCollapsed ? 'w-20' : 'w-64'}`}
        >
            {/* Header / Logo / Org Switcher */}
            <div className="h-16 flex items-center justify-center border-b border-slate-800 relative">
                <div
                    className="flex items-center gap-3 overflow-hidden px-4 cursor-pointer hover:opacity-80 transition-opacity w-full"
                    onClick={() => !isCollapsed && user?.organizations?.length > 1 && setShowOrgMenu(!showOrgMenu)}
                >
                    <div className="w-8 h-8 min-w-[32px] bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <span className="text-white text-sm font-bold">
                            {user?.organization?.name?.charAt(0) || 'C'}
                        </span>
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <h2 className="text-sm font-bold text-white truncate">
                                {user?.organization?.name || 'Chronus CRM'}
                            </h2>
                            {user?.organizations?.length > 1 && (
                                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                    Cambiar org <span className="text-[8px]">▼</span>
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Org Switcher Dropdown */}
                {showOrgMenu && !isCollapsed && (
                    <div className="absolute top-16 left-4 right-4 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
                        <div className="p-2">
                            <p className="text-[10px] font-semibold text-slate-400 px-2 py-1 mb-1 uppercase tracking-wider">Tus Organizaciones</p>
                            {user?.organizations?.map((org: any) => (
                                <button
                                    key={org.id}
                                    onClick={() => handleSwitchOrg(org.id)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between group ${user.organization?.id === org.id
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                                        }`}
                                >
                                    <span className="truncate">{org.name}</span>
                                    {user.organization?.id === org.id && <span className="text-emerald-500">●</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Grouped Menu Items */}
            <nav className="flex-1 py-3 px-3 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                {menuGroups.map((group, gi) => (
                    <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
                        {/* Group Label */}
                        {!isCollapsed ? (
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1.5">
                                {group.label}
                            </p>
                        ) : (
                            gi > 0 && <hr className="border-slate-800 mx-2 mb-2" />
                        )}

                        {/* Group Items */}
                        <div className="space-y-0.5">
                            {group.items.map((item) => (
                                <button
                                    key={item.id}
                                    data-tour={item.id}
                                    onClick={() => {
                                        onChangeView(item.id as View);
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${currentView === item.id
                                        ? 'bg-emerald-600/10 text-emerald-400'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    title={isCollapsed ? item.label : ''}
                                >
                                    <span className="min-w-[20px] flex items-center justify-center">{item.icon}</span>
                                    {!isCollapsed && (
                                        <span className="font-medium text-sm whitespace-nowrap opacity-100 transition-opacity duration-300">
                                            {item.label}
                                        </span>
                                    )}

                                    {/* Active Indicator Strip */}
                                    {currentView === item.id && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />
                                    )}

                                    {/* Tooltip for collapsed state */}
                                    {isCollapsed && (
                                        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-slate-700">
                                            {item.label}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Footer: User profile + actions */}
            <div className="border-t border-slate-800 relative">
                {/* ChronusDev Link */}
                {hasChronusDev && (
                    <div className="px-3 pt-3">
                        <button
                            onClick={() => {
                                const token = localStorage.getItem('crm_token');
                                const baseUrl = process.env.NEXT_PUBLIC_CHRONUS_APP_URL || "https://chronusdev.assistai.work";
                                window.open(`${baseUrl}?token=${token}`, '_blank');
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 bg-slate-800/50 hover:bg-emerald-600/10 hover:text-emerald-400 text-slate-400 rounded-xl transition-all group ${isCollapsed ? 'justify-center' : ''}`}
                            title={isCollapsed ? 'Ir a ChronusDev' : ''}
                        >
                            <span className="min-w-[20px] flex items-center justify-center">{icons.chronusDev}</span>
                            {!isCollapsed && (
                                <>
                                    <span className="font-medium text-sm">ChronusDev</span>
                                    <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">{icons.external}</span>
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* User Profile Row */}
                <div className="p-3">
                    <button
                        onClick={() => !isCollapsed && setShowUserMenu(!showUserMenu)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-slate-800 group ${isCollapsed ? 'justify-center' : ''}`}
                        title={isCollapsed ? user?.name || 'Usuario' : ''}
                    >
                        {/* Avatar */}
                        <div className="w-8 h-8 min-w-[32px] bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-white text-xs font-bold">{userInitials}</span>
                        </div>
                        {!isCollapsed && (
                            <>
                                <div className="flex-1 text-left min-w-0">
                                    <p className="text-sm font-medium text-slate-200 truncate">{user?.name || 'Usuario'}</p>
                                    <p className="text-[10px] text-slate-500 truncate">{user?.email || ''}</p>
                                </div>
                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                                </svg>
                            </>
                        )}
                    </button>

                    {/* User Dropdown Menu */}
                    {showUserMenu && !isCollapsed && (
                        <div className="mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fadeIn">
                            <button
                                onClick={() => { onChangeView('settings'); setShowUserMenu(false); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                            >
                                {icons.settings}
                                <span>Configuración</span>
                            </button>
                            <hr className="border-slate-700" />
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                            >
                                {icons.logout}
                                <span>Cerrar Sesión</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Collapse Button */}
                <div className="px-3 pb-3">
                    <button
                        onClick={toggleCollapse}
                        className="w-full flex items-center justify-center p-2 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white transition-colors"
                        title={isCollapsed ? 'Expandir' : 'Colapsar'}
                    >
                        {isCollapsed ? icons.expand : icons.collapse}
                    </button>
                </div>
            </div>
        </aside>
    );
}
