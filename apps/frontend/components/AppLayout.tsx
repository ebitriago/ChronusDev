'use client';

import { useState } from 'react';
import Sidebar, { View, UserRole } from './Sidebar';

// We define a partial User interface to avoid importing the full one if it causes circular deps or is not exported. 
// Or better, import if available. Looking at page.tsx, it imports User from './api'.
// But api.ts is in app/api.ts. We are in components/AppLayout.tsx.
// Relative path to app/api.ts from components/AppLayout.tsx is ../app/api
import { User } from '../app/api';

interface AppLayoutProps {
    children: React.ReactNode;
    user: User | null;
    currentView: View;
    onChangeView: (view: View) => void;
    mobileMenuOpen?: boolean;
    setMobileMenuOpen?: (open: boolean) => void;
    isCrmLinked?: boolean;
}

export default function AppLayout({
    children,
    user,
    currentView,
    onChangeView,
    mobileMenuOpen: externalMobileMenuOpen,
    setMobileMenuOpen: externalSetMobileMenuOpen,
    isCrmLinked = false
}: AppLayoutProps) {
    const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Use external control if provided, otherwise internal state
    const isMobileMenuControlled = externalMobileMenuOpen !== undefined && externalSetMobileMenuOpen !== undefined;
    const mobileMenuOpen = isMobileMenuControlled ? externalMobileMenuOpen : internalMobileMenuOpen;
    const setMobileMenuOpen = isMobileMenuControlled ? externalSetMobileMenuOpen : setInternalMobileMenuOpen;

    if (!setMobileMenuOpen) return null; // Should not happen given logic above

    return (
        <div className="h-screen bg-white dark:bg-slate-900 flex overflow-hidden">
            {/* Mobile Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar Component */}
            <div className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:static md:h-full md:flex-shrink-0 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 shadow-xl md:shadow-none`}>
                <Sidebar
                    currentView={currentView}
                    onChangeView={(v) => {
                        onChangeView(v);
                        setMobileMenuOpen(false);
                    }}
                    isCollapsed={sidebarCollapsed}
                    toggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                    isSuperAdmin={user?.role === 'SUPER_ADMIN'}
                    userRole={user?.role as UserRole}
                    isCrmLinked={isCrmLinked}
                    crmUrl={process.env.NEXT_PUBLIC_CRM_APP_URL}
                    user={user}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full relative min-w-0 overflow-hidden">
                {children}
            </div>
        </div>
    );
}
