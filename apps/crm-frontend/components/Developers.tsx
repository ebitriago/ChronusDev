"use client";

import { useState, useEffect } from "react";
import { useToast } from "./Toast";
import { API_URL } from "../app/api";

interface ApiKey {
    id: string;
    name: string;
    keyPrefix: string;
    lastUsedAt?: string;
    createdAt: string;
}

interface Webhook {
    id: string;
    url: string;
    description?: string;
    events: string[];
    isActive: boolean;
    secret: string;
    createdAt: string;
}

export default function Developers() {
    const { showToast } = useToast();

    // State
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [systemVersion, setSystemVersion] = useState("Loading...");
    const [loading, setLoading] = useState(true);

    // Modals
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [newKeyName, setNewKeyName] = useState("");
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);

    const [showWebhookModal, setShowWebhookModal] = useState(false);
    const [newWebhook, setNewWebhook] = useState({ url: '', description: '' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem("crm_token");
            const headers = { 'Authorization': `Bearer ${token}` };

            const [keysRes, hooksRes, verRes] = await Promise.all([
                fetch(`${API_URL}/api-keys`, { headers }),
                fetch(`${API_URL}/webhooks`, { headers }),
                fetch(`${API_URL}/meta/version`, { headers })
            ]);

            if (keysRes.ok) setApiKeys(await keysRes.json());
            if (hooksRes.ok) setWebhooks(await hooksRes.json());
            if (verRes.ok) {
                const verData = await verRes.json();
                setSystemVersion(verData.version);
            }

        } catch (e) {
            console.error(e);
            showToast("Error cargando datos", "error");
        } finally {
            setLoading(false);
            if (systemVersion === "Loading...") setSystemVersion("v0.1.0"); // Fallback
        }
    };

    const handleCreateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem("crm_token");
            const res = await fetch(`${API_URL}/api-keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newKeyName })
            });

            if (res.ok) {
                const data = await res.json();
                setGeneratedKey(data.key);
                setApiKeys([data, ...apiKeys]);
                setNewKeyName("");
                showToast("API Key generada", "success");
            }
        } catch (e) {
            showToast("Error creando key", "error");
        }
    };

    const handleRevokeKey = async (id: string) => {
        if (!confirm("¿Estás seguro de revocar esta API Key? Dejará de funcionar inmediatamente.")) return;
        try {
            const token = localStorage.getItem("crm_token");
            await fetch(`${API_URL}/api-keys/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setApiKeys(apiKeys.filter(k => k.id !== id));
            showToast("Key revocada", "success");
        } catch (e) {
            showToast("Error eliminando key", "error");
        }
    };

    const handleCreateWebhook = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem("crm_token");
            const res = await fetch(`${API_URL}/webhooks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ...newWebhook, events: ['*'] })
            });

            if (res.ok) {
                const data = await res.json();
                setWebhooks([data, ...webhooks]);
                setShowWebhookModal(false);
                setNewWebhook({ url: '', description: '' });
                showToast("Webhook registrado", "success");
            }
        } catch (e) {
            showToast("Error registrando webhook", "error");
        }
    };

    const handleDeleteWebhook = async (id: string) => {
        if (!confirm("¿Eliminar este webhook?")) return;
        try {
            const token = localStorage.getItem("crm_token");
            await fetch(`${API_URL}/webhooks/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setWebhooks(webhooks.filter(w => w.id !== id));
            showToast("Webhook eliminado", "success");
        } catch (e) {
            showToast("Error", "error");
        }
    };

    const handleTestWebhook = async (id: string) => {
        try {
            const token = localStorage.getItem("crm_token");
            const res = await fetch(`${API_URL}/webhooks/${id}/test`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) showToast("Evento de prueba enviado", "success");
            else showToast("Error enviando prueba", "error");
        } catch (e) {
            showToast("Error conexión", "error");
        }
    };

    const exampleKey = generatedKey || "sk_live_...";
    const exampleCurlLead = `curl -X POST ${API_URL}/customers \\
    -H "x-api-key: ${exampleKey}" \\
    -H "Content-Type: application/json" \\
    -d '{
      "name": "Nuevo Lead",
      "email": "lead@empresa.com",
      "status": "TRIAL"
    }'`;

    const exampleCurlTicket = `curl -X POST ${API_URL}/tickets \\
    -H "x-api-key: ${exampleKey}" \\
    -H "Content-Type: application/json" \\
    -d '{
      "title": "Ayuda con integración",
      "description": "No puedo conectar el webhook...",
      "customerId": "ID_DEL_CLIENTE",
      "priority": "HIGH"
    }'`;

    return (
        <div className="p-8 max-w-6xl mx-auto animate-fadeIn pb-24">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-500/30">
                        🛠️
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">Developer Portal</h2>
                        <div className="flex items-center gap-3">
                            <p className="text-gray-500">Integraciones & API</p>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">v{systemVersion}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* API Documentation Card */}
            <div className="mb-8 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-8 text-white shadow-xl shadow-indigo-500/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
                <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
                    <div>
                        <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">📚 API Documentation</h3>
                        <p className="text-white/80 max-w-lg">
                            Explora nuestra API completa con documentación interactiva (Scalar).
                            Aprende a crear Leads, Tickets y gestionar usuarios programáticamente.
                        </p>
                    </div>
                    <a href={`${API_URL}/api/docs`} target="_blank" className="px-6 py-3 bg-white text-indigo-700 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-lg flex items-center gap-2">
                        <span>🚀</span> Ver Documentación
                    </a>
                </div>
            </div>

            {/* ============ WIDGET EMBED SECTION ============ */}
            <div className="mb-8 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-200 shadow-sm">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">💬 Widget de Chat Web</h3>
                        <p className="text-sm text-gray-500">Integra el chat en vivo en tu sitio web, WordPress o aplicación</p>
                    </div>
                    <button
                        onClick={async () => {
                            const userStr = localStorage.getItem('crm_user');
                            let orgId = 'TU_ORG_ID';
                            if (userStr) {
                                try {
                                    const user = JSON.parse(userStr);
                                    orgId = user.organizationId || user.organization?.id || 'TU_ORG_ID';
                                } catch { }
                            }
                            const chatUrl = `${window.location.origin.replace('3003', '3002')}/chat.html?org=${orgId}`;
                            await navigator.clipboard.writeText(chatUrl);
                            showToast('✅ Enlace copiado', 'success');
                        }}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition flex items-center gap-2"
                    >
                        🔗 Copiar Enlace de Chat
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* HTML Embed Code */}
                    <div className="bg-white rounded-xl p-5 border border-gray-200">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-gray-700 flex items-center gap-2">
                                <span className="text-orange-500">{'</>'}</span> HTML / JavaScript
                            </h4>
                            <button
                                onClick={() => {
                                    const userStr = localStorage.getItem('crm_user');
                                    let orgId = 'TU_ORG_ID';
                                    if (userStr) {
                                        try {
                                            const user = JSON.parse(userStr);
                                            orgId = user.organizationId || user.organization?.id || 'TU_ORG_ID';
                                        } catch { }
                                    }
                                    const crmUrl = window.location.origin.replace('3003', '3002');
                                    const code = `<!-- ChronusCRM Live Chat Widget -->
<script src="${crmUrl}/chat-widget.js" data-org-id="${orgId}"></script>`;
                                    navigator.clipboard.writeText(code);
                                    showToast('Código HTML copiado', 'success');
                                }}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded"
                            >
                                Copiar
                            </button>
                        </div>
                        <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">{`<!-- ChronusCRM Live Chat Widget -->
