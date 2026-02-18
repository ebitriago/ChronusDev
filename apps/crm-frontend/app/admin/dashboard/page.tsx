"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import OrganizationList from "@/components/Admin/OrganizationList";
import UserList from "@/components/Admin/UserList";
import SubscriptionManager from "@/components/Admin/SubscriptionManager";

export default function SuperAdminDashboard() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'orgs' | 'users' | 'subscriptions'>('orgs');
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("crm_token");
        if (!token) {
            router.push("/auth/login");
            return;
        }

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            console.log("Admin Dashboard Token Payload:", payload);

            // Allow access if role is SUPER_ADMIN
            if (payload.role === "SUPER_ADMIN") {
                setIsAdmin(true);
            } else {
                console.error("Access Denied: User is not SUPER_ADMIN", payload.role);
                // router.push("/"); // Commented out to prevent loop during debug, or show access denied screen
                // For now, let's show an error state instead of redirecting immediately
            }
        } catch (e) {
            console.error("Token parse error", e);
            router.push("/auth/login");
        }
    }, [router]);

    if (!isAdmin) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-600">Acceso Denegado</h1>
                    <p className="mt-2 text-gray-600">Esta cuenta no tiene permisos de Super Administrador.</p>
                    <div className="flex flex-col gap-2 mt-4">
                        <button onClick={() => router.push('/')} className="text-emerald-600 hover:underline">
                            Volver al Inicio
                        </button>
                        <button
                            onClick={() => {
                                localStorage.removeItem("crm_token");
                                localStorage.removeItem("crm_user");
                                window.location.href = "/auth/login";
                            }}
                            className="text-gray-500 hover:text-gray-700 text-sm"
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Mobile Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar Navigation */}
            <div className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:sticky md:top-0 md:h-screen md:flex-shrink-0`}>
                <Sidebar
                    currentView="super-admin"
                    onChangeView={(v) => {
                        if (v !== 'super-admin') {
                            router.push("/");
                        }
                    }}
                    isCollapsed={sidebarCollapsed}
                    toggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                    userRole="SUPER_ADMIN"
                    enabledServices="ALL"
                />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen transition-all duration-300 overflow-x-hidden">
                {/* Mobile Header */}
                <div className="md:hidden h-16 bg-white border-b border-gray-100 flex items-center px-4 sticky top-0 z-30">
                    <button
                        onClick={() => setMobileMenuOpen(true)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <span className="ml-3 font-semibold text-gray-800">Super Admin</span>
                </div>

                <div className="p-8 max-w-7xl mx-auto w-full">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-900">SaaS Control Center</h1>
                        <p className="text-gray-600 mt-2">
                            Manage your Platform, Organizations and Users.
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 mb-8">
                        <button
                            onClick={() => setActiveTab('orgs')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'orgs' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            Organizations
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'users' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            Users
                        </button>
                        <button
                            onClick={() => setActiveTab('subscriptions')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'subscriptions' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            Subscriptions
                        </button>
                    </div>

                    {activeTab === 'orgs' && <OrganizationList />}
                    {activeTab === 'users' && <UserList />}
                    {activeTab === 'subscriptions' && <SubscriptionManager />}
                </div>
            </div>
        </div>
    );
}
