'use client';

import { useState, useEffect } from 'react';
import TransactionModal from './TransactionModal';
import { API_URL } from '../app/api';

type Transaction = {
    id: string;
    date: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    category: string;
    description: string;
    status: string;
    customerId?: string;
    reference?: string;
};

export default function Finances({ customers }: { customers: any[] }) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/transactions`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setTransactions(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    // Calculate stats
    const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
    const netProfit = totalIncome - totalExpenses;

    const filteredTransactions = filterType === 'ALL'
        ? transactions
        : transactions.filter(t => t.type === filterType);

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">↓</div>
                        <span className="text-sm font-bold text-gray-500 uppercase">Ingresos Totales</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">${totalIncome.toLocaleString()}</div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center">↑</div>
                        <span className="text-sm font-bold text-gray-500 uppercase">Gastos Totales</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">${totalExpenses.toLocaleString()}</div>
                </div>

                <div className={`p-6 rounded-2xl border shadow-sm ${netProfit >= 0 ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-white/50 text-gray-600 flex items-center justify-center">=</div>
                        <span className="text-sm font-bold text-gray-600 uppercase">Beneficio Neto</span>
                    </div>
                    <div className={`text-3xl font-bold ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        ${netProfit.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Main List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilterType('ALL')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${filterType === 'ALL' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilterType('INCOME')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${filterType === 'INCOME' ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                        >
                            Ingresos
                        </button>
                        <button
                            onClick={() => setFilterType('EXPENSE')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${filterType === 'EXPENSE' ? 'bg-red-100 text-red-700' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                        >
                            Gastos
                        </button>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors text-sm font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                    >
                        <span>+</span> Nueva Transacción
                    </button>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-400">Cargando transacciones...</div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 text-left">
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Concepto</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Categoría</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredTransactions.map(t => {
                                const customer = customers.find(c => c.id === t.customerId);
                                return (
                                    <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(t.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-semibold text-gray-900">{t.description}</p>
                                            <p className="text-xs text-gray-400 capitalize">{t.reference}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200">
                                                {t.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {customer?.name || '-'}
                                        </td>
                                        <td className={`px-6 py-4 text-right font-mono font-bold ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {t.type === 'INCOME' ? '+' : '-'}${t.amount.toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            <TransactionModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={fetchTransactions}
                customers={customers}
            />
        </div>
    );
}
