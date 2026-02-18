
'use client';

import { useState, useEffect } from 'react';
import { API_URL } from '../app/api';
import { useToast } from './Toast';

export default function BillingSettings() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [upgrading, setUpgrading] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        fetchBillingData();
    }, []);

    const fetchBillingData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('crm_token');
            const headers = { 'Authorization': `Bearer ${token}` };

            const [subRes, invRes] = await Promise.all([
                fetch(`${API_URL}/billing/subscription`, { headers }),
                fetch(`${API_URL}/billing/invoices`, { headers })
            ]);

            if (subRes.ok) setData(await subRes.json());
            if (invRes.ok) setInvoices(await invRes.json());

        } catch (error) {
            console.error(error);
            showToast('Error cargando información de facturación', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async (plan: string) => {
        if (!confirm(`¿Estás seguro de cambiar al plan ${plan}? Se generará una factura inmediatamente.`)) return;

        setUpgrading(true);
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/billing/upgrade`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ plan })
            });

            if (res.ok) {
                showToast(`Plan actualizado a ${plan} exitosamente`, 'success');
                fetchBillingData();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al actualizar plan', 'error');
            }
        } catch (err) {
            showToast('Error de conexión', 'error');
        } finally {
            setUpgrading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando facturación...</div>;
    if (!data) return <div className="p-8 text-center text-red-500">No se pudo cargar la información.</div>;

    const { plan, seats, nextBillingDate } = data;
    const usagePercent = Math.min(100, (seats.total / seats.limit) * 100);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Suscripción y Facturación</h2>
                <p className="text-sm text-gray-500">Gestiona tu plan, métodos de pago y descarga facturas.</p>
            </div>

            {/* Current Plan Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-indigo-200 text-sm font-medium uppercase tracking-wider mb-1">Plan Actual</p>
                                <h3 className="text-3xl font-bold">{plan} {plan === 'FREE' && '✨'}</h3>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${data.status === 'ACTIVE' ? 'bg-emerald-400 text-emerald-900' : 'bg-red-400 text-red-900'}`}>
                                {data.status}
                            </span>
                        </div>

                        <div className="mb-6">
                            <div className="flex justify-between text-sm mb-2 opacity-90">
                                <span>Usuarios del equipo</span>
                                <span>{seats.total} / {seats.limit === 999 ? '∞' : seats.limit}</span>
                            </div>
                            <div className="w-full bg-indigo-900/40 rounded-full h-2">
                                <div
                                    className="bg-white rounded-full h-2 transition-all duration-1000"
                                    style={{ width: `${usagePercent}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            {plan === 'FREE' && (
                                <button
                                    onClick={() => handleUpgrade('PRO')}
                                    disabled={upgrading}
                                    className="bg-white text-indigo-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-100 transition shadow-sm"
                                >
                                    Mejorar a PRO ($45/mes)
                                </button>
                            )}
                            {plan !== 'ENTERPRISE' && (
                                <button
                                    onClick={() => handleUpgrade('ENTERPRISE')}
                                    disabled={upgrading}
                                    className="bg-indigo-500/20 text-white border border-white/20 px-4 py-2 rounded-lg font-bold text-sm hover:bg-white/10 transition"
                                >
                                    Contactar Ventas Enterprise
                                </button>
                            )}
                        </div>
                    </div>
                    {/* Decorative Blob */}
                    <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                </div>

                {/* Billing Info */}
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-center">
                    <h4 className="text-gray-900 font-bold mb-4">Información de Pago</h4>
                    <div className="flex items-center gap-3 mb-4 text-gray-600">
                        <div className="w-10 h-6 bg-gray-200 rounded flex items-center justify-center text-xs">VISA</div>
                        <span className="text-sm font-mono">•••• 4242</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-4">
                        Próxima factura: {new Date(nextBillingDate).toLocaleDateString()}
                    </p>
                    <button className="text-indigo-600 text-sm font-bold hover:underline self-start">
                        Actualizar Método al Pago
                    </button>
                </div>
            </div>

            {/* Invoices List */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-gray-800">Historial de Facturas</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3">Fecha</th>
                                <th className="px-6 py-3">Monto</th>
                                <th className="px-6 py-3">Estado</th>
                                <th className="px-6 py-3">ID Factura</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {invoices.length > 0 ? invoices.map((inv) => (
                                <tr key={inv.id} className="hover:bg-gray-50/50">
                                    <td className="px-6 py-4 text-gray-900">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-mono">${inv.amount.toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded textxs font-bold ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {inv.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-400 font-mono text-xs">{inv.id.slice(-8)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-indigo-600 hover:text-indigo-800 font-medium text-xs">Ver PDF</button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic">
                                        No hay facturas registradas aún.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
