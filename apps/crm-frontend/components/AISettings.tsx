import React, { useState } from 'react';
import { apiPost } from '../app/apiHelper';

export default function AISettings() {
    const [testResult, setTestResult] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [prompt, setPrompt] = useState('Encuentra al cliente eduardo@assistai.lat');
    const [selectedTool, setSelectedTool] = useState('get_customer_context');

    const tools = [
        { id: 'get_customer_context', label: 'Contexto de Cliente', placeholder: '{"identifier": "email@ejemplo.com"}' },
        { id: 'search_customers', label: 'Buscar Clientes', placeholder: '{"query": "Empresa Tech"}' },
        { id: 'list_products', label: 'Listar Productos/Precios', placeholder: '{}' },
        { id: 'create_lead', label: 'Crear Lead', placeholder: '{"name": "Juan Perez", "email": "juan@test.com"}' },
    ];

    const runTest = async () => {
        setLoading(true);
        setTestResult(null);
        try {
            // Parses JSON input for arguments
            let args = {};
            try {
                args = JSON.parse(prompt);
            } catch (e) {
                // If not JSON, treat as raw query for search/context (fallback)
                if (selectedTool === 'search_customers') args = { query: prompt };
                else if (selectedTool === 'get_customer_context') args = { identifier: prompt };
                else {
                    alert("Por favor ingresa un JSON válido para los argumentos");
                    setLoading(false);
                    return;
                }
            }

            // Call backend proxy (we need to implement this endpoint)
            const res = await apiPost('/ai/test-tool', {
                tool: selectedTool,
                args: args
            });
            setTestResult(JSON.stringify(res, null, 2));
        } catch (error: any) {
            setTestResult(`Error: ${error.message || 'Fallo desconocido'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Integración con IA (MCP)</h2>
                <p className="text-sm text-gray-500">Conecta agentes de IA (Claude, Cursor) para que controlen tu CRM.</p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    🤖 Estado de Conexión
                </h3>
                <div className="space-y-2 text-sm text-blue-800">
                    <p>Las herramientas MCP están <strong>activas</strong> en el servidor.</p>
                    <p>Para conectar un agente externo, usa la URL de tu CRM y tu API Key.</p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Configuration Card */}
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-4">Configuración Rápida</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase">URL del Servidor</label>
                            <div className="flex gap-2 mt-1">
                                <code className="flex-1 bg-gray-50 p-2 rounded text-sm border font-mono">
                                    {typeof window !== 'undefined' ? window.location.origin.replace('3000', '3002') : 'http://localhost:3002'}
                                </code>
                                <button
                                    onClick={() => navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.origin.replace('3000', '3002') : 'http://localhost:3002')}
                                    className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-medium"
                                >
                                    Copiar
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase">Usuario de Servicio AI</label>
                            <div className="mt-1 p-3 bg-gray-50 rounded border text-sm">
                                <p className="font-medium text-gray-900">Chronus AI Agent</p>
                                <p className="text-gray-500 text-xs">ai-agent@chronus.com</p>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Si necesitas la API Key, contacta al administrador o regenerala con el script.</p>
                        </div>
                    </div>
                </div>

                {/* Sandbox Card */}
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-4">🧪 Sandbox (Prueba de Herramientas)</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Herramienta</label>
                            <select
                                value={selectedTool}
                                onChange={(e) => {
                                    setSelectedTool(e.target.value);
                                    // Set placeholder
                                    const tool = tools.find(t => t.id === e.target.value);
                                    if (tool) setPrompt(tool.placeholder);
                                }}
                                className="w-full mt-1 border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
                            >
                                {tools.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Argumentos (JSON)</label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="w-full mt-1 border-gray-300 rounded-lg text-sm font-mono h-24 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>
                        <button
                            onClick={runTest}
                            disabled={loading}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm disabled:opacity-50"
                        >
                            {loading ? 'Ejecutando...' : 'Probar Herramienta'}
                        </button>
                    </div>
                </div>
            </div>

            {testResult && (
                <div className="bg-gray-900 rounded-xl p-4 overflow-hidden">
                    <h3 className="text-gray-400 text-xs font-mono mb-2 uppercase">Identificador de Salida</h3>
                    <pre className="text-emerald-400 font-mono text-xs overflow-x-auto">
                        {testResult}
                    </pre>
                </div>
            )}
        </div>
    );
}
