'use client';

import { useState } from 'react';

type View = 'dashboard' | 'customers' | 'tickets' | 'invoices' | 'finances' | 'leads' | 'inbox' | 'assistai' | 'ai-agents' | 'channels' | 'settings' | 'developers' | 'super-admin';

interface SidebarProps {
    currentView: View;
    onChangeView: (view: View) => void;
    isCollapsed: boolean;
    toggleCollapse: () => void;
    userRole?: string;
}

export default function Sidebar({ currentView, onChangeView, isCollapsed, toggleCollapse, userRole }: SidebarProps) {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'inbox', label: 'Inbox Unificado', icon: '💬' },
        { id: 'assistai', label: 'AssistAI', icon: '🤖' },
        { id: 'ai-agents', label: 'Agentes IA', icon: '🧠' },
        { id: 'channels', label: 'Canales', icon: '📱' },
        { id: 'leads', label: 'Leads Pipeline', icon: '🎯' },
        { id: 'customers', label: 'Clientes', icon: '👥' },
        { id: 'tickets', label: 'Tickets', icon: '🎫' },
        { id: 'invoices', label: 'Facturas', icon: '💰' },
        { id: 'finances', label: 'Finanzas', icon: '💵' },
        { id: 'developers', label: 'Developers', icon: '🛠️' },
        { id: 'docs', label: 'Documentación', icon: '📚' },
        ...(userRole === 'SUPER_ADMIN' ? [{ id: 'super-admin', label: 'Organizaciones', icon: '🏢' }] : []),
        { id: 'settings', label: 'Configuración', icon: '⚙️' },
    ];

    return (
        <aside
            className={`bg-slate-900 text-white transition-all duration-300 flex flex-col h-full border-r border-slate-800 ${isCollapsed ? 'w-20' : 'w-64'}`}
        >
            {/* Header / Logo */}
            <div className="h-16 flex items-center justify-center border-b border-slate-800">
                <div className="flex items-center gap-3 overflow-hidden px-4">
                    <div className="w-8 h-8 min-w-[32px] bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <span className="text-white text-lg font-bold">C</span>
                    </div>
                    {!isCollapsed && (
                        <span className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent whitespace-nowrap">
                            ChronusCRM
                        </span>
                    )}
                </div>
            </div>

            {/* Menu Items */}
            <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onChangeView(item.id as View)}
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

                {!isCollapsed && (
                    <div className="mt-4 pt-4 border-t border-slate-800">
                        <a
                            href="http://localhost:3000"
                            className="flex items-center gap-2 w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm font-medium"
                        >
                            <span className="text-lg">⏱️</span>
                            <span>Ir a ChronusDev</span>
                        </a>
                    </div>
                )}
                {isCollapsed && (
                    <a
                        href="http://localhost:3000"
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
