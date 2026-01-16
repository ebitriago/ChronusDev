"use client";

import { useToast } from "./Toast";

export default function Developers() {
    const { showToast } = useToast();
    const API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || "http://localhost:3002";
    const TEST_TOKEN = "token-admin-123";

    return (
        <div className="p-8 max-w-6xl mx-auto animate-fadeIn">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-500/30">
                    🛠️
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-gray-900">Developer Portal</h2>
                    <p className="text-gray-500">Recursos para integración con ChronusCRM</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Auth & Config */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Autenticación</h3>
                        <p className="text-gray-600 text-sm mb-4">
                            El CRM utiliza un sistema de tokens simple para desarrollo. Para producción, implementa un sistema OAuth2 o JWT robusto.
                        </p>
                        <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm text-slate-300 relative group">
                            <span className="text-emerald-400">Authorization:</span> Bearer {TEST_TOKEN}
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`Authorization: Bearer ${TEST_TOKEN}`);
                                    showToast("Token copiado", "success");
                                }}
                                className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 bg-white/10 text-white px-2 py-1 rounded text-xs transition-opacity"
                            >
                                Copiar
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Base URL</h3>
                        <div className="bg-gray-50 rounded-xl p-3 font-mono text-sm text-gray-700 border border-gray-200">
                            {API_URL}
                        </div>
                        <div className="mt-4 flex gap-2">
                            <a href={`${API_URL}/stats`} target="_blank" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                                ➜ Probar /stats
                            </a>
                            <a href={`${API_URL}/customers`} target="_blank" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium ml-4">
                                ➜ Probar /customers
                            </a>
                        </div>
                    </div>
                </div>

                {/* Webhooks & Tools */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
                        <h3 className="text-xl font-bold text-indigo-900 mb-2">Webhooks Dummy</h3>
                        <p className="text-indigo-700 text-sm mb-4">
                            Endpoint simulado para recibir notificaciones de eventos externos.
                        </p>
                        <div className="bg-white/80 backdrop-blur rounded-xl p-3 font-mono text-xs text-indigo-800 mb-4">
                            POST {API_URL}/webhooks/receive
                        </div>
                        <button
                            onClick={() => showToast("Webhook simulate click", "info")}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
                        >
                            Simular Evento
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Ejemplo rulo</h3>
                        <div className="bg-slate-950 rounded-xl p-4 overflow-x-auto text-xs font-mono text-slate-300">
                            {`curl -X POST ${API_URL}/customers \\
                            -H "Content-Type: application/json" \\
                            -d '{
                                "name": "Cliente API",
                                "email": "api@test.com"
                            }'`}
                        </div>
                    </div>
                </div>
            </div>

            {/* Live Chat Widget Section */}
            <div className="mt-8 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-8 border border-emerald-100 shadow-sm">
                <h3 className="text-2xl font-bold text-emerald-900 mb-2">💬 Live Chat Widget</h3>
                <p className="text-emerald-700 mb-6">
                    Agrega soporte en vivo a cualquier sitio web con una sola línea de código.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-bold text-gray-800 mb-2">Código Embebido</h4>
                        <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm text-slate-300 relative group">
                            <pre className="whitespace-pre-wrap text-xs">{`<!-- ChronusCRM Live Chat -->
<script src="${API_URL}/chat-widget.js" 
        data-org-id="YOUR_ORG_ID">
</script>`}</pre>
                            <button
                                onClick={() => {
                                    const code = `<script src="${API_URL}/chat-widget.js" data-org-id="YOUR_ORG_ID"></script>`;
                                    navigator.clipboard.writeText(code);
                                    showToast("Código copiado", "success");
                                }}
                                className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 bg-emerald-600 text-white px-3 py-1.5 rounded text-xs transition-opacity font-bold"
                            >
                                📋 Copiar
                            </button>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-800 mb-2">Canales Soportados</h4>
                        <div className="flex gap-2 flex-wrap">
                            <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">🤖 AssistAI</span>
                            <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">📱 WhatsApp</span>
                            <span className="px-3 py-1.5 bg-pink-100 text-pink-700 rounded-full text-xs font-bold">📸 Instagram</span>
                            <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">💬 Messenger</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* AssistAI Integration Section */}
            <div className="mt-8 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-8 border border-purple-100 shadow-sm">
                <h3 className="text-2xl font-bold text-purple-900 mb-2">🤖 AssistAI Integration</h3>
                <p className="text-purple-700 mb-6">
                    Conecta tu CRM con agentes de IA de AssistAI para WhatsApp e Instagram.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-bold text-gray-800 mb-2">Variables de Entorno</h4>
                        <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300">
                            <pre className="whitespace-pre-wrap">{`ASSISTAI_API_TOKEN=tu_token_aqui
ASSISTAI_TENANT_DOMAIN=tu_tenant
ASSISTAI_ORG_CODE=tu_org_code`}</pre>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-800 mb-2">Endpoints Disponibles</h4>
                        <div className="space-y-2 text-sm">
                            <div className="p-2 bg-white rounded border border-gray-200">
                                <code className="text-purple-600">GET /assistai/agents</code>
                                <span className="text-gray-500 ml-2">- Lista tus agentes IA</span>
                            </div>
                            <div className="p-2 bg-white rounded border border-gray-200">
                                <code className="text-purple-600">GET /assistai/conversations</code>
                                <span className="text-gray-500 ml-2">- Lista conversaciones</span>
                            </div>
                            <div className="p-2 bg-white rounded border border-gray-200">
                                <code className="text-purple-600">POST /assistai/sync</code>
                                <span className="text-gray-500 ml-2">- Sincroniza al Inbox</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-amber-800 text-sm">
                        <strong>⚠️ Nota:</strong> La API pública de AssistAI no permite enviar mensajes ni pausar la IA.
                        Contacta su equipo técnico para habilitar esos endpoints en tu cuenta.
                    </p>
                </div>
            </div>
        </div>
    );
}
