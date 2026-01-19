'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://127.0.0.1:3002';

type Customer = any;
type Transaction = any;

const PLATFORM_CONFIG: any = {
    whatsapp: { color: 'bg-green-500', icon: '📱', label: 'WhatsApp' },
    instagram: { color: 'bg-pink-500', icon: '📸', label: 'Instagram' },
    assistai: { color: 'bg-purple-600', icon: '🤖', label: 'AssistAI' },
    messenger: { color: 'bg-blue-500', icon: '💬', label: 'Messenger' },
    email: { color: 'bg-orange-500', icon: '📧', label: 'Email' },
    phone: { color: 'bg-gray-500', icon: '📞', label: 'Teléfono' }
};

export default function CustomerDetail({ customerId, onBack }: { customerId: string, onBack: () => void }) {
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);
    const [conversations, setConversations] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'BILLING' | 'CONVERSATIONS'>('OVERVIEW');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch fetch 360 view
        const fetchDetails = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_URL}/clients/${customerId}/360`);
                if (res.ok) {
                    const data = await res.json();
                    setCustomer(data.client);
                    setContacts(data.contacts || []);
                    setConversations(data.conversations || []);
                    setTransactions(data.invoices || []); // Assuming transactions/invoices are similar or mapped

                    // Also fetch transactions if not fully covered by 360 or if different endpoint needed
                    // Keeping original fetch for transactions just in case, or relying on 360
                    const txnRes = await fetch(`${API_URL}/transactions?customerId=${customerId}`);
                    if (txnRes.ok) {
                        const txnData = await txnRes.json();
                        setTransactions(txnData);
                    }
                } else {
                    // Fallback to basic fetch if 360 fails (or for backward compat)
                    const custRes = await fetch(`${API_URL}/customers/${customerId}`);
                    if (custRes.ok) setCustomer(await custRes.json());
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [customerId]);

    if (loading || !customer) return <div className="p-8 text-center text-gray-400">Cargando perfil 360°...</div>;

    return (
        <div className="space-y-6 animate-fadeIn" id={`client-${customerId}`}>
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
                        {contacts.length > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">
                                {contacts.length} Contactos Conectados
                            </span>
                        )}
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
                        onClick={() => setActiveTab('CONVERSATIONS')}
                        className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'CONVERSATIONS' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Conversaciones ({conversations.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('BILLING')}
                        className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'BILLING' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Facturación
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 min-h-[400px]">
                {activeTab === 'OVERVIEW' && (
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Información de Contacto</h3>
                            <div className="space-y-4">
                                {contacts.length > 0 ? (
                                    contacts.map((contact: any, idx: number) => {
                                        const config = PLATFORM_CONFIG[contact.type] || PLATFORM_CONFIG.phone;
                                        return (
                                            <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${config.color}`}>
                                                    {config.icon}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-500 uppercase">{config.label}</p>
                                                    <p className="font-mono text-sm font-medium">{contact.value}</p>
                                                </div>
                                                {contact.verified && <span className="ml-auto text-blue-500 text-xs">✓ Verificado</span>}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-sm text-gray-400 italic">Sin contactos vinculados</p>
                                )}

                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <h4 className="text-xs font-bold text-gray-400 mb-2">Datos Generales</h4>
                                    <div className="space-y-2">
                                        <div>
                                            <label className="text-xs text-gray-400">Empresa</label>
                                            <p className="font-medium">{customer.company || '-'}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400">Plan</label>
                                            <p className="font-medium">{customer.plan} (${customer.monthlyRevenue}/mo)</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Integraciones & Notas</h3>
                            <div className="space-y-4">
                                {customer.chronusDevClientId ? (
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        <p className="text-sm font-semibold text-blue-800">✓ Sincronizado con ChronusDev</p>
                                        <p className="text-xs text-blue-600 mt-1">ID: {customer.chronusDevClientId}</p>
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <p className="text-sm text-gray-500">No sincronizado con ChronusDev</p>
                                    </div>
                                )}

                                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                                    <h4 className="text-xs font-bold text-yellow-800 mb-2">Notas Internas</h4>
                                    <p className="text-sm text-yellow-900">{customer.notes || 'Sin notas registradas.'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'CONVERSATIONS' && (
                    <div className="space-y-4">
                        {conversations.length === 0 ? (
                            <div className="text-center py-10">
                                <p className="text-4xl mb-3">📭</p>
                                <p className="text-gray-500">No hay historial de conversaciones.</p>
                            </div>
                        ) : (
                            conversations.map((conv: any, idx: number) => {
                                const config = PLATFORM_CONFIG[conv.platform] || PLATFORM_CONFIG.assistai;
                                return (
                                    <div key={idx} className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:bg-slate-50 transition-colors">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg ${config.color}`}>
                                            {config.icon}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-gray-800">{config.label} - {conv.contact}</h4>
                                                <span className="text-xs text-gray-400">{new Date(conv.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                {conv.lastMessage || 'Sin mensajes recientes'}
                                            </p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                                    {conv.messageCount} mensajes
                                                </span>
                                                <span className="text-xs text-blue-600 hover:underline cursor-pointer">
                                                    Ver conversación completa →
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
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
