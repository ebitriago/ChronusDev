
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    getProject,
    assignProjectMember,
    type Project,
    type User
} from '../../api';
import ProjectWiki from '../../../components/ProjectWiki';

// Imports updated
import EditMemberRateModal from '../../../components/EditMemberRateModal';
import { useToast } from '../../../components/Toast';

export default function ProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { showToast } = useToast();

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'docs' | 'members'>('overview');

    // Modal State
    const [editingMember, setEditingMember] = useState<any>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    useEffect(() => {
        if (id) {
            loadProject(id);
        }
    }, [id]);

    async function loadProject(projectId: string) {
        try {
            const data = await getProject(projectId);
            setProject(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const handleSaveMember = async (userId: string, newRate: number, newRole: string) => {
        if (!project) return;
        try {
            // Find current member to preserve billRate
            const currentMember = project.members?.find((m: any) => m.userId === userId);

            await assignProjectMember(project.id, {
                userId: userId,
                payRate: newRate,
                billRate: currentMember?.billRate || 0,
                role: newRole as any
            });

            showToast('Miembro actualizado correctamente', 'success');
            await loadProject(project.id); // Reload
        } catch (e: any) {
            console.error(e);
            showToast(e.message || 'Error actualizando miembro', 'error');
            throw e; // Modal handles loading state
        }
    };

    if (loading) return (
        <div className="p-8 flex items-center justify-center min-h-screen">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    if (!project) return (
        <div className="p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Proyecto no encontrado</h1>
            <button onClick={() => router.push('/')} className="text-blue-600 hover:underline">
                &larr; Volver al Dashboard
            </button>
        </div>
    );

    // Calculate Summary Stats
    const totalHourlyCost = project.members?.reduce((sum: number, m: any) => sum + (m.payRate || 0), 0) || 0;
    const activeMembersCount = project.members?.length || 0;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4 mb-4">
                        <button
                            onClick={() => router.push('/')}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                        >
                            &larr;
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                            <p className="text-sm text-gray-500">
                                {project.client?.name} • {project.status} • {project.members?.length || 0} miembros
                            </p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-6 border-b border-gray-100 -mb-[17px]">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`pb-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'overview'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-900'
                                }`}
                        >
                            Resumen
                        </button>
                        <button
                            onClick={() => setActiveTab('docs')}
                            className={`pb-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'docs'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-900'
                                }`}
                        >
                            <span>📚</span> Documentación (Wiki)
                        </button>
                        <button
                            onClick={() => setActiveTab('members')}
                            className={`pb-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'members'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-900'
                                }`}
                        >
                            <span>👥</span> Equipo & Tarifas
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Descripción</h3>
                            <p className="text-gray-600 leading-relaxed">
                                {project.description || 'Sin descripción'}
                            </p>
                        </div>

                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-64 flex items-center justify-center text-gray-400">
                            Dashboard del proyecto en construcción...
                        </div>
                    </div>
                )}

                {activeTab === 'docs' && (
                    <div className="animate-fadeIn">
                        <ProjectWiki projectId={project.id} />
                    </div>
                )}

                {activeTab === 'members' && (
                    <div className="animate-fadeIn space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">👥</div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Miembros Activos</p>
                                    <p className="text-2xl font-bold text-gray-900">{activeMembersCount}</p>
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl">💰</div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Costo Total por Hora</p>
                                    <p className="text-2xl font-bold text-emerald-600">${totalHourlyCost.toLocaleString()}/hr</p>
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl">⚡</div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Estado</p>
                                    <p className="text-2xl font-bold text-purple-600">Activo</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Equipo del Proyecto</h3>
                                    <p className="text-sm text-gray-500">Gestiona las tarifas específicas para este proyecto</p>
                                </div>
                            </div>
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Miembro</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol en Proyecto</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarifa (USD/hr)</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {project.members?.map((member: any) => (
                                        <tr key={member.id} className="hover:bg-gray-50/80 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-sm border-2 border-white shadow-sm">
                                                        {member.user.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900">{member.user.name}</p>
                                                        <p className="text-xs text-gray-500">{member.user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${member.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                                                    member.role === 'MANAGER' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-blue-50 text-blue-700'
                                                    }`}>
                                                    {member.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className={`font-bold text-base ${member.payRate > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                                                        ${member.payRate}
                                                    </span>
                                                    <span className="text-xs text-gray-400">/hr</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => {
                                                        setEditingMember(member);
                                                        setShowEditModal(true);
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    title="Editar Tarifa y Rol"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!project.members || project.members.length === 0) && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className="text-4xl opacity-20">👥</span>
                                                    <p>No hay miembros asignados a este proyecto.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            <EditMemberRateModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSave={handleSaveMember}
                member={editingMember}
            />
        </div >
    );
}
