'use client';

import { useState } from 'react';

type View = 'dashboard' | 'customers' | 'tickets' | 'invoices' | 'finances' | 'leads' | 'inbox' | 'assistai' | 'ai-agents' | 'channels' | 'settings' | 'developers' | 'super-admin' | 'calendar' | 'kanban' | 'reports';

interface SidebarProps {
    currentView: View;
    onChangeView: (view: View) => void;
    isCollapsed: boolean;
    toggleCollapse: () => void;
    userRole?: string;
    enabledServices?: string; // "CRM,CHRONUSDEV"
    user?: any; // Pass full user object for orgs
}

export default function Sidebar({ currentView, onChangeView, isCollapsed, toggleCollapse, userRole, enabledServices, user }: SidebarProps) {
    const hasChronusDev = enabledServices?.includes('CHRONUSDEV') || enabledServices?.includes('ALL');
    const [showOrgMenu, setShowOrgMenu] = useState(false);

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

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'inbox', label: 'Inbox Unificado', icon: '📥' },
        { id: 'leads', label: 'Leads (CRM)', icon: '💼' },
        { id: 'kanban', label: 'Kanban', icon: '📋' },
        { id: 'customers', label: 'Clientes', icon: '👥' },
        { id: 'calendar', label: 'Calendario', icon: '📅' },
        // { id: 'voice', label: 'Agentes de Voz', icon: '🎤' }, // Oculto temp
        { id: 'assistai', label: 'AssistAI', icon: '🤖' },
        { id: 'reports', label: 'Reportes', icon: '📈' },
        { id: 'settings', label: 'Configuración', icon: '⚙️' },
        // Conditional ChronusDev Link
        ...(hasChronusDev ? [{ id: 'developers', label: 'Developers', icon: '🛠️' }] : []),
    ];

    if (userRole === 'SUPER_ADMIN') {
        menuItems.push({ id: 'super-admin', label: 'Super Admin', icon: '👑' });
    }

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
                        {/* Show Org Avatar or Initial */}
                        <span className="text-white text-lg font-bold">
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
                            <p className="text-xs font-semibold text-slate-400 px-2 py-1 mb-1 uppercase tracking-wider">Tus Organizaciones</p>
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

            {/* Menu Items */}
            <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        data-tour={item.id} // Add tour hook
                        onClick={() => {
                            onChangeView(item.id as View);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${currentView === item.id
                            ? 'bg-emerald-600/10 text-emerald-400'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                        title={isCollapsed ? item.label : ''}
                    >
                        <span className="text-xl min-w-[24px] text-center">{item.icon}</span>
                        {!isCollapsed && (
                            <span className="font-medium whitespace-nowrap opacity-100 transition-opacity duration-300">
                                {item.label}
                            </span>
                        )}

                        {/* Active Indicator Strip */}
                        {currentView === item.id && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-500 rounded-r-full" />
                        )}

                        {/* Tooltip for collapsed state */}
                        {isCollapsed && (
                            <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-slate-700">
                                {item.label}
                            </div>
                        )}
                    </button>
                ))}
            </nav>

            {/* Footer / Toggle */}
            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={toggleCollapse}
                    className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                >
                    {isCollapsed ? '→' : '← Colapsar'}
                </button>

                {!isCollapsed && hasChronusDev && (
                    <div className="mt-4 pt-4 border-t border-slate-800">
                        <a
                            href={process.env.NEXT_PUBLIC_CHRONUS_APP_URL || "http://localhost:3000"}
                            className="flex items-center gap-2 w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm font-medium"
                        >
                            <span className="text-lg">⏱️</span>
                            <span>Ir a ChronusDev</span>
                        </a>
                    </div>
                )}
                {isCollapsed && hasChronusDev && (
                    <a
                        href={process.env.NEXT_PUBLIC_CHRONUS_APP_URL || "http://localhost:3000"}
                        className="mt-4 flex items-center justify-center w-full p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                        title="Ir a ChronusDev"
                    >
                        <span>⏱️</span>
                    </a>
                )}
            </div>
        </aside>
    );
}