<script 
  src="${API_URL.replace('/api', '')}/chat-widget.js" 
  data-org-id="TU_ORG_ID">
</script>`}</pre>
                        </div>
                        <p className="mt-3 text-xs text-gray-500">
                            Pega este código antes del cierre del <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> en tu HTML.
                        </p>
                    </div>

                    {/* WordPress Instructions */}
                    <div className="bg-white rounded-xl p-5 border border-gray-200">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-gray-700 flex items-center gap-2">
                                <span className="text-blue-500">📘</span> WordPress
                            </h4>
                        </div>
                        <div className="space-y-3 text-sm text-gray-600">
                            <div className="flex items-start gap-2">
                                <span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                                <p>Ve a <strong>Apariencia → Editor de Temas</strong> o usa un plugin como <em>Insert Headers and Footers</em></p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                                <p>Pega el código del widget en el <strong>Footer</strong> (antes de <code>&lt;/body&gt;</code>)</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                                <p>Guarda los cambios y el chat aparecerá en todas tus páginas</p>
                            </div>
                        </div>
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs text-amber-700">
                                💡 <strong>Tip:</strong> Usa plugins como "WPCode" o "Code Snippets" para agregar scripts de forma segura.
                            </p>
                        </div>
                    </div>

                    {/* React/Next.js */}
                    <div className="bg-white rounded-xl p-5 border border-gray-200">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-gray-700 flex items-center gap-2">
                                <span className="text-cyan-500">⚛️</span> React / Next.js
                            </h4>
                            <button
                                onClick={() => {
                                    const code = `// En tu layout.tsx o _app.tsx
import Script from 'next/script';

export default function Layout({ children }) {
  return (
    <>
      {children}
      <Script 
        src="TU_CRM_URL/chat-widget.js" 
        data-org-id="TU_ORG_ID"
        strategy="lazyOnload"
      />
    </>
  );
}`;
                                    navigator.clipboard.writeText(code);
                                    showToast('Código React copiado', 'success');
                                }}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded"
                            >
                                Copiar
                            </button>
                        </div>
                        <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                            <pre className="text-xs text-purple-400 font-mono whitespace-pre-wrap">{`// layout.tsx o _app.tsx
