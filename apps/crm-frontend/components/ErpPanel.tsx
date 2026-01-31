import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { toast } from 'react-hot-toast';

export default function ErpPanel() {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState<'products' | 'orders'>('orders');
    const [products, setProducts] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Modal States
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [showOrderModal, setShowOrderModal] = useState(false); // For manual order creation

    // Form States
    const [formData, setFormData] = useState({
        name: '', description: '', price: '', sku: '', stock: '', category: '', imageUrl: ''
    });

    useEffect(() => {
        if (token) loadData();
    }, [activeTab, token]); // Reload when tab changes

    const loadData = async () => {
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
            console.error(error);
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
            if (res.ok) {
                const data = await res.json();
                setSelectedOrder(data);
            }
        } catch (error) {
            toast.error('Error details');
        }
    };

    // --- Product Actions ---
    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingProduct
                ? `${process.env.NEXT_PUBLIC_CRM_API_URL}/erp/products/${editingProduct.id}`
                : `${process.env.NEXT_PUBLIC_CRM_API_URL}/erp/products`;

            const method = editingProduct ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success(editingProduct ? 'Producto actualizado' : 'Producto creado');
                setShowProductModal(false);
                setEditingProduct(null);
                setFormData({ name: '', description: '', price: '', sku: '', stock: '', category: '', imageUrl: '' });
                loadData();
            } else {
                toast.error('Error al guardar producto');
            }
        } catch (error) {
            toast.error('Error de conexión');
        }
    };

    const handleDeleteProduct = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este producto?')) return;
        try {
            await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/erp/products/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Producto eliminado');
            loadData();
        } catch (error) {
            toast.error('Error eliminando producto');
        }
    };

    const handleEditProduct = (p: any) => {
        setEditingProduct(p);
        setFormData({
            name: p.name, description: p.description || '', price: p.price, sku: p.sku,
            stock: p.stock, category: p.category || '', imageUrl: p.imageUrl || ''
        });
        setShowProductModal(true);
    };

    // --- Order Actions ---
    const handleUpdateOrderStatus = async (id: string, newStatus: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/erp/orders/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                toast.success(`Estado actualizado a ${newStatus}`);
                setSelectedOrder({ ...selectedOrder, status: newStatus });
                loadData(); // Update list too
            }
        } catch (error) {
            toast.error('Error actualizando estado');
        }
    };

    // Simulate AssistAI Webhook for testing
    const simulateAssistAIOrder = async () => {
        if (!process.env.NEXT_PUBLIC_CRM_API_URL) return;

        try {
            const mockPayload = {
                cart: {
                    total: 1499.98,
                    items: [
                        { sku: 'LP-PRO-X', quantity: 1, price: 1299.99 },
                        { sku: 'WH-NC-1', quantity: 1, price: 199.99 }
                    ]
                },
                customer: {
                    name: 'Test Webhook User',
                    phone: '5559876543' // Will trigger generic customer creation
                },
                agentCode: 'TEST_AGENT'
            };

            await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/assistai/webhook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-assistai-event': 'ORDER_CREATED'
                },
                body: JSON.stringify(mockPayload)
            });

            toast.success('Simulación de Webhook enviada');
            loadData(); // Refresh orders
        } catch (e) {
            toast.error('Error simulando webhook');
        }
    };


    return (
        <div className="h-full flex flex-col p-6 space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Mini ERP (Gestión de Pedidos)
                    </h1>
                    <p className="text-gray-500 text-sm">Gestiona productos y pedidos de AssistAI</p>
                </div>
                <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`px-4 py-2 rounded-md transition-all ${activeTab === 'orders' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Pedidos
                    </button>
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`px-4 py-2 rounded-md transition-all ${activeTab === 'products' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Productos
                    </button>
                </div>
            </header>

            {/* Action Bar */}
            <div className="flex justify-end gap-3">
                {activeTab === 'products' && (
                    <button
                        onClick={() => { setEditingProduct(null); setFormData({ name: '', description: '', price: '', sku: '', stock: '', category: '', imageUrl: '' }); setShowProductModal(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
                    >
                        <span>+</span> Nuevo Producto
                    </button>
                )}
                {activeTab === 'orders' && (
                    <button
                        onClick={simulateAssistAIOrder}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
                        title="Simula que AssistAI envió un pedido vía Webhook"
                    >
                        <span>🤖</span> Simular Pedido AssistAI
                    </button>
                )}
            </div>

            {loading && <div className="text-center py-10 text-gray-400 animate-pulse">Cargando datos...</div>}

            {/* PRODUCT LIST */}
            {!loading && activeTab === 'products' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {products.map((p) => (
                        <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
                            <div className="h-32 bg-gray-100 flex items-center justify-center relative">
                                {p.imageUrl ? (
                                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                                ) : (
                                    <span className="text-4xl opacity-50">📦</span>
                                )}
                                <span className="absolute top-2 right-2 bg-white/90 px-2 py-1 text-xs font-bold rounded-full shadow-sm">
                                    Stock: {p.stock}
                                </span>
                            </div>
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{p.name}</h3>
                                        <p className="text-xs text-gray-500 font-mono">{p.sku}</p>
                                    </div>
                                    <span className="text-blue-600 font-bold">${p.price}</span>
                                </div>
                                <p className="text-sm text-gray-600 line-clamp-2 mb-4 h-10">{p.description}</p>

                                <div className="flex justify-end gap-2 pt-2 border-t border-gray-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleEditProduct(p)}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => handleDeleteProduct(p.id)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {products.length === 0 && (
                        <div className="col-span-3 text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                            <p className="text-gray-500">No hay productos registrados.</p>
                            <button onClick={() => setShowProductModal(true)} className="mt-2 text-blue-600 font-medium">Crear el primero</button>
                        </div>
                    )}
                </div>
            )}

            {/* ORDER LIST */}
            {!loading && activeTab === 'orders' && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order ID</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {orders.map((o) => (
                                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-mono text-xs text-gray-500 select-all">{o.id.slice(-8)}</td>
                                    <td className="p-4">
                                        <div className="font-medium text-gray-900">{o.customer?.name || 'Cliente desconocido'}</div>
                                        <div className="text-xs text-gray-400">{o.customer?.email}</div>
                                    </td>
                                    <td className="p-4 font-bold text-gray-900">${o.total.toFixed(2)}</td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${o.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                o.status === 'OPEN' ? 'bg-blue-100 text-blue-700' :
                                                    o.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {o.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                                    <td className="p-4">
                                        <button
                                            onClick={() => loadOrderDetails(o.id)}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium bg-blue-50 px-3 py-1 rounded hover:bg-blue-100 transition-colors"
                                        >
                                            Ver Detalles
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-gray-400">
                                        No hay pedidos recientes.
                                        <br />
                                        <span className="text-sm">Usa el botón "Simular" para probar la integración.</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* PRODUCT MODAL */}
            {showProductModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-fadeIn">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                        </div>
                        <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre</label>
                                    <input required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">SKU</label>
                                    <input required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Precio</label>
                                    <input required type="number" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stock</label>
                                    <input required type="number" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descripción</label>
                                <textarea className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" rows={3}
                                    value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL Imagen</label>
                                <input className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} placeholder="https://..." />
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowProductModal(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ORDER DETAILS MODAL */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fadeIn">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Pedido #{selectedOrder.id.slice(-8)}</h2>
                                <p className="text-sm text-gray-500">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Status Control */}
                            <div className="flex items-center justify-between bg-white p-4 border border-blue-100 rounded-xl shadow-sm">
                                <span className="text-sm font-semibold text-gray-700">Estado Actual:</span>
                                <div className="flex gap-2">
                                    {['OPEN', 'COMPLETED', 'CANCELLED'].map(s => (
                                        <button
                                            key={s}
                                            onClick={() => handleUpdateOrderStatus(selectedOrder.id, s)}
                                            className={`px-3 py-1 text-xs font-bold rounded-full transition-all border ${selectedOrder.status === s
                                                    ? (s === 'COMPLETED' ? 'bg-green-600 text-white border-green-600' : s === 'CANCELLED' ? 'bg-red-600 text-white border-red-600' : 'bg-blue-600 text-white border-blue-600')
                                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Customer & Total */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-2">Cliente</p>
                                    <p className="font-medium text-gray-900">{selectedOrder.customer.name}</p>
                                    <p className="text-sm text-gray-500">{selectedOrder.customer.email}</p>
                                    <p className="text-xs text-gray-400 mt-1">{selectedOrder.customer.phone || 'Sin teléfono'}</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center items-end text-right">
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Total del Pedido</p>
                                    <p className="text-3xl font-extrabold text-blue-600">${selectedOrder.total.toFixed(2)}</p>
                                    <p className="text-xs text-gray-400">{selectedOrder.items.length} items</p>
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <h3 className="font-bold text-gray-900 mb-3 ml-1">Items</h3>
                                <div className="space-y-2">
                                    {selectedOrder.items.map((item: any) => (
                                        <div key={item.id} className="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-lg hover:shadow-sm transition-shadow">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
                                                    {item.product?.imageUrl ? <img src={item.product.imageUrl} className="w-full h-full object-cover rounded-lg" /> : '📦'}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{item.product?.name || 'Producto Eliminado'}</p>
                                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                                        <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-mono">{item.product?.sku}</span>
                                                        <span>{item.quantity} x ${item.unitPrice}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="font-bold text-gray-700">${item.total.toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end">
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                            >
                                Cerrar Ventana
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
