'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://127.0.0.1:3002';

type Customer = any; // Simplifying for speed, ideally import types
type Transaction = any;

export default function CustomerDetail({ customerId, onBack }: { customerId: string, onBack: () => void }) {
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'BILLING'>('OVERVIEW');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch customer details and transactions
        const fetchDetails = async () => {
            setLoading(true);
            try {
                const [custRes, txnRes] = await Promise.all([
                    fetch(`${API_URL}/customers/${customerId}`),
                    fetch(`${API_URL}/transactions?customerId=${customerId}`)
                ]);

                if (custRes.ok && txnRes.ok) {
                    const custData = await custRes.json();
                    const txnData = await txnRes.json();
                    setCustomer(custData);
                    setTransactions(txnData);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [customerId]);

    if (loading || !customer) return <div className="p-8 text-center text-gray-400">Cargando perfil...</div>;

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                >
                    ← Volver
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{customer.email}</span>
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${customer.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {customer.status}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <div className="flex gap-6">
                    <button
                        onClick={() => setActiveTab('OVERVIEW')}
                        className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'OVERVIEW' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Resumen
                    </button>
                    <button
                        onClick={() => setActiveTab('BILLING')}
                        className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'BILLING' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Facturación & Pagos
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 min-h-[400px]">
                {activeTab === 'OVERVIEW' && (
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Información de Contacto</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-gray-400">Empresa</label>
                                    <p className="font-medium">{customer.company || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Teléfono</label>
                                    <p className="font-medium">{customer.phone || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Plan Actual</label>
                                    <p className="font-medium">{customer.plan} (${customer.monthlyRevenue}/mo)</p>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Integración</h3>
                            {customer.chronusDevClientId ? (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <p className="text-sm font-semibold text-blue-800">✓ Sincronizado con ChronusDev</p>
                                    <p className="text-xs text-blue-600 mt-1">ID: {customer.chronusDevClientId}</p>
                                    <p className="text-xs text-blue-600">Proyecto Default: {customer.chronusDevDefaultProjectId || 'N/A'}</p>
                                </div>
                            ) : (
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <p className="text-sm text-gray-500">No sincronizado</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'BILLING' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900">Historial de Transacciones</h3>
                            <div className="text-right">
                                <p className="text-xs text-gray-400 uppercase">Total Facturado</p>
                                <p className="text-xl font-bold text-emerald-600">
                                    ${transactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        {transactions.length === 0 ? (
                            <p className="text-gray-400 text-center py-8">No hay transacciones registradas.</p>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left border-b border-gray-100">
                                        <th className="pb-3 text-xs font-bold text-gray-400 uppercase">Fecha</th>
                                        <th className="pb-3 text-xs font-bold text-gray-400 uppercase">Descripción</th>
                                        <th className="pb-3 text-xs font-bold text-gray-400 uppercase text-right">Monto</th>
                                        <th className="pb-3 text-xs font-bold text-gray-400 uppercase text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 border-b border-gray-50">
                                    {transactions.map(t => (
                                        <tr key={t.id}>
                                            <td className="py-3 text-sm text-gray-500">{new Date(t.date).toLocaleDateString()}</td>
                                            <td className="py-3 text-sm font-medium">{t.description}</td>
                                            <td className={`py-3 text-sm font-bold text-right ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-gray-900'}`}>
                                                {t.type === 'INCOME' ? '+' : '-'}${t.amount}
                                            </td>
                                            <td className="py-3 text-center">
                                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold">
                                                    {t.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