import Script from 'next/script';

<Script 
  src="TU_CRM_URL/chat-widget.js" 
  data-org-id="TU_ORG_ID"
  strategy="lazyOnload"
/>`}</pre>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="bg-white rounded-xl p-5 border border-gray-200">
                        <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <span className="text-emerald-500">✨</span> Características
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                                <span className="text-emerald-500">✓</span> Tiempo real
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <span className="text-emerald-500">✓</span> Multi-tenant
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <span className="text-emerald-500">✓</span> Historial persistente
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <span className="text-emerald-500">✓</span> Diseño responsive
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <span className="text-emerald-500">✓</span> Sesión por dispositivo
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <span className="text-emerald-500">✓</span> Sin dependencias
                            </div>
                        </div>
                        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <p className="text-xs text-purple-700">
                                🔐 Cada visitante tiene un ID de sesión único almacenado en su navegador. Los chats aparecen en tu Inbox como <span className="font-bold">🌐 Web Chat</span>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            {/* ============ END WIDGET EMBED SECTION ============ */}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* API Keys Section */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-full">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">🔐 API Keys</h3>
                                <p className="text-xs text-gray-500">Para tus sistemas (Backend, Scripts)</p>
                            </div>
                            <button
                                onClick={() => setShowKeyModal(true)}
                                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100 transition"
                            >
                                + Nueva Key
                            </button>
                        </div>

                        {apiKeys.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-gray-400 text-sm">No tienes API Keys activas.</p>
                                <button onClick={() => setShowKeyModal(true)} className="mt-2 text-indigo-600 text-sm font-medium hover:underline">Crear primera key</button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {apiKeys.map(key => (
                                    <div key={key.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-200">
                                        <div>
                                            <div className="font-medium text-gray-800">{key.name}</div>
                                            <div className="text-xs font-mono text-gray-500">{key.keyPrefix}...</div>
                                        </div>
                                        <button
                                            onClick={() => handleRevokeKey(key.id)}
                                            className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50"
                                        >
                                            Revocar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Webhooks Section */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-full">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">📡 Webhooks (Salida)</h3>
                                <p className="text-xs text-gray-500">Notificarte sobre eventos (Leads, Tickets)</p>
                            </div>
                            <button
                                onClick={() => setShowWebhookModal(true)}
                                className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-100 transition"
                            >
                                + Registrar
                            </button>
                        </div>

                        {webhooks.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-gray-400 text-sm">No hay webhooks configurados.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {webhooks.map(hook => (
                                    <div key={hook.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-medium text-gray-800 text-sm break-all">{hook.url}</div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleTestWebhook(hook.id)}
                                                    className="text-indigo-500 hover:text-indigo-700 text-xs px-2 py-1"
                                                    title="Probar (Enviar evento test)"
                                                >
                                                    ⚡
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteWebhook(hook.id)}
                                                    className="text-red-500 hover:text-red-700 text-xs px-2 py-1"
                                                    title="Eliminar"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 text-xs">
                                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-mono">Secret: {hook.secret.substring(0, 8)}...</span>
                                            <span className="text-gray-400">{hook.description}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Inbound Integrations Section */}
            <div className="mt-8 mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4">📥 Integraciones de Entrada (Inbound API)</h3>

                {/* Global Headers Info */}
                <div className="bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-800 mb-6 flex flex-col md:flex-row gap-6 items-start">
                    <div className="flex-1">
                        <h4 className="text-slate-200 font-bold mb-2">Headers Requeridos</h4>
                        <p className="text-slate-400 text-sm mb-4">
                            Incluye estos headers en todas tus peticiones a la API. El <code>x-api-key</code> es tu credencial secreta.
                        </p>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <code className="bg-black/50 text-pink-400 px-2 py-1 rounded text-sm font-mono">x-api-key: {exampleKey}</code>
                                <span className="text-slate-500 text-xs">(Tu API Key)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="bg-black/50 text-blue-400 px-2 py-1 rounded text-sm font-mono">Content-Type: application/json</code>
                            </div>
                        </div>
                    </div>
                    <div className="bg-indigo-900/30 border border-indigo-500/30 p-4 rounded-xl max-w-sm">
                        <p className="text-indigo-200 text-xs">
                            💡 <strong>Tip:</strong> Si generaste una Key recién, úsala en los ejemplos. Si no, usa una de tus keys existentes.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Create Lead Example */}
                    <div className="bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-800">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-slate-200 font-bold">Crear Lead desde Web</h4>
                            <button
                                onClick={() => { navigator.clipboard.writeText(exampleCurlLead); showToast("Código copiado", "success"); }}
                                className="text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded"
                            >
                                Copiar
                            </button>
                        </div>
                        <div className="font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap p-2 bg-black/20 rounded-lg">
                            {exampleCurlLead}
                        </div>
                        <p className="mt-4 text-xs text-slate-400">
                            Usa este endpoint para enviar leads automáticamente desde tu Landing Page, formularios de Typeform, o scripts personalizados.
                        </p>
                    </div>

                    {/* Create Ticket Example */}
                    <div className="bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-800">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-slate-200 font-bold">Crear Ticket de Soporte</h4>
                            <button
                                onClick={() => { navigator.clipboard.writeText(exampleCurlTicket); showToast("Código copiado", "success"); }}
                                className="text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded"
                            >
                                Copiar
                            </button>
                        </div>
                        <div className="font-mono text-xs text-blue-400 overflow-x-auto whitespace-pre-wrap p-2 bg-black/20 rounded-lg">
                            {exampleCurlTicket}
                        </div>
                        <p className="mt-4 text-xs text-slate-400">
                            Integra tu sistema de soporte o formulario de contacto para crear tickets directamente en el CRM.
                        </p>
                    </div>

                    {/* Bulk Import Schema */}
                    <div className="bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-800 lg:col-span-2">
                        <h4 className="text-slate-200 font-bold mb-4">📄 Formato para Carga Masiva (Bulk Import)</h4>
                        <p className="text-slate-400 text-sm mb-4">
                            Para usar el endpoint <code>POST /leads/bulk</code>, envía un objeto JSON con una propiedad <code>leads</code> que contenga un array (máximo 100 leads por petición):
                        </p>
                        <div className="font-mono text-xs text-orange-300 overflow-x-auto whitespace-pre-wrap p-4 bg-black/20 rounded-lg">
                            {`{
  "leads": [
    {
      "name": "Juan Perez",           // Requerido: Nombre completo
      "email": "juan@example.com",    // Requerido: Correo único
      "company": "Empresa S.A.",      // Opcional: Organización
      "value": 1500,                  // Opcional: Valor estimado (número)
      "status": "NEW",                // Opcional: NEW, CONTACTED, QUALIFIED...
      "notes": "Cliente importado"    // Opcional: Notas internas
    },
    {
      "name": "Maria Lopez",
      "email": "maria@tech.com"
      // ... más campos
    }
  ]
}`}
                        </div>
                    </div>
                </div>
            </div>

            {/* New Key Modal */}
            {showKeyModal && !generatedKey && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-scaleIn">
                        <h3 className="text-lg font-bold mb-4">Generar Nueva API Key</h3>
                        <form onSubmit={handleCreateKey}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Identificativo</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border rounded-lg p-2"
                                    placeholder="Ej: Wordpress Landing Page"
                                    value={newKeyName}
                                    onChange={e => setNewKeyName(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setShowKeyModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Generar Key</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Show Generated Key Modal */}
            {generatedKey && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-scaleIn">
                        <h3 className="text-lg font-bold mb-2 text-green-600">¡Key Generada con Éxito!</h3>
                        <p className="text-sm text-gray-600 mb-4">Copia esta clave ahora mismo. Por seguridad, no la volveremos a mostrar.</p>

                        <div className="bg-slate-900 text-emerald-400 p-4 rounded-lg font-mono text-sm break-all mb-6 relative group">
                            {generatedKey}
                            <button
                                onClick={() => { navigator.clipboard.writeText(generatedKey); showToast("Copiado!", "success"); }}
                                className="absolute right-2 top-2 bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded text-xs"
                            >
                                Copiar
                            </button>
                        </div>

                        <button
                            onClick={() => { setGeneratedKey(null); setShowKeyModal(false); }}
                            className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                        >
                            ¡Entendido!
                        </button>
                    </div>
                </div>
            )}

            {/* Webhook Modal */}
            {showWebhookModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-scaleIn">
                        <h3 className="text-lg font-bold mb-4">Registrar Webhook de Salida</h3>
                        <form onSubmit={handleCreateWebhook}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">URL del Endpoint (Tu Servidor)</label>
                                <input
                                    type="url"
                                    required
                                    className="w-full border rounded-lg p-2"
                                    placeholder="https://api.tu-app.com/webhooks/crm"
                                    value={newWebhook.url}
                                    onChange={e => setNewWebhook({ ...newWebhook, url: e.target.value })}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                                <input
                                    type="text"
                                    className="w-full border rounded-lg p-2"
                                    placeholder="Ej: Sincronización de contactos"
                                    value={newWebhook.description}
                                    onChange={e => setNewWebhook({ ...newWebhook, description: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setShowWebhookModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Registrar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
