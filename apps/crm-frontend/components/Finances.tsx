'use client';

import { useState, useEffect, useMemo } from 'react';
import TransactionModal from './TransactionModal';
import { API_URL } from '../app/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

    // Filters
    const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
    const [filterCategory, setFilterCategory] = useState<string>('ALL');
    const [filterCustomer, setFilterCustomer] = useState<string>('ALL');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('crm_token');
            // Build query params
            const params = new URLSearchParams({
                startDate: dateRange.start,
                endDate: dateRange.end
            });
            if (filterType !== 'ALL') params.append('type', filterType);
            if (filterCategory !== 'ALL') params.append('category', filterCategory);

            const res = await fetch(`${API_URL}/transactions?${params.toString()}`, {
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
    }, [dateRange, filterType, filterCategory]);

    // Client-side filtering (extra safety)
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            if (filterCustomer !== 'ALL' && t.customerId !== filterCustomer) return false;
            return true;
        });
    }, [transactions, filterCustomer]);

    // Calculate stats
    const totalIncome = filteredTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    const totalExpenses = filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
    const netProfit = totalIncome - totalExpenses;
    const estimatedTax = totalIncome * 0.16; // 16% VAT estimation example

    // Get unique categories for filter
    const categories = useMemo(() => Array.from(new Set(transactions.map(t => t.category))), [transactions]);

    // Export functions
    const downloadCSV = () => {
        const headers = ["Fecha", "Tipo", "Categoria", "Descripcion", "Cliente", "Monto"];
        const rows = filteredTransactions.map(t => [
            new Date(t.date).toLocaleDateString(),
            t.type,
            t.category,
            t.description,
            customers.find(c => c.id === t.customerId)?.name || '-',
            t.amount.toString()
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finanzas_${dateRange.start}_${dateRange.end}.csv`;
        a.click();
    };

    const downloadPDF = () => {
        const doc = new jsPDF();

        doc.text("Reporte Financiero - ChronusCRM", 14, 20);
        doc.text(`Periodo: ${dateRange.start} a ${dateRange.end}`, 14, 28);
        doc.text(`Ingresos: $${totalIncome.toLocaleString()} | Gastos: $${totalExpenses.toLocaleString()} | Neto: $${netProfit.toLocaleString()}`, 14, 36);

        const tableColumn = ["Fecha", "Tipo", "Cat", "Descripción", "Cliente", "Monto"];
        const tableRows = filteredTransactions.map(t => [
            new Date(t.date).toLocaleDateString(),
            t.type === 'INCOME' ? 'Ingreso' : 'Gasto',
            t.category,
            t.description,
            customers.find(c => c.id === t.customerId)?.name || '-',
            `$${t.amount.toLocaleString()}`
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 45,
        });

        doc.save(`reporte_finanzas_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">↓</div>
                        <span className="text-sm font-bold text-gray-500 uppercase">Ingresos</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">${totalIncome.toLocaleString()}</div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center">↑</div>
                        <span className="text-sm font-bold text-gray-500 uppercase">Gastos</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">${totalExpenses.toLocaleString()}</div>
                </div>

                <div className={`p-6 rounded-2xl border shadow-sm ${netProfit >= 0 ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-white/50 text-gray-600 flex items-center justify-center">=</div>
                        <span className="text-sm font-bold text-gray-600 uppercase">Neto</span>
                    </div>
                    <div className={`text-3xl font-bold ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        ${netProfit.toLocaleString()}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">%</div>
                        <span className="text-sm font-bold text-gray-500 uppercase">Impuestos Est. (16%)</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-700">${estimatedTax.toLocaleString()}</div>
                </div>
            </div>

            {/* Controls & List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">

                    {/* Filters */}
                    <div className="flex flex-wrap gap-2 items-center">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="px-3 py-2 border rounded-lg text-sm"
                        />
                        <span className="text-gray-400">→</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="px-3 py-2 border rounded-lg text-sm"
                        />

                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as any)}
                            className="px-3 py-2 border rounded-lg text-sm bg-gray-50 font-medium"
                        >
                            <option value="ALL">Todos los Tipos</option>
                            <option value="INCOME">Ingresos</option>
                            <option value="EXPENSE">Gastos</option>
                        </select>

                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="px-3 py-2 border rounded-lg text-sm bg-gray-50 font-medium"
                        >
                            <option value="ALL">Todas las Categorías</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>

                        <select
                            value={filterCustomer}
                            onChange={(e) => setFilterCustomer(e.target.value)}
                            className="px-3 py-2 border rounded-lg text-sm bg-gray-50 font-medium max-w-[150px]"
                        >
                            <option value="ALL">Todos los Clientes</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={downloadCSV}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl font-bold text-sm transition-colors border border-gray-200"
                        >
                            📄 CSV
                        </button>
                        <button
                            onClick={downloadPDF}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl font-bold text-sm transition-colors border border-gray-200"
                        >
                            📥 PDF
                        </button>
                        <button
                            onClick={() => setShowModal(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors text-sm font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                        >
                            <span>+</span> Nueva Transacción
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-400">Cargando transacciones...</div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
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
                                                    <p className="font-semibold text-gray-900 capitalize">{t.description}</p>
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
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {filteredTransactions.map(t => {
                                const customer = customers.find(c => c.id === t.customerId);
                                return (
                                    <div key={t.id} className="p-4 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <span className="text-xs text-gray-500 font-medium">
                                                {new Date(t.date).toLocaleDateString()}
                                            </span>
                                            <span className={`font-mono font-bold text-lg ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {t.type === 'INCOME' ? '+' : '-'}${t.amount.toLocaleString()}
                                            </span>
                                        </div>

                                        <div>
                                            <p className="font-bold text-gray-900 capitalize mb-1">{t.description}</p>
                                            {customer && (
                                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                                    👤 {customer.name}
                                                </p>
                                            )}
                                        </div>

                                        <div className="pt-1">
                                            <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200">
                                                {t.category}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {filteredTransactions.length === 0 && (
                            <div className="text-center py-10 text-gray-400">No hay transacciones</div>
                        )}
                    </>
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
