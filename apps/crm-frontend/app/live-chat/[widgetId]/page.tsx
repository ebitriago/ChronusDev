'use client';

import { useEffect, useState } from 'react';
import { API_URL } from '../../api';

export default function LiveChatPage({ params }: { params: { widgetId: string } }) {
    const [config, setConfig] = useState<{ agentCode: string, name: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`${API_URL}/public/channels/${params.widgetId}`)
            .then(res => {
                if (!res.ok) throw new Error('Canal no encontrado');
                return res.json();
            })
            .then(data => {
                setConfig(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [params.widgetId]);

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="w-12 h-12 border-4 border-indigo-200 rounded-full animate-spin border-t-indigo-600" />
        </div>
    );

    if (error) return (
        <div className="flex h-screen items-center justify-center bg-gray-50 flex-col gap-4">
            <div className="text-6xl">😕</div>
            <p className="text-gray-500 font-medium">{error}</p>
        </div>
    );

    if (!config?.agentCode) return (
        <div className="flex h-screen items-center justify-center bg-gray-50 flex-col gap-4">
            <div className="text-6xl">⚠️</div>
            <p className="text-gray-500 font-medium">Configuración de agente incompleta</p>
        </div>
    );

    return (
        <div className="w-full h-screen bg-white">
            <iframe
                src={`https://account.assistai.lat/${config.agentCode}`}
                className="w-full h-full border-0"
                allow="microphone; camera; geolocation"
                title={`Chat con ${config.name}`}
            />
        </div>
    );
}
