
import { useState, useRef } from 'react';
import { API_URL } from '../app/api';
import { useToast } from './Toast';

type InvoicePreviewModalProps = {
    isOpen: boolean;
    onClose: () => void;
    invoice: any;
};

export default function InvoicePreviewModal({ isOpen, onClose, invoice }: InvoicePreviewModalProps) {
    const [sending, setSending] = useState(false);
    const [channel, setChannel] = useState<'email' | 'whatsapp' | null>(null);
    const { showToast } = useToast();

    if (!isOpen || !invoice) return null;

    const handleSend = async (selectedChannel: 'email' | 'whatsapp') => {
        setSending(true);
        try {
            const token = localStorage.getItem('crm_token');
            const headers: any = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_URL}/invoices/${invoice.id}/send`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ channel: selectedChannel })
            });

            if (res.ok) {
                showToast(`Enviado por ${selectedChannel === 'email' ? 'Correo' : 'WhatsApp'}`, 'success');
                setChannel(null); // Reset selection
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al enviar', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Error de conexión', 'error');
        } finally {
            setSending(false);
        }
    };

    const handlePaymentLink = async () => {
        try {
            const token = localStorage.getItem('crm_token');
            const headers: any = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_URL}/invoices/${invoice.id}/payment-link`, {
                method: 'POST',
                headers
            });

            if (res.ok) {
                const data = await res.json();
                window.open(data.url, '_blank');
            } else {
                showToast('No se pudo generar el link de pago', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        }
    };

    const handleDownload = async () => {
        try {
            const token = localStorage.getItem('crm_token');
            const headers: any = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_URL}/invoices/${invoice.id}/pdf`, { headers });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${invoice.type === 'QUOTE' ? 'Propuesta' : 'Factura'}-${invoice.number}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                showToast('Error al descargar PDF', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        }
    };

    const currencySymbol = invoice.currency === 'VES' ? 'Bs.' : '$';

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${invoice.type === 'QUOTE' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                            {invoice.type === 'QUOTE' ? '📄 Propuesta' : '💰 Factura'}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800">{invoice.number}</h3>
                            <p className="text-xs text-gray-500">{new Date(invoice.items ? invoice.createdAt : invoice.issueDate).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {/* Channel Selection Popover (Simple Toggle for now) */}
                        {channel ? (
                            <div className="flex gap-2 animate-fadeIn bg-white border border-gray-200 p-1 rounded-xl shadow-lg">
                                <button
                                    onClick={() => handleSend('whatsapp')}
                                    disabled={sending}
                                    className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm font-bold hover:bg-green-600"
                                >
                                    WhatsApp
                                </button>
                                <button
                                    onClick={() => handleSend('email')}
                                    disabled={sending}
                                    className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600"
                                >
                                    Email
                                </button>
                                <button onClick={() => setChannel(null)} className="px-2 text-gray-400">✕</button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setChannel('email')}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                            >
                                📤 Enviar
                            </button>
                        )}

                        <button
                            onClick={handleDownload}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 flex items-center gap-2"
                        >
                            ⬇️ Descargar PDF
                        </button>

                        {invoice.type === 'INVOICE' && (
                            <button
                                onClick={handlePaymentLink}
                                className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                            >
                                💳 Pagar
                            </button>
                        )}

                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                            ✕
                        </button>
                    </div>
                </div>

                {/* PDF Preview (HTML Representation) */}
                <div className="flex-1 overflow-y-auto bg-gray-100 p-8 flex justify-center">
                    <div className="bg-white shadow-xl w-full max-w-[21cm] min-h-[29.7cm] p-[2.5cm] text-sm relative">
                        {/* Watermark for Quotes */}
                        {invoice.type === 'QUOTE' && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none select-none">
                                <span className="text-[120px] font-bold text-gray-900 -rotate-45">BORRADOR</span>
                            </div>
                        )}

                        {/* Top */}
                        <div className="flex justify-between mb-12">
                            <div>
                                <h1 className="text-4xl font-bold text-gray-900 mb-2">{invoice.type === 'QUOTE' ? 'PROPUESTA' : 'FACTURA'}</h1>
                                <p className="text-gray-500 font-bold">#{invoice.number}</p>
                            </div>
                            <div className="text-right text-gray-500">
                                <h2 className="font-bold text-xl text-gray-800 mb-1">ChronusCRM</h2>
                                <p>Calle Principal 123</p>
                                <p>Caracas, Venezuela</p>
                                <p>support@chronuscrm.com</p>
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-2 gap-12 mb-12">
                            <div>
                                <h3 className="text-gray-400 font-bold uppercase text-xs mb-3">Facturado a:</h3>
                                <p className="font-bold text-lg text-gray-800">{invoice.customer?.name || invoice.lead?.name}</p>
                                <p className="text-gray-600">{invoice.customer?.email || invoice.lead?.email}</p>
                                <p className="text-gray-600">{invoice.customer?.company || invoice.lead?.company}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h3 className="text-gray-400 font-bold uppercase text-xs mb-1">{invoice.type === 'QUOTE' ? 'Fecha' : 'Emisión'}</h3>
                                    <p className="font-bold text-gray-800">{new Date(invoice.createdAt).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <h3 className="text-gray-400 font-bold uppercase text-xs mb-1">{invoice.type === 'QUOTE' ? 'Válido hasta' : 'Vence'}</h3>
                                    <p className="font-bold text-gray-800">{new Date(invoice.dueDate).toLocaleDateString()}</p>
                                </div>
                                {invoice.currency && (
                                    <div>
                                        <h3 className="text-gray-400 font-bold uppercase text-xs mb-1">Moneda</h3>
                                        <p className="font-bold text-gray-800">{invoice.currency}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Items Table */}
                        <table className="w-full mb-12 border-collapse">
                            <thead>
                                <tr className="border-b-2 border-gray-100">
                                    <th className="text-left py-4 text-xs font-bold text-gray-400 uppercase">Descripción</th>
                                    <th className="text-right py-4 text-xs font-bold text-gray-400 uppercase w-24">Cant.</th>
                                    <th className="text-right py-4 text-xs font-bold text-gray-400 uppercase w-32">Precio</th>
                                    <th className="text-right py-4 text-xs font-bold text-gray-400 uppercase w-32">Total</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-700">
                                {invoice.items?.map((item: any) => (
                                    <tr key={item.id} className="border-b border-gray-50">
                                        <td className="py-4 font-medium">{item.description}</td>
                                        <td className="py-4 text-right">{item.quantity}</td>
                                        <td className="py-4 text-right">{currencySymbol}{item.unitPrice.toFixed(2)}</td>
                                        <td className="py-4 text-right font-bold text-gray-900">{currencySymbol}{item.total.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Totals */}
                        <div className="flex justify-end">
                            <div className="w-64 space-y-3">
                                <div className="flex justify-between text-gray-600">
                                    <span>Subtotal:</span>
                                    <span className="font-medium">{currencySymbol}{invoice.subtotal?.toFixed(2) || invoice.amount.toFixed(2)}</span>
                                </div>
                                {invoice.tax > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>Impuestos:</span>
                                        <span className="font-medium">{currencySymbol}{invoice.tax.toFixed(2)}</span>
                                    </div>
                                )}
                                {invoice.discount > 0 && (
                                    <div className="flex justify-between text-green-600">
                                        <span>Descuento:</span>
                                        <span className="font-medium">-{currencySymbol}{invoice.discount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-xl font-bold text-gray-900 border-t border-gray-200 pt-3">
                                    <span>Total:</span>
                                    <span>{currencySymbol}{invoice.amount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="absolute bottom-[2.5cm] left-[2.5cm] right-[2.5cm] text-center text-gray-400 text-xs">
                            <p className="mb-2">Gracias por confiar en nosotros.</p>
                            <p>{invoice.terms || "Pago requerido dentro de los términos acordados."}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
