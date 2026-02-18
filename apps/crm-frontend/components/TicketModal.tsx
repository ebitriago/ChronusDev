'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../app/api';
import { useToast } from './Toast';

type Customer = {
    id: string;
    name: string;
    email: string;
};

type User = {
    id: string;
    name: string;
    email: string;
    avatar?: string;
};

type Comment = {
    id: string;
    content: string;
    createdAt: string;
    authorId?: string;
    author?: User;
    isInternal: boolean;
};

type Attachment = {
    id: string;
    name: string;
    url: string;
    type: string;
};

type Ticket = {
    id?: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    customerId: string;
    customer?: Customer;
    assignedToId?: string;
    assignedTo?: User;
    dueDate?: string;
    comments?: Comment[];
    attachments?: Attachment[];
    taskId?: string;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    ticketToEdit?: Ticket | null;
    initialStatus?: string;
};

export default function TicketModal({ isOpen, onClose, onSuccess, ticketToEdit, initialStatus }: Props) {
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const commentFileInputRef = useRef<HTMLInputElement>(null);

    // Main Fields
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState('OPEN');
    const [priority, setPriority] = useState('MEDIUM');
    const [customerId, setCustomerId] = useState('');
    const [assignedToId, setAssignedToId] = useState('');
    const [dueDate, setDueDate] = useState('');

    // Auxiliary Data
    const [comments, setComments] = useState<Comment[]>([]);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [newComment, setNewComment] = useState('');

    // Search/Dropdowns
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [selectedCustomerName, setSelectedCustomerName] = useState('');
    const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

    // Image preview
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [sendingToDev, setSendingToDev] = useState(false);

    // Link logic
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkName, setLinkName] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchCustomers();
            fetchUsers();
            if (ticketToEdit) {
                // Edit Mode - Set initial known values
                setTitle(ticketToEdit.title);
                setDescription(ticketToEdit.description || '');
                setStatus(ticketToEdit.status);
                setPriority(ticketToEdit.priority);
                setCustomerId(ticketToEdit.customerId);
                setSelectedCustomerName(ticketToEdit.customer?.name || '');
                setAssignedToId(ticketToEdit.assignedToId || '');
                setDueDate(ticketToEdit.dueDate ? new Date(ticketToEdit.dueDate).toISOString().split('T')[0] : '');
                setComments(ticketToEdit.comments || []);
                setAttachments(ticketToEdit.attachments || []);

                // Fetch full details (comments, attachments, updated status)
                if (ticketToEdit.id) {
                    fetchTicketDetails(ticketToEdit.id);
                }
            } else {
                resetForm();
                setStatus(initialStatus || 'OPEN');
            }
        }
    }, [isOpen, ticketToEdit, initialStatus]);

    const fetchTicketDetails = async (id: string) => {
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/tickets/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Update with full details
                setDescription(data.description || '');
                setStatus(data.status);
                setPriority(data.priority);
                setAssignedToId(data.assignedToId || '');
                setDueDate(data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : '');
                setComments(data.comments || []);
                setAttachments(data.attachments || []);
                // Ensure customer name is set if missing in list view but present in detail
                if (data.customer && !selectedCustomerName) {
                    setSelectedCustomerName(data.customer.name);
                }
            }
        } catch (e) {
            console.error("Error fetching ticket details:", e);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setStatus('OPEN');
        setPriority('MEDIUM');
        setCustomerId('');
        setSelectedCustomerName('');
        setCustomerSearch('');
        setAssignedToId('');
        setDueDate('');
        setComments([]);
        setAttachments([]);
        setNewComment('');
        setPreviewImage(null);
        setShowLinkInput(false);
        setLinkUrl('');
        setLinkName('');
    };

    const fetchCustomers = async () => {
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/customers`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCustomers(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const searchClients = (query: string) => {
        setCustomerSearch(query);
        setShowCustomerDropdown(!!query.trim());
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(customerSearch.toLowerCase())
    );

    const selectedAssignee = users.find(u => u.id === assignedToId);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setLoading(true);

        try {
            const token = localStorage.getItem('crm_token');
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            const body = {
                title,
                description,
                status,
                priority,
                customerId,
                assignedToId: assignedToId || null, // Send null if empty
                dueDate: dueDate ? new Date(dueDate).toISOString() : null
            };

            let res;
            if (ticketToEdit?.id) {
                res = await fetch(`${API_URL}/tickets/${ticketToEdit.id}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body)
                });
            } else {
                res = await fetch(`${API_URL}/tickets`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body)
                });
            }

            if (res.ok) {
                showToast('Ticket guardado correctamente', 'success');
                onSuccess();
                onClose();
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(err.error || 'Error al guardar ticket', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSendComment = async () => {
        if (!ticketToEdit?.id || !newComment.trim()) return;
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/tickets/${ticketToEdit.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content: newComment })
            });

            if (res.ok) {
                const comment = await res.json();
                setComments(prev => [comment, ...prev]);
                setNewComment('');
                showToast('Comentario agregado', 'success');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !ticketToEdit?.id) return;

        setUploadingFile(true);
        const token = localStorage.getItem('crm_token');

        for (const file of Array.from(files)) {
            try {
                // 1. Upload to server to get public URL
                const formData = new FormData();
                formData.append('file', file);

                const uploadRes = await fetch(`${API_URL}/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }, // Usually multer doesn't need auth but we kept route open, can add middleware in backend index if needed
                    body: formData
                });

                if (!uploadRes.ok) throw new Error('Error subiendo archivo al servidor');
                const uploadData = await uploadRes.json();

                // 2. Create Attachment record
                const res = await fetch(`${API_URL}/tickets/${ticketToEdit.id}/attachments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: file.name,
                        url: uploadData.url,
                        type: file.type,
                        size: file.size
                    })
                });

                if (res.ok) {
                    const attachment = await res.json();
                    setAttachments(prev => [...prev, attachment]);
                    showToast('Archivo adjuntado', 'success');
                }
            } catch (error) {
                console.error(error);
                showToast('Error subiendo archivo', 'error');
            }
        }
        setUploadingFile(false);
        if (e.target) e.target.value = '';
    };

    const handleAddLink = async () => {
        if (!ticketToEdit?.id) return;
        if (!linkUrl.trim()) {
            showToast('La URL es requerida', 'error');
            return;
        }

        const finalUrl = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
        const name = linkName.trim() || finalUrl;

        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/tickets/${ticketToEdit.id}/attachments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: name,
                    url: finalUrl,
                    type: 'link/url',
                    size: 0
                })
            });

            if (res.ok) {
                const attachment = await res.json();
                setAttachments(prev => [...prev, attachment]);
                showToast('Enlace agregado', 'success');
                setShowLinkInput(false);
                setLinkUrl('');
                setLinkName('');
            }
        } catch (e) {
            showToast('Error al agregar enlace', 'error');
        }
    };

    const handleSendToDev = async () => {
        if (!ticketToEdit?.id) return;
        setSendingToDev(true);
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/tickets/${ticketToEdit.id}/send-to-chronusdev`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                showToast(`Enviado a desarrollo exitosamente${data.taskId ? ` (Task: ${data.taskId.slice(0, 8)}...)` : ''}`, 'success');
                onSuccess(); // Refresh ticket list
            } else {
                const errorData = await res.json().catch(() => ({ error: 'Error desconocido' }));
                const errorMsg = errorData.error || errorData.message || JSON.stringify(errorData);
                showToast(`Error: ${errorMsg.substring(0, 100)}${errorMsg.length > 100 ? '...' : ''}`, 'error');
                console.error('[SendToDev] Error response:', errorData);
            }
        } catch (e: any) {
            showToast(`Error de conexión: ${e.message || e}`, 'error');
            console.error('[SendToDev] Connection error:', e);
        } finally {
            setSendingToDev(false);
        }
    };

    const isImageType = (type: string) => type?.startsWith('image/');

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                        className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] shadow-2xl flex flex-col overflow-hidden"
                    >

                        {/* Header Actions */}
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🎫</span>
                                <div className="flex flex-col">
                                    <span className="text-xs text-gray-500 uppercase font-bold">Ticket</span>
                                    <span className="font-mono text-xs text-gray-400">#{ticketToEdit?.id?.slice(-6) || 'NEW'}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleSubmit()}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                                >
                                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                            {/* Main Content (Left) */}
                            <div className="flex-1 p-4 md:p-8 overflow-y-auto border-r border-gray-100">
                                {/* Title */}
                                <div className="mb-6">
                                    <input
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        className="w-full text-2xl font-bold text-gray-800 border-none focus:ring-0 p-0 placeholder-gray-300"
                                        placeholder="Título del Ticket"
                                    />
                                </div>

                                {/* Customer */}
                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Cliente</label>
                                    {selectedCustomerName ? (
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                                            <span>👤 {selectedCustomerName}</span>
                                            <button onClick={() => { setCustomerId(''); setSelectedCustomerName(''); }} className="hover:text-blue-900">✕</button>
                                        </div>
                                    ) : (
                                        <div className="relative max-w-sm">
                                            <input
                                                value={customerSearch}
                                                onChange={e => searchClients(e.target.value)}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                                                placeholder="Buscar cliente..."
                                            />
                                            {showCustomerDropdown && (
                                                <div className="absolute top-full left-0 w-full bg-white border border-gray-100 shadow-xl rounded-lg mt-1 z-10 max-h-40 overflow-y-auto">
                                                    {filteredCustomers.map(c => (
                                                        <div
                                                            key={c.id}
                                                            onClick={() => { setCustomerId(c.id); setSelectedCustomerName(c.name); setShowCustomerDropdown(false); }}
                                                            className="p-2 hover:bg-gray-50 cursor-pointer text-sm"
                                                        >
                                                            {c.name}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Description */}
                                <div className="mb-8">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Descripción</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        rows={6}
                                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all resize-none text-gray-700"
                                        placeholder="Añade una descripción detallada..."
                                    />
                                </div>

                                {/* Attachments Preview */}
                                {attachments.length > 0 && (
                                    <div className="mb-8">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">📎 Archivos Adjuntos</label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {attachments.map(att => (
                                                <div
                                                    key={att.id}
                                                    className="group relative rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:border-blue-300 transition-colors"
                                                    onClick={() => {
                                                        if (att.type === 'link/url') {
                                                            window.open(att.url, '_blank');
                                                        } else if (isImageType(att.type)) {
                                                            setPreviewImage(att.url);
                                                        } else {
                                                            const link = document.createElement('a');
                                                            link.href = att.url;
                                                            link.download = att.name;
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            document.body.removeChild(link);
                                                        }
                                                    }}
                                                >
                                                    {isImageType(att.type) ? (
                                                        <img
                                                            src={att.url}
                                                            alt={att.name}
                                                            className="w-full h-24 object-cover"
                                                        />
                                                    ) : att.type === 'link/url' ? (
                                                        <div className="w-full h-24 bg-blue-50 flex flex-col items-center justify-center p-2 text-center">
                                                            <span className="text-3xl mb-1">🔗</span>
                                                            <span className="text-[10px] text-blue-600 font-medium truncate w-full">{att.name}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-24 bg-gray-50 flex flex-col items-center justify-center p-2 text-center">
                                                            <span className="text-3xl mb-1">
                                                                {att.type.includes('pdf') ? '📕' : '📄'}
                                                            </span>
                                                            <span className="text-[10px] text-gray-500 font-medium truncate w-full">{att.name}</span>
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <span className="text-white text-xs font-medium truncate px-2">
                                                            {isImageType(att.type) ? 'Ver' : 'Abrir'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Comments */}
                                <div className="mb-4">
                                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                                        💬 Actividad & Comentarios
                                    </h3>

                                    <div className="flex gap-3 mb-6 relative">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold shrink-0">
                                            Yo
                                        </div>
                                        <div className="flex-1 relative">
                                            <textarea
                                                value={newComment}
                                                onChange={e => setNewComment(e.target.value)}
                                                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 resize-none pb-12"
                                                placeholder="Escribe un comentario... Usa @nombre para mencionar"
                                                rows={3}
                                            />
                                            {/* Toolbar inside textarea bottom */}
                                            <div className="absolute left-3 bottom-2 flex gap-2">
                                                <input
                                                    type="file"
                                                    multiple
                                                    className="hidden"
                                                    ref={commentFileInputRef}
                                                    onChange={handleFileUpload}
                                                />
                                                <button
                                                    onClick={() => commentFileInputRef.current?.click()}
                                                    disabled={uploadingFile}
                                                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                                                    title="Adjuntar archivo"
                                                >
                                                    📎
                                                </button>
                                                <button
                                                    onClick={() => setShowLinkInput(!showLinkInput)}
                                                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                                                    title="Agregar Enlace (Youtube, Drive, etc)"
                                                >
                                                    🔗
                                                </button>
                                            </div>
                                            <div className="absolute right-3 bottom-2">
                                                <button
                                                    onClick={handleSendComment}
                                                    disabled={!newComment.trim()}
                                                    className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black disabled:opacity-50"
                                                >
                                                    Comentar
                                                </button>
                                            </div>

                                            {/* Link Input Popover */}
                                            {showLinkInput && (
                                                <div className="absolute top-full left-0 mt-2 p-4 bg-white shadow-xl rounded-xl border border-gray-100 z-50 w-80 animate-fadeIn">
                                                    <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase">Agregar Enlace</h4>
                                                    <input
                                                        value={linkName}
                                                        onChange={(e) => setLinkName(e.target.value)}
                                                        placeholder="Título (opcional)"
                                                        className="w-full mb-2 p-2 border border-gray-200 rounded-lg text-xs"
                                                    />
                                                    <input
                                                        value={linkUrl}
                                                        onChange={(e) => setLinkUrl(e.target.value)}
                                                        placeholder="https://..."
                                                        className="w-full mb-3 p-2 border border-gray-200 rounded-lg text-xs"
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => setShowLinkInput(false)} className="px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 rounded-lg">Cancelar</button>
                                                        <button onClick={handleAddLink} className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Agregar</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                        {comments.map(comment => (
                                            <div key={comment.id} className="flex gap-3">
                                                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold text-xs shrink-0">
                                                    {comment.author?.name?.charAt(0) || 'U'}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-sm text-gray-900">{comment.author?.name || 'Usuario'}</span>
                                                        <span className="text-xs text-gray-400">{new Date(comment.createdAt).toLocaleString()}</span>
                                                    </div>
                                                    <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-r-xl rounded-bl-xl border border-gray-100">
                                                        {comment.content}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Sidebar Actions (Right) */}
                            <div className="w-full md:w-80 bg-gray-50 p-6 overflow-y-auto border-t md:border-t-0 md:border-l border-gray-100">

                                {/* Status & Priority */}
                                <div className="mb-6 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado</label>
                                        <select
                                            value={status}
                                            onChange={e => setStatus(e.target.value)}
                                            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm font-medium"
                                        >
                                            <option value="OPEN">Abierto</option>
                                            <option value="IN_PROGRESS">En Progreso</option>
                                            <option value="RESOLVED">Resuelto</option>
                                            <option value="CLOSED">Cerrado</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Prioridad</label>
                                        <select
                                            value={priority}
                                            onChange={e => setPriority(e.target.value)}
                                            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm font-medium"
                                        >
                                            <option value="LOW">Baja</option>
                                            <option value="MEDIUM">Media</option>
                                            <option value="HIGH">Alta</option>
                                            <option value="URGENT">Urgente</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Due Date */}
                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Fecha Vencimiento</label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={e => setDueDate(e.target.value)}
                                        className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm"
                                    />
                                </div>

                                {/* Assignee - NOW FUNCTIONAL */}
                                <div className="mb-6 relative">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Asignado a</label>
                                    <div
                                        onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                                        className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors"
                                    >
                                        {selectedAssignee ? (
                                            <>
                                                <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                                    {selectedAssignee.name.charAt(0)}
                                                </div>
                                                <span className="text-sm text-gray-700 flex-1">{selectedAssignee.name}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setAssignedToId(''); }}
                                                    className="text-gray-400 hover:text-red-500"
                                                >✕</button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                                                <span className="text-sm text-gray-500">Seleccionar...</span>
                                            </>
                                        )}
                                    </div>
                                    {showAssigneeDropdown && (
                                        <div className="absolute top-full left-0 w-full bg-white border border-gray-100 shadow-xl rounded-lg mt-1 z-20 max-h-48 overflow-y-auto">
                                            {users.map(user => (
                                                <div
                                                    key={user.id}
                                                    onClick={() => { setAssignedToId(user.id); setShowAssigneeDropdown(false); }}
                                                    className="p-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                                                >
                                                    <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                                        {user.name.charAt(0)}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-gray-800">{user.name}</div>
                                                        <div className="text-xs text-gray-400">{user.email}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="h-px bg-gray-200 my-6"></div>

                                {/* Actions */}
                                <div className="space-y-2">
                                    <button
                                        onClick={handleSendToDev}
                                        disabled={sendingToDev || !ticketToEdit?.id || !!ticketToEdit.taskId}
                                        className={`w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50
                                    ${ticketToEdit?.taskId
                                                ? 'bg-green-100 text-green-700 cursor-default'
                                                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                            }`}
                                    >
                                        {ticketToEdit?.taskId
                                            ? '✅ Enviado a Dev'
                                            : (sendingToDev ? 'Enviando...' : '🚀 Enviar a Dev')
                                        }
                                    </button>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={!ticketToEdit?.id || uploadingFile}
                                        className="w-full py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {uploadingFile ? 'Subiendo...' : '📎 Adjuntar Archivo'}
                                    </button>
                                    <button className="w-full py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-not-allowed opacity-60">
                                        ☑️ Agregar Checklist
                                    </button>
                                    <button className="w-full py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-bold transition-colors">
                                        🗑️ Eliminar Ticket
                                    </button>
                                </div>

                            </div>
                        </div>
                    </motion.div>

                    {/* Image Preview Modal */}
                    {previewImage && (
                        <div
                            className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-8"
                            onClick={() => setPreviewImage(null)}
                        >
                            <div className="relative max-w-4xl max-h-full">
                                <img src={previewImage} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" />
                                <button
                                    onClick={() => setPreviewImage(null)}
                                    className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white text-2xl"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
