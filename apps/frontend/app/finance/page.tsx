'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TeamEarningsReport from '../../components/TeamEarningsReport';
import PaymentHistory from '../../components/PaymentHistory';
import AppLayout from '../../components/AppLayout';
import { getCurrentUser, getCrmLinkStatus, type User } from '../api';

export default function FinancePage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'earnings' | 'history'>('earnings');
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCrmLinked, setIsCrmLinked] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [currentUser, crmStatus] = await Promise.all([
                    getCurrentUser(),
                    getCrmLinkStatus()
                ]);
                setUser(currentUser);
                setIsCrmLinked(crmStatus?.linked || false);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const handleChangeView = (view: string) => {
        if (view === 'earnings') return;
        router.push(`/?view=${view}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-12 h-12 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600" />
            </div>
        );
    }

    // Redirect or show login if not user? For now just render AppLayout with null user if checks fail 
    // (though loadData sets user). If user is null, AppLayout might look empty sidebar.
    // page.tsx redirects to login if no user. We should probably do same or let AppLayout handle it.
    // simpler to just render.

    return (
        <AppLayout
            user={user}
            currentView="earnings"
            onChangeView={handleChangeView}
            mobileMenuOpen={mobileMenuOpen}
            setMobileMenuOpen={setMobileMenuOpen}
            isCrmLinked={isCrmLinked}
        >
            <div className="h-full overflow-y-auto bg-gray-50 dark:bg-slate-900 pb-12 transition-colors">
                <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-30 transition-colors">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16 items-center">
                            <div className="flex items-center gap-4">
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">💰 Finanzas</h1>
                                <nav className="flex space-x-1 bg-gray-100 dark:bg-slate-700/50 p-1 rounded-xl">
                                    <button
                                        onClick={() => setActiveTab('earnings')}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'earnings'
                                            ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                            }`}
                                    >
                                        Montos Adeudados
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('history')}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'history'
                                            ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                            }`}
                                    >
                                        Historial de Pagos
                                    </button>
                                </nav>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Dark Mode Toggle */}
                                <button
                                    onClick={() => {
                                        const isDark = document.documentElement.classList.toggle('dark');
                                        localStorage.setItem('darkMode', String(isDark));
                                    }}
                                    className="p-2 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
                                    title="Alternar tema"
                                >
                                    <span className="dark:hidden">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                                    </span>
                                    <span className="hidden dark:inline">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
                    {activeTab === 'earnings' ? (
                        <div className="space-y-6">
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-blue-700">
                                            Aquí puedes ver los montos generados por el equipo (Deuda) y registrar pagos parciales o totales.
                                            El balance se actualizará automáticamente.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <TeamEarningsReport />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-emerald-700">
                                            Historial completo de pagos realizados. Puedes descargar recibos individuales o eliminar registros incorrectos.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <PaymentHistory />
                        </div>
                    )}
                </main>
            </div>
        </AppLayout>
    );
}
