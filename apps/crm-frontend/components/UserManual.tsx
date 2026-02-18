'use client';

import { useState, useEffect, useMemo } from 'react';

export default function UserManual() {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSection, setActiveSection] = useState('');

    useEffect(() => {
        fetch('/docs/USER_MANUAL.md')
            .then(res => res.text())
            .then(text => {
                setContent(text);
                setLoading(false);
            })
            .catch(() => {
                setContent('# Error\nNo se pudo cargar el manual.');
                setLoading(false);
            });
    }, []);

    // Parse markdown to sections
    const sections = useMemo(() => {
        if (!content) return [];
        const lines = content.split('\n');
        const secs: { id: string; title: string; level: number; content: string; startLine: number }[] = [];
        let currentTitle = '';
        let currentLevel = 0;
        let currentId = '';
        let currentStartLine = 0;
        let contentLines: string[] = [];

        const flush = () => {
            if (currentTitle) {
                secs.push({
                    id: currentId,
                    title: currentTitle,
                    level: currentLevel,
                    content: contentLines.join('\n'),
                    startLine: currentStartLine
                });
            }
        };

        lines.forEach((line, i) => {
            const h1 = line.match(/^# (.+)/);
            const h2 = line.match(/^## (.+)/);
            const h3 = line.match(/^### (.+)/);

            if (h1 || h2 || h3) {
                flush();
                const title = (h1 || h2 || h3)![1].replace(/[📋📊👥💬🎫📈💰🔗🛠️📑🌟🚀📔🗺️📖📦🔧📧📚⚙️✨🤖📱💻🔴🟠🟡🟢⚫📸✏️🗑️💸]/g, '').trim();
                currentId = title.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g, '-').replace(/^-|-$/g, '');
                currentTitle = title;
                currentLevel = h1 ? 1 : h2 ? 2 : 3;
                currentStartLine = i;
                contentLines = [];
            } else {
                contentLines.push(line);
            }
        });
        flush();
        return secs;
    }, [content]);

    // Filter sections by search
    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) return sections;
        const q = searchQuery.toLowerCase();
        return sections.filter(s =>
            s.title.toLowerCase().includes(q) ||
            s.content.toLowerCase().includes(q)
        );
    }, [sections, searchQuery]);

    // Table of contents (h2 level only)
    const toc = useMemo(() => sections.filter(s => s.level === 2), [sections]);

    // Simple markdown renderer
    const renderMarkdown = (text: string) => {
        const lines = text.split('\n');
        const elements: JSX.Element[] = [];
        let inCodeBlock = false;
        let codeContent: string[] = [];
        let codeLanguage = '';
        let inTable = false;
        let tableRows: string[][] = [];
        let lineIdx = 0;

        const processInline = (text: string): string => {
            return text
                .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900 dark:text-white">$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-mono">$1</code>')
                .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-purple-600 hover:text-purple-700 underline" target="_blank">$1</a>');
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            lineIdx++;

            // Code blocks
            if (line.startsWith('```')) {
                if (inCodeBlock) {
                    elements.push(
                        <pre key={`code-${lineIdx}`} className="bg-gray-900 text-gray-100 rounded-xl p-4 my-3 overflow-x-auto text-sm font-mono border border-gray-800">
                            <code>{codeContent.join('\n')}</code>
                        </pre>
                    );
                    codeContent = [];
                    inCodeBlock = false;
                } else {
                    inCodeBlock = true;
                    codeLanguage = line.slice(3);
                }
                continue;
            }

            if (inCodeBlock) {
                codeContent.push(line);
                continue;
            }

            // Tables
            if (line.includes('|') && line.trim().startsWith('|')) {
                const cells = line.split('|').slice(1, -1).map(c => c.trim());
                if (cells.every(c => /^[-:]+$/.test(c))) continue; // separator row
                if (!inTable) {
                    inTable = true;
                    tableRows = [];
                }
                tableRows.push(cells);

                // Check if next line is not a table row
                const nextLine = lines[i + 1];
                if (!nextLine || !nextLine.includes('|') || !nextLine.trim().startsWith('|')) {
                    elements.push(
                        <div key={`table-${lineIdx}`} className="overflow-x-auto my-4 rounded-xl border border-gray-200 dark:border-slate-700">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-slate-800">
                                        {tableRows[0]?.map((cell, ci) => (
                                            <th key={ci} className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-slate-700"
                                                dangerouslySetInnerHTML={{ __html: processInline(cell) }} />
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableRows.slice(1).map((row, ri) => (
                                        <tr key={ri} className="border-b last:border-0 border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                            {row.map((cell, ci) => (
                                                <td key={ci} className="px-4 py-2.5 text-gray-600 dark:text-gray-400"
                                                    dangerouslySetInnerHTML={{ __html: processInline(cell) }} />
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                    inTable = false;
                    tableRows = [];
                }
                continue;
            }

            // Empty lines
            if (line.trim() === '') {
                continue;
            }

            // Horizontal rules
            if (line.match(/^---+$/)) {
                elements.push(<hr key={`hr-${lineIdx}`} className="my-6 border-gray-200 dark:border-slate-700" />);
                continue;
            }

            // Blockquotes
            if (line.startsWith('>')) {
                const text = line.replace(/^>\s*/, '');
                elements.push(
                    <blockquote key={`bq-${lineIdx}`} className="border-l-4 border-purple-400 pl-4 py-2 my-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-r-lg text-gray-700 dark:text-gray-300 text-sm italic"
                        dangerouslySetInnerHTML={{ __html: processInline(text) }} />
                );
                continue;
            }

            // Unordered list items
            if (line.match(/^(\s*)[-*]\s+/)) {
                const indent = (line.match(/^(\s*)/)![1].length / 2);
                const text = line.replace(/^(\s*)[-*]\s+/, '');
                elements.push(
                    <div key={`li-${lineIdx}`} className="flex items-start gap-2 my-1 text-sm text-gray-700 dark:text-gray-300" style={{ paddingLeft: `${indent * 20}px` }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                        <span dangerouslySetInnerHTML={{ __html: processInline(text) }} />
                    </div>
                );
                continue;
            }

            // Ordered list items
            if (line.match(/^\s*\d+\.\s+/)) {
                const num = line.match(/^\s*(\d+)\.\s+/)![1];
                const text = line.replace(/^\s*\d+\.\s+/, '');
                elements.push(
                    <div key={`ol-${lineIdx}`} className="flex items-start gap-3 my-1.5 text-sm text-gray-700 dark:text-gray-300">
                        <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold shrink-0">{num}</span>
                        <span className="pt-0.5" dangerouslySetInnerHTML={{ __html: processInline(text) }} />
                    </div>
                );
                continue;
            }

            // Headings
            const h3Match = line.match(/^### (.+)/);
            if (h3Match) {
                const title = h3Match[1].replace(/[📋📊👥💬🎫📈💰🔗🛠️📑🌟🚀📔🗺️📖📦🔧📧📚⚙️✨🤖📱💻🔴🟠🟡🟢⚫📸✏️🗑️💸]/g, '').trim();
                elements.push(<h3 key={`h3-${lineIdx}`} className="text-lg font-bold text-gray-900 dark:text-white mt-6 mb-3">{title}</h3>);
                continue;
            }

            const h2Match = line.match(/^## (.+)/);
            if (h2Match) {
                const title = h2Match[1].replace(/[📋📊👥💬🎫📈💰🔗🛠️📑🌟🚀📔🗺️📖📦🔧📧📚⚙️✨🤖📱💻🔴🟠🟡🟢⚫📸✏️🗑️💸]/g, '').trim();
                const id = title.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g, '-').replace(/^-|-$/g, '');
                elements.push(<h2 key={`h2-${lineIdx}`} id={id} className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-slate-700 scroll-mt-20">{title}</h2>);
                continue;
            }

            const h1Match = line.match(/^# (.+)/);
            if (h1Match) {
                continue; // Skip h1, we show it as page title
            }

            // Paragraphs
            elements.push(
                <p key={`p-${lineIdx}`} className="text-sm text-gray-700 dark:text-gray-300 my-2 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: processInline(line) }} />
            );
        }

        return elements;
    };

    if (loading) {
        return (
            <div className="p-6 max-w-5xl mx-auto">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-2/3" />
                    <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/2" />
                    <div className="h-64 bg-gray-200 dark:bg-slate-700 rounded-2xl" />
                </div>
            </div>
        );
    }

    const mainTitle = sections.find(s => s.level === 1)?.title || 'Manual de Usuario';

    return (
        <div className="flex gap-0 lg:gap-8 p-3 md:p-6 max-w-7xl mx-auto min-h-screen">
            {/* Sidebar TOC (desktop only) */}
            <aside className="hidden lg:block w-64 shrink-0">
                <div className="sticky top-6">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Contenido</h3>
                        <nav className="space-y-1.5">
                            {toc.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => {
                                        setActiveSection(section.id);
                                        document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }}
                                    className={`block w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${activeSection === section.id
                                        ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    {section.title}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{mainTitle}</h1>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Guía completa para aprovechar al máximo tu plataforma</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href="/docs/USER_MANUAL.md"
                                download="Manual_ChronusCRM.md"
                                className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Descargar
                            </a>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar en el manual..."
                            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                    </div>

                    {searchQuery && (
                        <p className="text-xs text-gray-500 mt-2">{filteredSections.length} resultado(s) para &quot;{searchQuery}&quot;</p>
                    )}
                </div>

                {/* Content */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 md:p-8">
                    {filteredSections.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <p className="text-gray-500 dark:text-gray-400">No se encontraron resultados para &quot;{searchQuery}&quot;</p>
                        </div>
                    ) : (
                        <div className="prose-manual">
                            {filteredSections.map((section) => (
                                <div key={section.id}>
                                    {section.level === 1 ? null : (
                                        <>
                                            {section.level === 2 && (
                                                <h2 id={section.id} className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-slate-700 scroll-mt-20 first:mt-0">
                                                    {section.title}
                                                </h2>
                                            )}
                                            {section.level === 3 && (
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-6 mb-3">
                                                    {section.title}
                                                </h3>
                                            )}
                                        </>
                                    )}
                                    {renderMarkdown(section.content)}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
                    Última actualización: Febrero 2026 · ChronusCRM v1.0
                </div>
            </main>
        </div>
    );
}
