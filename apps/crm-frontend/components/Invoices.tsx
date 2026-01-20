'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';

const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://127.0.0.1:3002';

type Customer = {
    id: string;
    name: string;
    email: string;
};

type Invoice = {
    id: string;
    customerId: string;
    customer?: Customer;
    number: string;
    amount: number;
    currency: string;
    status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    dueDate: string;
    paidAt?: string;
    items: { description: string; quantity: number; unitPrice: number; total: number }[];
    createdAt: string;
};

export default function Invoices() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [filter, setFilter] = useState<string>('');
    const { showToast } = useToast();

    const [newInvoice, setNewInvoice] = useState({
        customerId: '',
        amount: 0,
        currency: 'USD',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description: 'Servicio profesional'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [invRes, custRes] = await Promise.all([
                fetch(`${API_URL}/invoices`),
                fetch(`${API_URL}/customers`)
            ]);
            if (invRes.ok) setInvoices(await invRes.json());
            if (custRes.ok) setCustomers(await custRes.json());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newInvoice.customerId || !newInvoice.amount) {
            showToast('Selecciona cliente y monto', 'error');
            return;
        }
        try {
            const res = await fetch(`${API_URL}/invoices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: newInvoice.customerId,
                    amount: newInvoice.amount,
                    currency: newInvoice.currency,
                    dueDate: newInvoice.dueDate,
                    items: [{ description: newInvoice.description, quantity: 1, unitPrice: newInvoice.amount, total: newInvoice.amount }]
                })
            });
            if (res.ok) {
                showToast('Factura creada', 'success');
                setShowModal(false);
                setNewInvoice({ customerId: '', amount: 0, currency: 'USD', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], description: 'Servicio profesional' });
                fetchData();
            }
        } catch (err) {
            showToast('Error creando factura', 'error');
        }
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            const res = await fetch(`${API_URL}/invoices/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                showToast(`Factura marcada como ${status}`, 'success');
                fetchData();
            }
        } catch (err) {
            showToast('Error actualizando factura', 'error');
        }
    };

    const statusColors: Record<string, string> = {
        DRAFT: 'bg-gray-100 text-gray-700',
        SENT: 'bg-blue-100 text-blue-700',
        PAID: 'bg-emerald-100 text-emerald-700',
        OVERDUE: 'bg-red-100 text-red-700',
        CANCELLED: 'bg-gray-100 text-gray-500 line-through'
    };

    const filteredInvoices = filter
        ? invoices.filter(i => i.status === filter)
        : invoices;

    const totals = {
        total: invoices.reduce((acc, i) => acc + i.amount, 0),
        paid: invoices.filter(i => i.status === 'PAID').reduce((acc, i) => acc + i.amount, 0),
        pending: invoices.filter(i => ['DRAFT', 'SENT'].includes(i.status)).reduce((acc, i) => acc + i.amount, 0),
        overdue: invoices.filter(i => i.status === 'OVERDUE').reduce((acc, i) => acc + i.amount, 0)
    };

    if (loading) {
        return <div className="text-center py-20 text-gray-400">Cargando facturas...</div>;
    }

    return (
        <div className="animate-fadeIn space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-sm text-gray-500">Total Facturado</div>
                    <div className="text-2xl font-bold text-gray-900">${totals.total.toLocaleString()}</div>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <div className="text-sm text-emerald-600">Pagado</div>
                    <div className="text-2xl font-bold text-emerald-700">${totals.paid.toLocaleString()}</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <div className="text-sm text-blue-600">Pendiente</div>
                    <div className="text-2xl font-bold text-blue-700">${totals.pending.toLocaleString()}</div>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                    <div className="text-sm text-red-600">Vencido</div>
                    <div className="text-2xl font-bold text-red-700">${totals.overdue.toLocaleString()}</div>
                </div>
            </div>

            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex gap-2">
                    {['', 'DRAFT', 'SENT', 'PAID', 'OVERDUE'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === status
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {status || 'Todas'}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20"
                >
                    + Nueva Factura
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-left">
                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Número</th>
                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Cliente</th>
                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase text-right">Monto</th>
                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Vencimiento</th>
                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Estado</th>
                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredInvoices.map(inv => (
                            <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <span className="font-mono font-bold text-gray-900">{inv.number}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="font-medium text-gray-900">{inv.customer?.name || 'N/A'}</p>
                                    <p className="text-xs text-gray-500">{inv.customer?.email}</p>
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">
                                    {inv.currency} ${inv.amount.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                    {new Date(inv.dueDate).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${statusColors[inv.status]}`}>
                                        {inv.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-1">
                                        {inv.status === 'DRAFT' && (
                                            <button
                                                onClick={() => handleUpdateStatus(inv.id, 'SENT')}
                                                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200"
                                            >
                                                Enviar
                                            </button>
                                        )}
                                        {['DRAFT', 'SENT', 'OVERDUE'].includes(inv.status) && (
                                            <button
                                                onClick={() => handleUpdateStatus(inv.id, 'PAID')}
                                                className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-200"
                                            >
                                                Marcar Pagada
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredInvoices.length === 0 && (
                    <div className="text-center py-10 text-gray-400">No hay facturas</div>
                )}
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Nueva Factura</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                                <select
                                    value={newInvoice.customerId}
                                    onChange={e => setNewInvoice({ ...newInvoice, customerId: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                                >
                                    <option value="">Seleccionar...</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                                <input
                                    type="text"
                                    value={newInvoice.description}
                                    onChange={e => setNewInvoice({ ...newInvoice, description: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                    placeholder="Concepto de la factura"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
                                    <input
                                        type="number"
                                        value={newInvoice.amount}
                                        onChange={e => setNewInvoice({ ...newInvoice, amount: Number(e.target.value) })}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                                    <select
                                        value={newInvoice.currency}
                                        onChange={e => setNewInvoice({ ...newInvoice, currency: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                                    >
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="MXN">MXN</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Vencimiento</label>
                                <input
                                    type="date"
                                    value={newInvoice.dueDate}
                                    onChange={e => setNewInvoice({ ...newInvoice, dueDate: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={!newInvoice.customerId || !newInvoice.amount}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold"
                                >
                                    Crear Factura
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
