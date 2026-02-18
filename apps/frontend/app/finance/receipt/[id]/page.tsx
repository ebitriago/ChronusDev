'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPayments, type Payment } from '../../../api';
import { format } from 'date-fns';

export default function ReceiptPage() {
    const params = useParams();
    const id = params.id as string;
    const [payment, setPayment] = useState<Payment | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            loadPayment();
        }
    }, [id]);

    async function loadPayment() {
        // Since we don't have a direct getPayment(id) endpoint exposed in api.ts yet, 
        // we can fetch all (filtered by user if needed, but for now just filter client side from list). 
        // Ideally we should add getPayment(id) to backend. 
        // For now, let's try to find it in the list.
        try {
            const payments = await getPayments();
            const found = payments.find(p => p.id === id);
            setPayment(found || null);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div className="p-12 text-center text-gray-500">Cargando recibo...</div>;
    if (!payment) return <div className="p-12 text-center text-red-500">Recibo no encontrado.</div>;

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 p-8 print:p-0">
            <style jsx global>{`
                @media print {
                    @page { margin: 0; }
                    body { margin: 1.6cm; }
                    .no-print { display: none; }
                }
            `}</style>

            <div className="max-w-3xl mx-auto border border-gray-200 dark:border-slate-700 p-12 rounded-xl shadow-sm print:shadow-none print:border-none print:p-0 bg-white dark:bg-slate-800">
                {/* Header */}
                <div className="flex justify-between items-start border-b border-gray-100 dark:border-slate-700 pb-8 mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">RECIBO DE PAGO</h1>
                        <p className="text-gray-500 dark:text-gray-400">#{payment.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500 mb-1">ChronusDev</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Servicios de Desarrollo de Software</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">finance@chronusdev.com</div>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-12 mb-12">
                    <div>
                        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Pagado A</h3>
                        <div className="text-xl font-bold text-gray-900 dark:text-white mb-1">{payment.userName}</div>
                        <div className="text-gray-600 dark:text-gray-300">{payment.user?.email}</div>
                    </div>
                    <div className="text-right">
                        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Detalles del Pago</h3>
                        <div className="flex justify-end gap-x-8 gap-y-2 flex-wrap">
                            <div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Fecha de Pago</div>
                                <div className="font-medium">{format(new Date(payment.createdAt), 'dd MMM yyyy')}</div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Mes Aplicado</div>
                                <div className="font-medium capitalize">{payment.month}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Amount */}
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-8 mb-8 print:bg-gray-50">
                    <div className="flex justify-between items-center">
                        <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Monto Total Pagado</span>
                        <span className="text-4xl font-bold text-emerald-600 dark:text-emerald-500">${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="text-right text-gray-500 dark:text-gray-400 text-sm mt-2 uppercase tracking-wide">
                        {payment.currency}
                    </div>
                </div>

                {/* Note */}
                {payment.note && (
                    <div className="mb-12">
                        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Notas / Concepto</h3>
                        <p className="text-gray-700 dark:text-gray-300 italic border-l-4 border-gray-200 dark:border-slate-600 pl-4 py-2">
                            {payment.note}
                        </p>
                    </div>
                )}

                {/* Footer */}
                <div className="border-t border-gray-100 dark:border-slate-700 pt-8 text-center">
                    <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">Gracias por tu trabajo duro y dedicación.</p>
                    <div className="flex justify-center gap-4 no-print">
                        <button
                            onClick={() => window.print()}
                            className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-2 rounded-lg font-medium hover:bg-black dark:hover:bg-gray-100 transition-colors flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Imprimir / Guardar PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
