'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type SearchResult = {
    type: 'project' | 'task';
    id: string;
    title: string;
    subtitle: string;
    status: string;
    icon: string;
};

interface GlobalSearchProps {
    onNavigate: (type: string, id: string) => void;
}

export default function GlobalSearch({ onNavigate }: GlobalSearchProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout>();

    // Keyboard shortcut (Cmd+K / Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
                setQuery('');
                setResults([]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Search with debounce
    const search = useCallback(async (q: string) => {
        if (q.length < 2) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('crm_token') || localStorage.getItem('authToken');
            // Use /api proxy path - works in both dev and production via next.config.js rewrites
            const API_URL = '/api';
            const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(q)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setResults(data.results || []);
            setSelectedIndex(0);
        } catch (err) {
            console.error('Search error:', err);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(query), 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query, search]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
        }
    };

    const handleSelect = (result: SearchResult) => {
        onNavigate(result.type, result.id);
        setIsOpen(false);
        setQuery('');
        setResults([]);
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'project': return 'Proyectos';
            case 'task': return 'Tareas';
            default: return type;
        }
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            'PLANNING': 'bg-purple-100 text-purple-700',
            'ACTIVE': 'bg-emerald-100 text-emerald-700',
            'ON_HOLD': 'bg-yellow-100 text-yellow-700',
            'COMPLETED': 'bg-green-100 text-green-700',
            'CANCELLED': 'bg-red-100 text-red-700',
            'BACKLOG': 'bg-slate-100 text-slate-600',
            'TODO': 'bg-blue-100 text-blue-700',
            'IN_PROGRESS': 'bg-yellow-100 text-yellow-700',
            'REVIEW': 'bg-purple-100 text-purple-700',
            'DONE': 'bg-green-100 text-green-700',
        };
        return colors[status] || 'bg-slate-100 text-slate-600';
    };

    if (!isOpen) return null;

    // Group results by type
    const groupedResults = results.reduce((acc, result) => {
        if (!acc[result.type]) acc[result.type] = [];
        acc[result.type].push(result);
        return acc;
    }, {} as Record<string, SearchResult[]>);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
            onClick={() => setIsOpen(false)}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fadeIn"
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 text-xl">🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Buscar proyectos, tareas..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent text-lg text-slate-800 dark:text-white placeholder:text-slate-400 outline-none"
                    />
                    <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs rounded-md font-mono">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div className="max-h-[50vh] overflow-y-auto">
                    {loading && (
                        <div className="flex items-center justify-center py-8 text-slate-400">
                            <span className="animate-spin mr-2">⏳</span> Buscando...
                        </div>
                    )}

                    {!loading && query.length >= 2 && results.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <span className="text-4xl mb-2">🔎</span>
                            <p>No se encontraron resultados para "{query}"</p>
                        </div>
                    )}

                    {!loading && Object.entries(groupedResults).map(([type, items]) => (
                        <div key={type} className="py-2">
                            <div className="px-5 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                {getTypeLabel(type)}
                            </div>
                            {items.map((result) => {
                                const globalIdx = results.indexOf(result);
                                return (
                                    <button
                                        key={result.id}
                                        onClick={() => handleSelect(result)}
                                        className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-colors ${globalIdx === selectedIndex
                                            ? 'bg-violet-50 dark:bg-violet-900/20'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                            }`}
                                    >
                                        <span className="text-2xl">{result.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-800 dark:text-white truncate">
                                                {result.title}
                                            </p>
                                            <p className="text-sm text-slate-500 truncate">
                                                {result.subtitle}
                                            </p>
                                        </div>
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(result.status)}`}>
                                            {result.status}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}

                    {!query && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <p className="text-sm">
                                Presiona <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono mx-1">⌘K</kbd>
                                para abrir el buscador rápido
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-400">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded shadow-sm">↑</kbd>
                            <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded shadow-sm">↓</kbd>
                            navegar
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded shadow-sm">↵</kbd>
                            seleccionar
                        </span>
                    </div>
                    <span>ChronusDev</span>
                </div>
            </div>
        </div>
    );
}
