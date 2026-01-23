'use client';

import { useEffect, useState } from 'react';

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'elevenlabs-convai': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { 'agent-id': string }, HTMLElement>;
        }
    }
}

export default function VoiceWidget() {
    const [agentId, setAgentId] = useState<string | null>(null);

    useEffect(() => {
        // Intentar leer configuración desde localStorage o usar fallback
        // En un caso real, esto vendría de un contexto o API
        const storedConfig = localStorage.getItem('elevenlabs_config');
        if (storedConfig) {
            try {
                const config = JSON.parse(storedConfig);
                if (config.agentId) setAgentId(config.agentId);
            } catch (e) {
                console.error('Error parsing config', e);
            }
        }

        // Cargar script de ElevenLabs
        const script = document.createElement('script');
        script.src = 'https://elevenlabs.io/convai-widget/index.js';
        script.async = true;
        script.type = 'text/javascript';
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    if (!agentId) return null; // No mostrar si no hay agente configurado

    return (
        <elevenlabs-convai agent-id={agentId}></elevenlabs-convai>
    );
}
