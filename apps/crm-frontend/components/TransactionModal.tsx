'use client';

import { useState } from 'react';
import { API_URL } from '../app/api';

type TransactionType = 'INCOME' | 'EXPENSE';

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    customers: { id: string; name: string }[];
}

export default function TransactionModal({ isOpen, onClose, onSuccess, customers }: TransactionModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        amount: '',
        type: 'INCOME' as TransactionType,
        category: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        customerId: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/transactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                onSuccess();
                onClose();
                // Reset form
                setFormData({
                    amount: '',
                    type: 'INCOME',
                    category: '',
                    description: '',
                    date: new Date().toISOString().split('T')[0],
                    customerId: '',
                });
            } else {
                alert('Error al guardar transacción');
            }
        } catch (error) {
            console.error(error);
            alert('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900">Nueva Transacción</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    {/* Type Selection */}
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button
                            type="button"
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${formData.type === 'INCOME' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            onClick={() => setFormData({ ...formData, type: 'INCOME' })}
                        >
                            Ingreso (Income)
                        </button>
                        <button
                            type="button"
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${formData.type === 'EXPENSE' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            onClick={() => setFormData({ ...formData, type: 'EXPENSE' })}
                        >
                            Gasto (Expense)
                        </button>
                    </div>

                    {/* Amount & Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-gray-400">$</span>
                                <input
                                    type="number"
                                    required
                                    className="w-full pl-7 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                                    placeholder="0.00"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
                            <input
                                type="date"
                                required
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoría</label>
                        <select
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                            required
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                        >
                            <option value="">Seleccionar...</option>
                            {formData.type === 'INCOME' ? (
                                <>
                                    <option value="Subscription">Suscripción SaaS</option>
                                    <option value="Service">Servicios Pro</option>
                                    <option value="OneTime">Pago Único</option>
                                </>
                            ) : (
                                <>
                                    <option value="Hosting">Infraestructura / Hosting</option>
                                    <option value="Payroll">Nómina</option>
                                    <option value="Marketing">Marketing & Ads</option>
                                    <option value="Software">Licencias Software</option>
                                    <option value="Office">Oficina</option>
                                </>
                            )}
                        </select>
                    </div>

                    {/* Customer (Optional for Expense) */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cliente (Opcional)</label>
                        <select
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                            value={formData.customerId}
                            onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                        >
                            <option value="">-- General / Ninguno --</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descripción</label>
                        <input
                            type="text"
                            required
                            placeholder="Ej: Pago mensual Vercel"
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg text-sm
              ${loading ? 'bg-gray-400 cursor-not-allowed' : formData.type === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'}
            `}
                    >
                        {loading ? 'Guardando...' : formData.type === 'INCOME' ? 'Registrar Ingreso' : 'Registrar Gasto'}
                    </button>
                </form>
            </div>
        </div>
    );
}
