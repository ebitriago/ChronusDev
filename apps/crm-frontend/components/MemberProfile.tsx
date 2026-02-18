import { useState, useEffect } from 'react';
import { User, updateUser, getProjects, Project, assignProjectMember, removeProjectMember, getProjectMembers } from '../app/api';
import { useToast } from './Toast';

type Tab = 'GENERAL' | 'PAYMENT' | 'PROJECTS';

interface MemberProfileProps {
    user: User;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

export default function MemberProfile({ user, isOpen, onClose, onUpdate }: MemberProfileProps) {
    const [activeTab, setActiveTab] = useState<Tab>('GENERAL');
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    // General Form
    const [name, setName] = useState(user.name);
    const [role, setRole] = useState(user.role);
    const [phone, setPhone] = useState(user.phone || '');
    const [birthDate, setBirthDate] = useState(user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : '');
    const [payRate, setPayRate] = useState(user.defaultPayRate || 0);

    // Payment Form
    const [bankName, setBankName] = useState(user.paymentInfo?.bankName || '');
    const [accountNumber, setAccountNumber] = useState(user.paymentInfo?.accountNumber || '');
    const [swift, setSwift] = useState(user.paymentInfo?.swift || '');
    const [accountType, setAccountType] = useState(user.paymentInfo?.accountType || 'SAVINGS');

    // Projects
    const [allProjects, setAllProjects] = useState<Project[]>([]);
    const [userProjectIds, setUserProjectIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            loadProjects();
        }
    }, [isOpen, user.id]);

    async function loadProjects() {
        try {
            const projects = await getProjects();
            setAllProjects(projects);

            // In a real app we might want a dedicated endpoint for "User Projects",
            // but for now we can iterate or assume we need to fetch user membership.
            // Since getProjects usually returns basic info, we might need to check membership differently.
            // Detailed Check:
            const memberProjectIds = new Set<string>();
            await Promise.all(projects.map(async (p) => {
                try {
                    const members = await getProjectMembers(p.id);
                    if (members.find(m => m.userId === user.id)) {
                        memberProjectIds.add(p.id);
                    }
                } catch (e) {
                    console.error(`Error checking members for project ${p.id}`, e);
                }
            }));
            setUserProjectIds(memberProjectIds);

        } catch (err) {
            console.error(err);
        }
    }

    async function handleSaveGeneral(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            await updateUser(user.id, {
                name,
                role,
                phone,
                birthDate: birthDate ? new Date(birthDate).toISOString() : undefined,
                defaultPayRate: payRate
            });
            showToast('Perfil actualizado', 'success');
            onUpdate();
        } catch (err: any) {
            showToast(err.message || 'Error', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function handleSavePayment(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            await updateUser(user.id, {
                paymentInfo: {
                    bankName,
                    accountNumber,
                    swift,
                    accountType
                }
            });
            showToast('Datos de pago actualizados', 'success');
            onUpdate();
        } catch (err: any) {
            showToast(err.message || 'Error', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function toggleProject(projectId: string, isMember: boolean) {
        try {
            if (isMember) {
                // Remove
                await removeProjectMember(projectId, user.id);
                const next = new Set(userProjectIds);
                next.delete(projectId);
                setUserProjectIds(next);
                showToast('Removido del proyecto', 'success');
            } else {
                // Add
                await assignProjectMember(projectId, {
                    userId: user.id,
                    payRate: payRate, // Use default pay rate
                    billRate: payRate * 1.5, // Simple default logic
                    role: 'DEV'
                });
                const next = new Set(userProjectIds);
                next.add(projectId);
                setUserProjectIds(next);
                showToast('Asignado al proyecto', 'success');
            }
        } catch (err: any) {
            showToast(err.message || 'Error actualizando proyecto', 'error');
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={onClose} />

            {/* Slide-over panel */}
            <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl h-full overflow-y-auto animate-slideInRight">
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">{user.email}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 dark:border-slate-800 px-6">
                    {(['GENERAL', 'PAYMENT', 'PROJECTS'] as Tab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setActiveTab(t)}
                            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === t
                                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            {t === 'GENERAL' ? 'Datos Generales' : t === 'PAYMENT' ? 'Pago & Banco' : 'Proyectos'}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {activeTab === 'GENERAL' && (
                        <form onSubmit={handleSaveGeneral} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre Completo</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
                                    <select
                                        value={role}
                                        onChange={e => setRole(e.target.value as any)}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
                                    >
                                        <option value="DEV">Desarrollador</option>
                                        <option value="ADMIN">Administrador</option>
                                        <option value="MANAGER">Manager</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
                                        placeholder="+1 234 567 890"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha de Nacimiento</label>
                                    <input
                                        type="date"
                                        value={birthDate}
                                        onChange={e => setBirthDate(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tarifa por Hora ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={payRate}
                                        onChange={e => setPayRate(Number(e.target.value))}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200"
                            >
                                {loading ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </form>
                    )}

                    {activeTab === 'PAYMENT' && (
                        <form onSubmit={handleSavePayment} className="space-y-6">
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                                🔒 Esta información es visible solo para Administradores y el propio usuario.
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Banco</label>
                                    <input
                                        type="text"
                                        value={bankName}
                                        onChange={e => setBankName(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
                                        placeholder="Ej: Banco General"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Cuenta</label>
                                    <select
                                        value={accountType}
                                        onChange={e => setAccountType(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
                                    >
                                        <option value="SAVINGS">Ahorros</option>
                                        <option value="CHECKING">Corriente</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número de Cuenta</label>
                                    <input
                                        type="text"
                                        value={accountNumber}
                                        onChange={e => setAccountNumber(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SWIFT / IBAN (Internacional)</label>
                                    <input
                                        type="text"
                                        value={swift}
                                        onChange={e => setSwift(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                            >
                                {loading ? 'Guardando...' : 'Actualizar Datos Financieros'}
                            </button>
                        </form>
                    )}

                    {activeTab === 'PROJECTS' && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Acceso a Proyectos</h3>
                            <div className="grid grid-cols-1 gap-3">
                                {allProjects.map(project => {
                                    const isMember = userProjectIds.has(project.id);
                                    return (
                                        <div key={project.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">{project.name}</h4>
                                                <p className="text-xs text-gray-500">{project.description || 'Sin descripción'}</p>
                                            </div>
                                            <button
                                                onClick={() => toggleProject(project.id, isMember)}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isMember
                                                        ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                                        : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                                                    }`}
                                            >
                                                {isMember ? 'Remover' : 'Asignar'}
                                            </button>
                                        </div>
                                    );
                                })}
                                {allProjects.length === 0 && (
                                    <p className="text-center text-gray-500 py-8">No hay proyectos disponibles.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
