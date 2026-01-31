import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

export default function ErpPanel() {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState<'products' | 'orders'>('orders');
    const [products, setProducts] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, [activeTab]);

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
                        Productos Globales
                    </button>
                </div>
            </header>

            {loading && <div className="text-center py-10 text-gray-400">Cargando...</div>}

            {!loading && activeTab === 'products' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {products.map((p) => (
                        <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                            <div className="h-32 bg-gray-100 flex items-center justify-center relative">
                                {p.imageUrl ? (
                                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                                ) : (
                                    <span className="text-4xl">📦</span>
                                )}
                                <span className="absolute top-2 right-2 bg-white/90 px-2 py-1 text-xs font-bold rounded-full">
                                    Stock: {p.stock}
                                </span>
                            </div>
                            <div className="p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{p.name}</h3>
                                        <p className="text-xs text-gray-500">{p.sku}</p>
                                    </div>
                                    <span className="text-blue-600 font-bold">${p.price}</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{p.description}</p>
                            </div>
                        </div>
                    ))}
                    {products.length === 0 && <p className="text-gray-400 col-span-3 text-center">No hay productos registrados.</p>}
                </div>
            )}

            {!loading && activeTab === 'orders' && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Order ID</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Total</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {orders.map((o) => (
                                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-mono text-xs text-gray-500">{o.id.slice(-8)}</td>
                                    <td className="p-4 font-medium text-gray-900">
                                        {o.customer.name} <br />
                                        <span className="text-xs text-gray-400 font-normal">{o.customer.email}</span>
                                    </td>
                                    <td className="p-4 font-bold text-gray-900">${o.total.toFixed(2)}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${o.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                o.status === 'OPEN' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {o.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                                    <td className="p-4">
                                        <button
                                            onClick={() => loadOrderDetails(o.id)}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        >
                                            Ver Detalles
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400">No hay pedidos recientes.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Order Details Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Detalle de Pedido</h2>
                                <p className="text-sm text-gray-500">ID: {selectedOrder.id}</p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-100">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-semibold">Cliente</p>
                                    <p className="font-medium text-gray-900">{selectedOrder.customer.name}</p>
                                    <p className="text-sm text-gray-500">{selectedOrder.customer.email}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 uppercase font-semibold">Total</p>
                                    <p className="text-2xl font-bold text-blue-600">${selectedOrder.total.toFixed(2)}</p>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-bold text-gray-900 mb-4">Items del Pedido</h3>
                                <div className="space-y-3">
                                    {selectedOrder.items.map((item: any) => (
                                        <div key={item.id} className="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
                                            <div className="flex items-center space-x-3">
                                                {item.product.imageUrl && (
                                                    <img src={item.product.imageUrl} alt="" className="w-10 h-10 rounded object-cover" />
                                                )}
                                                <div>
                                                    <p className="font-medium text-gray-900">{item.product.name}</p>
                                                    <p className="text-xs text-gray-500">{item.quantity} x ${item.unitPrice}</p>
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
                                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
