
'use client';

import { useState, useEffect } from 'react';
import {
    getWikiPages,
    createWikiPage,
    updateWikiPage,
    deleteWikiPage,
    type WikiPage
} from '../app/api';

type ProjectWikiProps = {
    projectId: string;
};

export default function ProjectWiki({ projectId }: ProjectWikiProps) {
    const [pages, setPages] = useState<WikiPage[]>([]);
    const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    useEffect(() => {
        loadPages();
    }, [projectId]);

    async function loadPages() {
        try {
            setLoading(true);
            const data = await getWikiPages(projectId);
            setPages(data);
            if (data.length > 0 && !selectedPage) {
                // Select first page by default if none selected
                setSelectedPage(data[0]);
            }
        } catch (error) {
            console.error('Error loading wiki pages:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleSelectPage(page: WikiPage) {
        setSelectedPage(page);
        setEditing(false);
    }

    function handleNewPage() {
        setSelectedPage(null);
        setTitle('');
        setContent('');
        setEditing(true);
    }

    function handleEditPage(page: WikiPage) {
        setTitle(page.title);
        setContent(page.content);
        setEditing(true);
    }

    async function handleSave() {
        try {
            if (selectedPage) {
                // Update
                const updated = await updateWikiPage(projectId, selectedPage.id, { title, content });
                setPages(pages.map(p => p.id === updated.id ? updated : p));
                setSelectedPage(updated);
            } else {
                // Create
                const created = await createWikiPage(projectId, { title, content });
                setPages([created, ...pages]);
                setSelectedPage(created);
            }
            setEditing(false);
        } catch (error) {
            alert('Error guardando página');
            console.error(error);
        }
    }

    async function handleDelete(pageId: string) {
        if (!confirm('¿Estás seguro de eliminar esta página?')) return;
        try {
            await deleteWikiPage(projectId, pageId);
            const newPages = pages.filter(p => p.id !== pageId);
            setPages(newPages);
            if (selectedPage?.id === pageId) {
                setSelectedPage(newPages.length > 0 ? newPages[0] : null);
                setEditing(false);
            }
        } catch (error) {
            console.error(error);
        }
    }

    if (loading) return <div className="p-8 text-center text-gray-400">Cargando documentación...</div>;

    return (
        <div className="flex h-[600px] border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            {/* Sidebar */}
            <div className="w-64 border-r border-gray-100 bg-gray-50 flex flex-col">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-gray-700">Páginas</h3>
                    <button
                        onClick={handleNewPage}
                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                        title="Nueva Página"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {pages.map(page => (
                        <div
                            key={page.id}
                            onClick={() => handleSelectPage(page)}
                            className={`px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all flex justify-between items-center group ${selectedPage?.id === page.id
                                    ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                        >
                            <span className="truncate">{page.title}</span>
                            {selectedPage?.id === page.id && !editing && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(page.id); }}
                                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    ))}
                    {pages.length === 0 && (
                        <div className="text-center py-8 text-xs text-gray-400">
                            No hay páginas creadas
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-white min-w-0">
                {editing ? (
                    <div className="flex flex-col h-full p-6 space-y-4">
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Título de la página"
                            className="text-2xl font-bold border-b border-gray-200 outline-none pb-2 placeholder-gray-300 w-full bg-transparent"
                            autoFocus
                        />
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="Escribe tu documentación en Markdown..."
                            className="flex-1 resize-none outline-none text-gray-700 leading-relaxed custom-scrollbar font-mono text-sm bg-gray-50 p-4 rounded-xl border border-transparent focus:bg-white focus:border-gray-200 focus:ring-2 focus:ring-blue-500/10 transition-all"
                        />
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setEditing(false)}
                                className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!title.trim()}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/30 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                ) : selectedPage ? (
                    <div className="flex flex-col h-full">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-white">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-1">{selectedPage.title}</h1>
                                <p className="text-xs text-gray-400">
                                    Actualizado el {new Date(selectedPage.updatedAt).toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={() => handleEditPage(selectedPage)}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 hover:border-blue-100"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Editar
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 prose prose-blue max-w-none custom-scrollbar markdown-content">
                            {/* Simple Markdown rendering - in real app use react-markdown */}
                            {selectedPage.content.split('\n').map((line, i) => (
                                <p key={i} className="mb-2 whitespace-pre-wrap">{line || <br />}</p>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/30">
                        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4 text-3xl">
                            📚
                        </div>
                        <p className="text-lg font-medium text-gray-500">Documentación del Proyecto</p>
                        <p className="text-sm">Selecciona una página o crea una nueva</p>
                        <button
                            onClick={handleNewPage}
                            className="mt-6 px-6 py-2.5 bg-white border border-gray-200 text-blue-600 rounded-xl hover:shadow-lg hover:border-blue-100 transition-all font-medium flex items-center gap-2"
                        >
                            <span>+</span> Crear primera página
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
