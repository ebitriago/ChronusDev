'use client';

import { useState } from 'react';

type View = 'dashboard' | 'projects' | 'kanban' | 'clients' | 'team' | 'reports' | 'earnings' | 'superadmin';

interface SidebarProps {
    currentView: View;
    onChangeView: (view: View) => void;
    isCollapsed: boolean;
    toggleCollapse: () => void;
    isSuperAdmin: boolean;
}

export default function Sidebar({ currentView, onChangeView, isCollapsed, toggleCollapse, isSuperAdmin }: SidebarProps) {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'projects', label: 'Proyectos', icon: '🚀' },
        { id: 'kanban', label: 'Tareas', icon: '📋' },
        { id: 'clients', label: 'Clientes', icon: '🏢' },
        { id: 'team', label: 'Equipo', icon: '👥' },
        { id: 'reports', label: 'Reportes', icon: '📈' },
        { id: 'earnings', label: 'Nómina', icon: '💰' },
    ];

    if (isSuperAdmin) {
        menuItems.push({ id: 'superadmin', label: 'Orgs', icon: '👑' });
    }

    return (
        <aside
            className={`h-full bg-white border-r border-gray-200 text-gray-700 transition-all duration-300 flex flex-col ${isCollapsed ? 'w-20' : 'w-64'}`}
        >
            {/* Header / Logo */}
            <div className="h-16 flex items-center justify-center border-b border-gray-100">
                <div className="flex items-center gap-3 overflow-hidden px-4">
                    <div className="w-8 h-8 min-w-[32px] bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <span className="text-white text-lg font-bold">P</span>
                    </div>
                    {!isCollapsed && (
                        <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent whitespace-nowrap">
                            ChronusDev
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
                            ? 'bg-blue-50 text-blue-600 font-medium'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
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
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full" />
                        )}

                        {/* Tooltip for collapsed state */}
                        {isCollapsed && (
                            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl">
                                {item.label}
                            </div>
                        )}
                    </button>
                ))}
            </nav>

            {/* Footer / Toggle */}
            <div className="p-4 border-t border-gray-100">
                <button
                    onClick={toggleCollapse}
                    className="w-full flex items-center justify-center p-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                >
                    {isCollapsed ? '→' : '← Colapsar'}
                </button>
            </div>
        </aside>
    );
}
