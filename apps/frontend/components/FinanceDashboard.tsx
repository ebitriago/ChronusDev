'use client';

import { useState } from 'react';
import TeamEarningsReport from './TeamEarningsReport';
import PaymentHistory from './PaymentHistory';

export default function FinanceDashboard() {
    const [activeTab, setActiveTab] = useState<'earnings' | 'history'>('earnings');

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">💰 Finanzas</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Gestión completa de nómina y pagos del equipo</p>
                </div>

                {/* Tabs */}
                <div className="bg-gray-100 dark:bg-slate-800 p-1 rounded-xl inline-flex">
                    <button
                        onClick={() => setActiveTab('earnings')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'earnings'
                            ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                    >
                        Montos Adeudados
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'history'
                            ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                    >
                        Historial de Pagos
                    </button>
                </div>
            </div>

            <div className="animate-fadeIn">
                {activeTab === 'earnings' ? (
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-r-lg">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                        Aquí puedes ver los montos generados por el equipo (Deuda) y registrar pagos.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <TeamEarningsReport />
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 p-4 rounded-r-lg">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                                        Historial completo de pagos. Descarga recibos individuales o elimina registros.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <PaymentHistory />
                    </div>
                )}
            </div>
        </div>
    );
}
