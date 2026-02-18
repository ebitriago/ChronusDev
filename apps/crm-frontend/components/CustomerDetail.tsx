'use client';

import { useState, useEffect } from 'react';
import { API_URL } from '../app/api';

import TagInput from './TagInput';

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

export default function CustomerDetail({ customerId, onBack, onOpenChat }: { customerId: string, onBack: () => void, onOpenChat?: (contact: string) => void }) {
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);
    const [conversations, setConversations] = useState<any[]>([]);
    const [tickets, setTickets] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'BILLING' | 'CONVERSATIONS' | 'TICKETS'>('OVERVIEW');
    const [loading, setLoading] = useState(true);

    // Edit Form State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({});

    // Billing State
    const [billingView, setBillingView] = useState<'INVOICES' | 'PROPOSALS'>('PROPOSALS');
    const [invoices, setInvoices] = useState<any[]>([]);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [newInvoice, setNewInvoice] = useState({
        amount: 0,
        description: 'Servicios Profesionales',
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +15 days
        terms: 'Válido por 15 días'
    });

    // Contact State
    const [showContactModal, setShowContactModal] = useState(false);
    const [newContact, setNewContact] = useState({
        type: 'PHONE',
        value: '',
        displayName: '',
        isPrimary: false
    });

    const handleAddContact = async () => {
        if (!newContact.value) return;
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/contacts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ...newContact, customerId })
            });
            if (res.ok) {
                const created = await res.json();
                setContacts([...contacts, created]);
                setShowContactModal(false);
                setNewContact({ type: 'PHONE', value: '', displayName: '', isPrimary: false });
            } else {
                alert('Error al crear contacto');
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        // Fetch fetch 360 view
        const fetchDetails = async () => {
            setLoading(true);
            const token = localStorage.getItem('crm_token');
            const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

            try {
                const res = await fetch(`${API_URL}/customers/${customerId}/360`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    setCustomer(data.client);
                    setEditForm(data.client); // Initialize form
                    setContacts(data.contacts || []);
                    setConversations(data.conversations || []);
                    setTickets(data.tickets || []);
                    setTransactions(data.invoices || []);

                    // Fetch Invoices specifically
                    const invRes = await fetch(`${API_URL}/invoices?customerId=${customerId}`, { headers });
                    if (invRes.ok) {
                        setInvoices(await invRes.json());
                    }

                    // Also fetch transactions if not fully covered by 360 or if different endpoint needed
                    const txnRes = await fetch(`${API_URL}/transactions?customerId=${customerId}`, { headers });
                    if (txnRes.ok) {
                        const txnData = await txnRes.json();
                        setTransactions(txnData);
                    }
                } else {
                    // Fallback to basic fetch if 360 fails (or for backward compat)
                    const custRes = await fetch(`${API_URL}/customers/${customerId}`, { headers });
                    if (custRes.ok) {
                        const data = await custRes.json();
                        setCustomer(data);
                        setEditForm(data);
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [customerId]);

    const handleCreateInvoice = async (type: 'INVOICE' | 'QUOTE') => {
        if (!newInvoice.amount) return;

        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/invoices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    customerId,
                    type,
                    amount: newInvoice.amount,
                    description: newInvoice.description,
                    dueDate: newInvoice.dueDate,
                    terms: newInvoice.terms,
                    items: [{
                        description: newInvoice.description,
                        unitPrice: newInvoice.amount,
                        quantity: 1
                    }]
                })
            });

            if (res.ok) {
                const created = await res.json();
                setInvoices([created, ...invoices]);
                setShowInvoiceModal(false);
                setNewInvoice({
                    amount: 0,
                    description: 'Servicios Profesionales',
                    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    terms: 'Válido por 15 días'
                });
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleConvertQuote = async (id: string) => {
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/invoices/${id}/convert`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                // Refresh list
                const invRes = await fetch(`${API_URL}/invoices?customerId=${customerId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (invRes.ok) setInvoices(await invRes.json());
                setBillingView('INVOICES');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDownloadPDF = (id: string, number: string) => {
        const token = localStorage.getItem('crm_token');
        // Open in new window with auth token? 
        // Usually safer to fetch blob or use a specialized endpoint that handles auth via query param or cookie
        // For MVP, we'll try fetch blob and download
        fetch(`${API_URL}/invoices/${id}/pdf`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${number}.pdf`;
                a.click();
            });
    };

    const handleSendEmail = async (id: string) => {
        if (!confirm('¿Seguro que deseas enviar este documento por correo al cliente?')) return;

        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/invoices/${id}/send`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (res.ok) {
                alert('Correo enviado exitosamente');
                // Refresh list to update status if needed
                const invRes = await fetch(`${API_URL}/invoices?customerId=${customerId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (invRes.ok) setInvoices(await invRes.json());
            } else {
                const err = await res.json();
                alert(`Error: ${err.error || 'No se pudo enviar el correo'}`);
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión');
        }
    };

    const handleSave = async () => {
        try {
            const token = localStorage.getItem('crm_token');
            // Sanitize form data to remove readonly fields/relations that break backend
            const { contacts: _c, conversations: _conv, tickets: _t, invoices: _i, activities: _a, projects: _p, stats: _s, ...sanitizedForm } = editForm;

            const res = await fetch(`${API_URL}/customers/${customerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(sanitizedForm)
            });

            if (res.ok) {
                const updated = await res.json();
                setCustomer(updated);
                setIsEditing(false);
                alert('Cliente actualizado correctamente');
            } else {
                alert('Error al guardar cambios');
            }
        } catch (error) {
            console.error(error);
            alert('Error de conexión');
        }
    };

    if (loading || !customer) return <div className="p-8 text-center text-gray-400">Cargando perfil 360°...</div>;

    return (
        <div className="space-y-6 animate-fadeIn" id={`client-${customerId}`}>
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3 md:gap-4">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                >
                    ← Volver
                </button>
                <div>

                    {isEditing ? (
                        <input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="text-xl md:text-2xl font-bold text-gray-900 border-b border-gray-300 focus:border-emerald-500 outline-none bg-transparent"
                        />
                    ) : (
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900">{customer.name}</h1>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-gray-500 mt-1">
                        <span>{customer.email}</span>
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${customer.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {customer.status}
                        </span>
                        {contacts.length > 0 && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">
                                {contacts.length} Contactos
                            </span>
                        )}
                    </div>
                    <div className="mt-2">
                        {isEditing ? (
                            <TagInput
                                selectedTags={editForm.tags || []}
                                onChange={(newTags) => setEditForm({ ...editForm, tags: newTags })}
                            />
                        ) : (
                            <div className="flex flex-wrap gap-1">
                                {customer.tags && customer.tags.length > 0 ? (
                                    customer.tags.map((tag: string, i: number) => (
                                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium border border-gray-200">
                                            #{tag}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-xs text-gray-400 italic">Sin etiquetas</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => {
                        import('jspdf').then(async jsPDFModule => {
                            const jsPDF = jsPDFModule.default;
                            import('jspdf-autotable').then(autoTableModule => {
                                const autoTable = autoTableModule.default;

                                const doc = new jsPDF();
                                const primaryColor: [number, number, number] = [16, 185, 129]; // Emerald 500

                                // Header
                                doc.setFontSize(22);
                                doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                                doc.text("Reporte Cliente 360°", 14, 20);

                                doc.setFontSize(10);
                                doc.setTextColor(100);
                                doc.text(`Generado: ${new Date().toLocaleDateString()}`, 14, 28);

                                // Client Info
                                doc.setFontSize(14);
                                doc.setTextColor(0);
                                doc.text("Información del Cliente", 14, 40);

                                const clientInfo = [
                                    ['Nombre', customer.name],
                                    ['Email', customer.email || '-'],
                                    ['Teléfono', customer.phone || '-'],
                                    ['Empresa', customer.company || '-'],
                                    ['Plan', customer.plan || '-'],
                                    ['Estado', customer.status],
                                    ['Etiquetas', (editForm.tags || []).join(', ') || '-']
                                ];

                                autoTable(doc, {
                                    startY: 45,
                                    head: [['Campo', 'Valor']],
                                    body: clientInfo,
                                    theme: 'striped',
                                    headStyles: { fillColor: primaryColor }
                                });

                                let finalY = (doc as any).lastAutoTable.finalY + 15;

                                // Stats
                                doc.text("Estadísticas", 14, finalY);
                                const statsData = [
                                    ['LTV (Total Pagado)', `$${(customer as any).stats?.ltv?.toLocaleString() || '0'}`],
                                    ['Tickets Abiertos', `${(customer as any).stats?.openTickets || '0'}`],
                                    ['Conversaciones', `${conversations.length}`]
                                ];

                                autoTable(doc, {
                                    startY: finalY + 5,
                                    body: statsData,
                                    theme: 'grid',
                                    styles: { fontSize: 10, cellPadding: 4 }
                                });

                                finalY = (doc as any).lastAutoTable.finalY + 15;

                                // Tickets
                                if (tickets.length > 0) {
                                    doc.text("Tickets Recientes", 14, finalY);
                                    const ticketRows = tickets.slice(0, 10).map((t: any) => [
                                        t.title,
                                        t.status,
                                        t.priority,
                                        new Date(t.createdAt).toLocaleDateString()
                                    ]);

                                    autoTable(doc, {
                                        startY: finalY + 5,
                                        head: [['Título', 'Estado', 'Prioridad', 'Fecha']],
                                        body: ticketRows,
                                        headStyles: { fillColor: [249, 115, 22] } // Orange
                                    });
                                    finalY = (doc as any).lastAutoTable.finalY + 15;
                                }

                                doc.save(`cliente_${customer.name.replace(/\s+/g, '_')}_360.pdf`);
                            });
                        });
                    }}
                    className="ml-auto px-3 py-2 text-sm md:text-base md:px-4 bg-white text-gray-700 border border-gray-300 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center gap-2"
                >
                    <span className="text-lg">📥</span> Descargar 360°
                </button>

                <button
                    onClick={async () => {
                        const phone = contacts.find((c: any) => c.type === 'phone' || c.type === 'whatsapp')?.value || customer.phone;
                        if (!phone) {
                            alert('El cliente no tiene teléfono o WhatsApp registrado.');
                            return;
                        }
                        if (onOpenChat) {
                            onOpenChat(phone);
                        } else {
                            alert('Funcionalidad de chat no disponible en esta vista.');
                        }
                    }}
                    className="px-3 py-2 text-sm md:text-base md:px-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all flex items-center gap-2"
                >
                    <span className="text-lg">💬</span> Iniciar Conversación
                </button>

                <button
                    onClick={async () => {
                        const phone = contacts.find((c: any) => c.type === 'phone')?.value || customer.phone;
                        if (!phone) {
                            alert('El cliente no tiene teléfono registrado.');
                            return;
                        }
                        if (!confirm(`¿Llamar a ${customer.name} (${phone}) usando el Agente de Voz?`)) return;

                        try {
                            const res = await fetch(`${API_URL}/voice/call`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                                },
                                body: JSON.stringify({ customerNumber: phone })
                            });
                            const data = await res.json();
                            if (res.ok) {
                                alert('Llamada iniciada con éxito. ID: ' + data.callSid);
                            } else {
                                alert('Error: ' + data.error);
                            }
                        } catch (err) {
                            console.error(err);
                            alert('Error al iniciar la llamada.');
                        }
                    }}
                    className="px-3 py-2 text-sm md:text-base md:px-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all flex items-center gap-2"
                >
                    <span className="text-lg">📞</span> Llamar con IA
                </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <div className="flex gap-4 md:gap-6 overflow-x-auto">
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-6 min-h-[400px]">
                {activeTab === 'OVERVIEW' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-gray-500 uppercase">Información de Contacto</h3>
                                <button
                                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${isEditing
                                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    {isEditing ? '💾 Guardar' : '✏️ Editar'}
                                </button>
                                <button
                                    onClick={() => setShowContactModal(true)}
                                    className="ml-2 px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                >
                                    + Añadir
                                </button>
                            </div>

                            <div className="space-y-4">
                                {contacts.length > 0 ? (
                                    contacts.map((contact: any, idx: number) => {
                                        const config = PLATFORM_CONFIG[contact.type.toLowerCase()] || PLATFORM_CONFIG.phone;
                                        return (
                                            <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${config.color}`}>
                                                    {config.icon}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-500 uppercase">{config.label}</p>
                                                    <p className="font-mono text-sm font-medium">{contact.value}</p>
                                                </div>
                                                {contact.verified && <span className="ml-auto text-blue-500 text-xs">✓ Verificado</span>}

                                                <button
                                                    onClick={async () => {
                                                        if (!confirm('¿Eliminar contacto?')) return;
                                                        try {
                                                            const token = localStorage.getItem('crm_token');
                                                            await fetch(`${API_URL}/contacts/${contact.id}`, {
                                                                method: 'DELETE',
                                                                headers: { 'Authorization': `Bearer ${token}` }
                                                            });
                                                            setContacts(contacts.filter(c => c.id !== contact.id));
                                                        } catch (e) { console.error(e); }
                                                    }}
                                                    className="ml-auto opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 px-2"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-sm text-gray-400 italic">Sin contactos vinculados</p>
                                )}
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                                <h4 className="text-xs font-bold text-gray-400">Datos Fiscales & Dirección</h4>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Rif / Cédula / ID</label>
                                        {isEditing ? (
                                            <input
                                                value={editForm.taxId || ''}
                                                onChange={e => setEditForm({ ...editForm, taxId: e.target.value })}
                                                className="w-full px-2 py-1 border rounded text-sm"
                                                placeholder="J-12345678-9"
                                            />
                                        ) : (
                                            <p className="font-medium text-sm">{customer.taxId || '-'}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Términos de Pago</label>
                                        {isEditing ? (
                                            <select
                                                value={editForm.paymentTerms || ''}
                                                onChange={e => setEditForm({ ...editForm, paymentTerms: e.target.value })}
                                                className="w-full px-2 py-1 border rounded text-sm bg-white"
                                            >
                                                <option value="">Seleccionar...</option>
                                                <option value="CASH">Contado</option>
                                                <option value="NET30">Crédito 30 días</option>
                                                <option value="NET60">Crédito 60 días</option>
                                            </select>
                                        ) : (
                                            <p className="font-medium text-sm">{customer.paymentTerms || '-'}</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-400 block mb-1">Dirección Física</label>
                                    {isEditing ? (
                                        <input
                                            value={editForm.address || ''}
                                            onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                                            className="w-full px-2 py-1 border rounded text-sm"
                                            placeholder="Av. Siempre Viva 123"
                                        />
                                    ) : (
                                        <p className="font-medium text-sm">{customer.address || '-'}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs text-gray-400 block mb-1">Dirección de Facturación</label>
                                    {isEditing ? (
                                        <input
                                            value={editForm.billingAddress || ''}
                                            onChange={e => setEditForm({ ...editForm, billingAddress: e.target.value })}
                                            className="w-full px-2 py-1 border rounded text-sm"
                                            placeholder="Igual a dirección física..."
                                        />
                                    ) : (
                                        <p className="font-medium text-sm">{customer.billingAddress || '-'}</p>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <h4 className="text-xs font-bold text-gray-400 mb-2">Datos Generales</h4>
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Empresa</label>
                                        {isEditing ? (
                                            <input
                                                value={editForm.company || ''}
                                                onChange={e => setEditForm({ ...editForm, company: e.target.value })}
                                                className="w-full px-2 py-1 border rounded text-sm"
                                            />
                                        ) : (
                                            <p className="font-medium">{customer.company || '-'}</p>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-400 block mb-1">Plan</label>
                                            {isEditing ? (
                                                <input
                                                    value={editForm.plan || ''}
                                                    onChange={e => setEditForm({ ...editForm, plan: e.target.value })}
                                                    className="w-full px-2 py-1 border rounded text-sm"
                                                />
                                            ) : (
                                                <p className="font-medium">{customer.plan}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 block mb-1">MRR ($)</label>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editForm.monthlyRevenue}
                                                    onChange={e => setEditForm({ ...editForm, monthlyRevenue: Number(e.target.value) })}
                                                    className="w-full px-2 py-1 border rounded text-sm"
                                                />
                                            ) : (
                                                <p className="font-medium">${customer.monthlyRevenue}/mes</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Métricas & Estadísticas</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                    <p className="text-xs font-bold text-emerald-600 uppercase">LTV (Total Pagado)</p>
                                    <p className="text-2xl font-black text-emerald-900">${(customer as any).stats?.ltv?.toLocaleString() || '0'}</p>
                                </div>
                                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                    <p className="text-xs font-bold text-orange-600 uppercase">Tickets Abiertos</p>
                                    <p className="text-2xl font-black text-orange-900">{(customer as any).stats?.openTickets || '0'}</p>
                                </div>
                            </div>

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
                                    {isEditing ? (
                                        <textarea
                                            value={editForm.notes || ''}
                                            onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                            className="w-full px-3 py-2 border border-yellow-300 rounded text-sm bg-white"
                                            rows={5}
                                        />
                                    ) : (
                                        <p className="text-sm text-yellow-900">{customer.notes || 'Sin notas registradas.'}</p>
                                    )}
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
                                                <button
                                                    onClick={() => onOpenChat && onOpenChat(conv.contact)}
                                                    className="text-xs text-blue-600 hover:underline cursor-pointer bg-transparent border-none p-0 outline-none"
                                                >
                                                    Ver conversación completa →
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}


                {activeTab === 'TICKETS' && (
                    <div className="space-y-4">
                        {tickets.length === 0 ? (
                            <div className="text-center py-10">
                                <p className="text-4xl mb-3">🎫</p>
                                <p className="text-gray-500">No hay tickets registrados.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100 text-left">
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Título</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Estado</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Prioridad</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Etiquetas</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Fecha</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {tickets.map((ticket: any) => (
                                            <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-gray-900">{ticket.title}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${ticket.status === 'OPEN' ? 'bg-blue-100 text-blue-700' :
                                                        ticket.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                                                            'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {ticket.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${ticket.priority === 'HIGH' || ticket.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                                                        ticket.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {ticket.priority}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {ticket.tags && ticket.tags.length > 0 ? (
                                                            ticket.tags.map((t: any) => (
                                                                <span key={t.tag.id} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] border border-gray-200">
                                                                    #{t.tag.name}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-xs text-gray-400">-</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                    {new Date(ticket.createdAt).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'BILLING' && (
                    <div>
                        <div className="flex flex-wrap gap-3 justify-between items-center mb-6">
                            <div className="flex bg-gray-100 p-1 rounded-xl">
                                <button
                                    onClick={() => setBillingView('PROPOSALS')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${billingView === 'PROPOSALS' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Propuestas
                                </button>
                                <button
                                    onClick={() => setBillingView('INVOICES')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${billingView === 'INVOICES' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Facturas
                                </button>
                            </div>
                            <button
                                onClick={() => setShowInvoiceModal(true)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20"
                            >
                                + Nueva {billingView === 'PROPOSALS' ? 'Propuesta' : 'Factura'}
                            </button>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">{billingView === 'PROPOSALS' ? 'Referencia' : 'Número'}</th>
                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Fecha</th>
                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase text-right">Monto</th>
                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Estado</th>
                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {invoices
                                        .filter(i => (billingView === 'PROPOSALS' ? i.type === 'QUOTE' : i.type !== 'QUOTE'))
                                        .map(inv => (
                                            <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 font-mono font-bold text-gray-900">{inv.number}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{new Date(inv.createdAt).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">${inv.amount.toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                                        {inv.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 flex gap-2">
                                                    <button
                                                        onClick={() => handleDownloadPDF(inv.id, inv.number)}
                                                        className="text-gray-400 hover:text-emerald-600"
                                                        title="Descargar PDF"
                                                    >
                                                        📄
                                                    </button>
                                                    <button
                                                        onClick={() => handleSendEmail(inv.id)}
                                                        className="text-gray-400 hover:text-blue-600"
                                                        title="Enviar por Email"
                                                    >
                                                        📧
                                                    </button>
                                                    {inv.type === 'QUOTE' && (
                                                        <button
                                                            onClick={() => handleConvertQuote(inv.id)}
                                                            className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-200 font-medium"
                                                        >
                                                            Convertir a Factura
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                            {invoices.filter(i => (billingView === 'PROPOSALS' ? i.type === 'QUOTE' : i.type !== 'QUOTE')).length === 0 && (
                                <div className="text-center py-10 text-gray-400">No hay {billingView === 'PROPOSALS' ? 'propuestas' : 'facturas'} registradas.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showInvoiceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Nueva {billingView === 'PROPOSALS' ? 'Propuesta' : 'Factura'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                                <input
                                    value={newInvoice.description}
                                    onChange={e => setNewInvoice({ ...newInvoice, description: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Monto ($)</label>
                                <input
                                    type="number"
                                    value={newInvoice.amount}
                                    onChange={e => setNewInvoice({ ...newInvoice, amount: Number(e.target.value) })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha {billingView === 'PROPOSALS' ? 'Válida' : 'Vencimiento'}</label>
                                    <input
                                        type="date"
                                        value={newInvoice.dueDate}
                                        onChange={e => setNewInvoice({ ...newInvoice, dueDate: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Términos</label>
                                    <input
                                        value={newInvoice.terms}
                                        onChange={e => setNewInvoice({ ...newInvoice, terms: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                        placeholder="Ej. Net 30"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setShowInvoiceModal(false)} className="flex-1 px-4 py-2 border rounded-xl hover:bg-gray-50">Cancelar</button>
                                <button
                                    onClick={() => handleCreateInvoice(billingView === 'PROPOSALS' ? 'QUOTE' : 'INVOICE')}
                                    disabled={!newInvoice.amount}
                                    className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    Crear
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Contact Modal */}
            {showContactModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl animate-popIn">
                        <h3 className="text-lg font-bold mb-4">Añadir Contacto</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Tipo</label>
                                <select
                                    value={newContact.type}
                                    onChange={e => setNewContact({ ...newContact, type: e.target.value })}
                                    className="w-full p-2 border rounded-xl"
                                >
                                    <option value="PHONE">Teléfono</option>
                                    <option value="EMAIL">Email</option>
                                    <option value="WHATSAPP">WhatsApp</option>
                                    <option value="INSTAGRAM">Instagram</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Valor</label>
                                <input
                                    value={newContact.value}
                                    onChange={e => setNewContact({ ...newContact, value: e.target.value })}
                                    placeholder="+58 412..."
                                    className="w-full p-2 border rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Nombre (Opcional)</label>
                                <input
                                    value={newContact.displayName || ''}
                                    onChange={e => setNewContact({ ...newContact, displayName: e.target.value })}
                                    placeholder="Ej: Personal"
                                    className="w-full p-2 border rounded-xl"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={() => setShowContactModal(false)}
                                    className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAddContact}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
