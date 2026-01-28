'use client';

import { useEffect, useState } from 'react';

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'elevenlabs-convai': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { 'agent-id': string }, HTMLElement>;
        }
    }
}

export default function VoiceWidget({ agentId: propAgentId }: { agentId?: string }) {
    const [agentId, setAgentId] = useState<string | null>(propAgentId || null);

    useEffect(() => {
        // If prop provided, use it
        if (propAgentId) {
            setAgentId(propAgentId);
            return;
        }

        // Otherwise try local storage or default
        const storedConfig = localStorage.getItem('elevenlabs_config');
        if (storedConfig) {
            try {
                const config = JSON.parse(storedConfig);
                if (config.agentId) setAgentId(config.agentId);
            } catch (e) {
                console.error('Error parsing config', e);
            }
        }
    }, [propAgentId]);

    useEffect(() => {
        if (!agentId) return;

        // Load ElevenLabs script if not already loaded
        if (!document.querySelector('script[src="https://elevenlabs.io/convai-widget/index.js"]')) {
            const script = document.createElement('script');
            script.src = 'https://elevenlabs.io/convai-widget/index.js';
            script.async = true;
            script.type = 'text/javascript';
            document.body.appendChild(script);
        }
    }, [agentId]);

    if (!agentId) return null;

    return (
        <elevenlabs-convai agent-id={agentId}></elevenlabs-convai>
    );
}
