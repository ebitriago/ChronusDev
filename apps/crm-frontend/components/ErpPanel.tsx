'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { toast } from 'react-hot-toast';
import Finances from './Finances';
import Invoices from './Invoices'; // Assuming this exists or works similarly

export default function ErpPanel() {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'invoices' | 'finance'>('orders');

    // Data States
    const [products, setProducts] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);

    // UI States
    const [loading, setLoading] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [showProductModal, setShowProductModal] = useState(false);
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);

    // Form: Product
    const [productForm, setProductForm] = useState({
        name: '', description: '', price: '', sku: '', stock: '', category: '', imageUrl: ''
    });

    // Form: Order
    const [orderForm, setOrderForm] = useState({
        customerId: '',
        items: [] as { productId: string; quantity: number }[]
    });

    useEffect(() => {
        if (token) {
            loadData();
            if (customers.length === 0) loadCustomers();
        }
    }, [activeTab, token]);

    const loadCustomers = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/customers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setCustomers(await res.json());
        } catch (e) { console.error(e); }
    };

    const loadData = async () => {
        if (activeTab === 'finance' || activeTab === 'invoices') return; // Handled by sub-components

        setLoading(true);
        try {
            const endpoint = activeTab === 'products' ? '/erp/products' : '/erp/orders';
            const res = await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (activeTab === 'products') setProducts(data);
                else setOrders(data);
            }
        } catch (error) {
            toast.error('Error loading data');
        } finally {
            setLoading(false);
        }
    };

    const loadOrderDetails = async (id: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/erp/orders/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setSelectedOrder(await res.json());
        } catch (error) { toast.error('Error details'); }
    };

    // --- Actions ---

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingProduct
                ? `${process.env.NEXT_PUBLIC_CRM_API_URL}/erp/products/${editingProduct.id}`
                : `${process.env.NEXT_PUBLIC_CRM_API_URL}/erp/products`;
            const method = editingProduct ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(productForm)
            });

            if (res.ok) {
                toast.success(editingProduct ? 'Producto actualizado' : 'Producto creado');
                setShowProductModal(false);
                setEditingProduct(null);
                setProductForm({ name: '', description: '', price: '', sku: '', stock: '', category: '', imageUrl: '' });
                loadData();
            }
        } catch (e) { toast.error('Error connection'); }
    };

    const handleDeleteProduct = async (id: string) => {
        if (!confirm('Delete product?')) return;
        await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/erp/products/${id}`, {
            method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
        });
        loadData();
    };

    const handleCreateOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/erp/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(orderForm)
            });
            if (res.ok) {
                toast.success('Pedido Creado');
                setShowOrderModal(false);
                setOrderForm({ customerId: '', items: [] });
                loadData();
            } else {
                toast.error('Error creating order');
            }
        } catch (e) { toast.error('Error connection'); }
    };

    const handleConvertToInvoice = async (orderId: string) => {
        if (!confirm('¿Convertir este pedido en factura?')) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/erp/orders/${orderId}/convert`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success('Factura creada exitosamente');
                loadOrderDetails(orderId); // Refresh details
            } else {
                toast.error('Error al convertir');
            }
        } catch (e) { toast.error('Connection error'); }
    };

    const handleExportCSV = (type: 'products' | 'orders') => {
        const data = type === 'products' ? products : orders;
        if (!data.length) return toast('No hay datos para exportar');

        const headers = type === 'products'
            ? ['ID', 'Name', 'SKU', 'Price', 'Stock', 'Category']
            : ['ID', 'Customer', 'Total', 'Status', 'Date'];

        const rows = data.map(row => type === 'products'
            ? [row.id, row.name, row.sku, row.price, row.stock, row.category]
            : [row.id, row.customer?.name, row.total, row.status, new Date(row.createdAt).toLocaleDateString()]
        );

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `${type}_export.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Helper to manage Order Form Items
    const addOrderItem = (productId: string) => {
        if (!productId) return;
        const exists = orderForm.items.find(i => i.productId === productId);
        if (exists) {
            setOrderForm({
                ...orderForm,
                items: orderForm.items.map(i => i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i)
            });
        } else {
            setOrderForm({
                ...orderForm,
                items: [...orderForm.items, { productId, quantity: 1 }]
            });
        }
    };

    const removeOrderItem = (productId: string) => {
        setOrderForm({
            ...orderForm,
            items: orderForm.items.filter(i => i.productId !== productId)
        });
    };

    // Calculate total for new order form
    const calculateFormTotal = () => {
        return orderForm.items.reduce((acc, item) => {
            const p = products.find(p => p.id === item.productId);
            return acc + (p ? p.price * item.quantity : 0);
        }, 0);
    };

    return (
        <div className="h-full flex flex-col p-6 space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Mini ERP
                    </h1>
                    <p className="text-gray-500 text-sm">Gestión integral de Negocio</p>
                </div>
                <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
                    {[
                        { id: 'orders', label: 'Pedidos', icon: '📦' },
                        { id: 'products', label: 'Productos', icon: '🏷️' },
                        { id: 'invoices', label: 'Facturas', icon: '📄' },
                        { id: 'finance', label: 'Finanzas', icon: '💰' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <span>{tab.icon}</span> {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* ACTION BAR */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="text-sm text-gray-400">
                    {activeTab === 'orders' && `${orders.length} pedidos encontrados`}
                    {activeTab === 'products' && `${products.length} productos registrados`}
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    {activeTab === 'products' && (
                        <>
                            <button onClick={() => handleExportCSV('products')} className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm">⬇️ CSV</button>
                            <button onClick={() => { setEditingProduct(null); setShowProductModal(true); }} className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold">+ Producto</button>
                        </>
                    )}
                    {activeTab === 'orders' && (
                        <>
                            <button onClick={() => handleExportCSV('orders')} className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm">⬇️ CSV</button>
                            <button onClick={() => setShowOrderModal(true)} className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold">+ Nuevo Pedido</button>
                        </>
                    )}
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-auto">
                {activeTab === 'finance' && <Finances customers={customers} />}
                {activeTab === 'invoices' && <Invoices />}

                {activeTab === 'products' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {products.map((p) => (
                            <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
                                <div className="h-32 bg-gray-50 flex items-center justify-center relative">
                                    {p.imageUrl ? <img src={p.imageUrl} className="h-full w-full object-cover" /> : <span className="text-4xl">📦</span>}
                                    <span className="absolute top-2 right-2 bg-white/90 px-2 py-1 text-xs font-bold rounded-full shadow-sm">Stock: {p.stock}</span>
                                </div>
                                <div className="p-4">
                                    <div className="flex justify-between mb-2">
                                        <h3 className="font-bold text-gray-900 truncate">{p.name}</h3>
                                        <span className="text-blue-600 font-bold">${p.price}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-3">{p.sku}</p>
                                    <div className="flex justify-end gap-2 border-t pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditingProduct(p); setProductForm(p); setShowProductModal(true); }} className="text-blue-600 text-sm">Editar</button>
                                        <button onClick={() => handleDeleteProduct(p.id)} className="text-red-600 text-sm">Eliminar</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'orders' && (
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {orders.map(o => (
                                <div key={o.id} className="p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer" onClick={() => loadOrderDetails(o.id)}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-bold text-gray-900">{o.customer?.name || 'Unknown'}</p>
                                            <p className="text-xs text-gray-500 font-mono">#{o.id.slice(-6)}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${o.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{o.status}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-3">
                                        <span className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</span>
                                        <span className="font-bold text-gray-900">${o.total.toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Desktop Table */}
                        <table className="w-full text-left hidden md:table">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">ID</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Cliente</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Total</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Estado</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Fecha</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(o => (
                                    <tr key={o.id} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                                        <td className="p-4 text-xs font-mono text-gray-500">{o.id.slice(-6)}</td>
                                        <td className="p-4 font-medium">{o.customer?.name || 'Unknown'}</td>
                                        <td className="p-4 font-bold text-gray-900">${o.total.toFixed(2)}</td>
                                        <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${o.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{o.status}</span></td>
                                        <td className="p-4 text-sm text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                                        <td className="p-4"><button onClick={() => loadOrderDetails(o.id)} className="text-blue-600 hover:underline text-sm font-medium">Ver</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODALS */}

            {/* Create Product Modal */}
            {showProductModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl animate-fadeIn">
                        <h2 className="text-xl font-bold mb-4">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                        <form onSubmit={handleSaveProduct} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <input placeholder="Nombre" className="border p-2 rounded" required value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} />
                                <input placeholder="SKU" className="border p-2 rounded" required value={productForm.sku} onChange={e => setProductForm({ ...productForm, sku: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <input type="number" placeholder="Precio" className="border p-2 rounded" required value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })} />
                                <input type="number" placeholder="Stock" className="border p-2 rounded" required value={productForm.stock} onChange={e => setProductForm({ ...productForm, stock: e.target.value })} />
                            </div>
                            <textarea placeholder="Descripción" className="w-full border p-2 rounded" value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })} />
                            <input placeholder="Image URL" className="w-full border p-2 rounded" value={productForm.imageUrl} onChange={e => setProductForm({ ...productForm, imageUrl: e.target.value })} />
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowProductModal(false)} className="px-4 py-2 text-gray-500">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Order Modal */}
            {showOrderModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl animate-fadeIn max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">Crear Nuevo Pedido</h2>
                        <form onSubmit={handleCreateOrder} className="space-y-6">
                            {/* Customer Select */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Cliente</label>
                                <select
                                    className="w-full border p-2 rounded-lg"
                                    required
                                    value={orderForm.customerId}
                                    onChange={e => setOrderForm({ ...orderForm, customerId: e.target.value })}
                                >
                                    <option value="">Seleccionar Cliente...</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Add Items */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Agregar Productos</label>
                                <div className="flex gap-2 mb-4">
                                    <select className="flex-1 border p-2 rounded-lg text-sm" id="product-select">
                                        <option value="">Seleccionar producto...</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} - ${p.price}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const select = document.getElementById('product-select') as HTMLSelectElement;
                                            addOrderItem(select.value);
                                        }}
                                        className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm"
                                    >
                                        Agregar
                                    </button>
                                </div>

                                {/* Items List */}
                                <div className="space-y-2">
                                    {orderForm.items.map((item, idx) => {
                                        const p = products.find(p => p.id === item.productId);
                                        if (!p) return null;
                                        return (
                                            <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border shadow-sm">
                                                <div className="text-sm">
                                                    <span className="font-bold">{p.name}</span>
                                                    <span className="text-gray-500 ml-2">${p.price}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="number" min="1"
                                                        className="w-16 border rounded p-1 text-center"
                                                        value={item.quantity}
                                                        onChange={e => {
                                                            const newItems = [...orderForm.items];
                                                            newItems[idx].quantity = parseInt(e.target.value);
                                                            setOrderForm({ ...orderForm, items: newItems });
                                                        }}
                                                    />
                                                    <button type="button" onClick={() => removeOrderItem(item.productId)} className="text-red-500 hover:bg-red-50 p-1 rounded">🗑️</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {orderForm.items.length === 0 && <p className="text-gray-400 text-center text-sm">No items added</p>}
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t">
                                <div className="text-xl font-bold">Total: ${calculateFormTotal().toFixed(2)}</div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setShowOrderModal(false)} className="px-4 py-2 text-gray-500">Cancelar</button>
                                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">Crear Pedido</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Order Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl animate-fadeIn max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Pedido #{selectedOrder.id.slice(-6)}</h2>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${selectedOrder.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-600'}`}>
                                    {selectedOrder.status}
                                </span>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            <div className="bg-gray-50 p-4 rounded-xl">
                                <p className="text-xs uppercase font-bold text-gray-500">Cliente</p>
                                <p className="font-bold text-lg">{selectedOrder.customer.name}</p>
                                <p className="text-gray-500 text-sm">{selectedOrder.customer.email}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-xl text-right">
                                <p className="text-xs uppercase font-bold text-gray-500">Total</p>
                                <p className="font-bold text-2xl text-blue-600">${selectedOrder.total.toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="space-y-3 mb-8">
                            <h3 className="font-bold text-gray-700">Items</h3>
                            {selectedOrder.items.map((item: any) => (
                                <div key={item.id} className="flex justify-between border-b pb-2">
                                    <div>
                                        <p className="font-medium">{item.product?.name || 'Unknown'}</p>
                                        <p className="text-xs text-gray-500">{item.quantity} x ${item.unitPrice}</p>
                                    </div>
                                    <p className="font-bold">${item.total.toFixed(2)}</p>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button
                                onClick={() => handleConvertToInvoice(selectedOrder.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                            >
                                📄 Convertir a Factura
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
