import { useState, useEffect } from 'react';
import { createStandup, getStandups, type Standup } from '../app/api';
import { useToast } from './Toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type StandupModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
};

export default function StandupModal({ isOpen, onClose, onSuccess }: StandupModalProps) {
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [standups, setStandups] = useState<Standup[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Form state
    const [yesterday, setYesterday] = useState('');
    const [today, setToday] = useState('');
    const [blockers, setBlockers] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const { showToast } = useToast();

    useEffect(() => {
        if (isOpen && activeTab === 'history') {
            loadStandups();
        }
    }, [isOpen, activeTab]);

    async function loadStandups() {
        try {
            setLoadingHistory(true);
            const data = await getStandups();
            setStandups(data);
        } catch (error) {
            console.error(error);
            showToast('Error cargando historial', 'error');
        } finally {
            setLoadingHistory(false);
        }
    }

    if (!isOpen) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            setSubmitting(true);
            await createStandup({ yesterday, today, blockers: blockers || undefined });
            showToast('Standup publicado exitosamente', 'success');
            onSuccess?.();
            // Switch to history to show it's done
            setActiveTab('history');
            loadStandups();
            // Reset form
            setYesterday('');
            setToday('');
            setBlockers('');
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Error publicando standup', 'error');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Daily Standup</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Sincronización diaria del equipo</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                    <button
                        onClick={() => setActiveTab('new')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'new'
                            ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        ✍️ Nuevo Reporte
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'history'
                            ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        📅 Historial de Equipo
                    </button>
                </div>

                <div className="overflow-y-auto p-4 md:p-6">
                    {activeTab === 'new' ? (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    ¿Qué hiciste ayer? <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    required
                                    value={yesterday}
                                    onChange={e => setYesterday(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[100px] resize-none"
                                    placeholder="- Completé la tarea X&#10;- Investigué sobre Y"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    ¿Qué harás hoy? <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    required
                                    value={today}
                                    onChange={e => setToday(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[100px] resize-none"
                                    placeholder="- Implementar Z&#10;- Revisar PRs"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    ¿Algún bloqueo?
                                </label>
                                <textarea
                                    value={blockers}
                                    onChange={e => setBlockers(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all min-h-[80px] resize-none"
                                    placeholder="Ninguno por ahora..."
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-wait"
                                >
                                    {submitting ? 'Publicando...' : 'Publicar Standup'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-6">
                            {loadingHistory ? (
                                <div className="space-y-4 animate-pulse">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-32 bg-gray-100 rounded-xl" />
                                    ))}
                                </div>
                            ) : standups.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    <div className="text-4xl mb-2">📭</div>
                                    <p>No hay reportes recientes</p>
                                </div>
                            ) : (
                                standups.map(standup => (
                                    <div key={standup.id} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3 mb-4 border-b border-gray-50 pb-3">
                                            {standup.user.avatar ? (
                                                <img src={standup.user.avatar} alt={standup.user.name} className="w-10 h-10 rounded-full" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                                    {standup.user.name.charAt(0)}
                                                </div>
                                            )}
                                            <div>
                                                <h4 className="font-bold text-gray-900">{standup.user.name}</h4>
                                                <p className="text-xs text-gray-500">
                                                    {format(new Date(standup.createdAt), "d 'de' MMMM, h:mm a", { locale: es })}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ayer</h5>
                                                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">{standup.yesterday}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hoy</h5>
                                                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-blue-50 p-3 rounded-lg">{standup.today}</p>
                                            </div>
                                            {standup.blockers && (
                                                <div className="md:col-span-2 space-y-1">
                                                    <h5 className="text-xs font-bold text-red-500 uppercase tracking-wider">Bloqueos</h5>
                                                    <p className="text-sm text-red-700 whitespace-pre-wrap bg-red-50 p-3 rounded-lg">{standup.blockers}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
