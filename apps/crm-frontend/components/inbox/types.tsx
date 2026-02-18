'use client';

// Shared types for Inbox components

export type ChatMessage = {
    id: string;
    sessionId: string;
    from: string;
    content: string;
    platform: 'assistai' | 'whatsapp' | 'instagram' | 'messenger' | 'web';
    sender: 'user' | 'agent';
    mediaUrl?: string;
    mediaType?: 'image' | 'audio' | 'document';
    timestamp: string;
    status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
};

export type Conversation = {
    sessionId: string;
    platform: 'assistai' | 'whatsapp' | 'instagram' | 'messenger' | 'web';
    customerName?: string;
    customerContact: string;
    agentCode?: string;
    agentName?: string;
    messages: ChatMessage[];
    status: 'active' | 'resolved';
    updatedAt: string;
};

export type Agent = {
    code: string;
    name: string;
    model: string;
    description: string;
};

export type TakeoverStatus = {
    active: boolean;
    takenBy?: string;
    remainingMinutes?: number;
    expiresAt?: string;
};

export type MatchedClient = {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    plan?: string;
    contacts: any[];
};

export const PLATFORM_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    assistai: { label: 'AssistAI', color: 'bg-emerald-500', icon: '🤖' },
    whatsapp: { label: 'WhatsApp', color: 'bg-green-500', icon: '📱' },
    instagram: { label: 'Instagram', color: 'bg-pink-500', icon: '📸' },
    messenger: { label: 'Messenger', color: 'bg-blue-500', icon: '💬' },
    web: { label: 'Web Chat', color: 'bg-purple-500', icon: '🌐' },
};

// Helper to render media content
export function renderMedia(msg: ChatMessage) {
    if (!msg.mediaUrl) return null;

    if (msg.mediaType === 'image') {
        return <img src={msg.mediaUrl} alt="Imagen" className="max-w-full rounded-lg mt-2 cursor-pointer hover:opacity-90" onClick={() => window.open(msg.mediaUrl, '_blank')} />;
    }
    if (msg.mediaType === 'audio') {
        return <audio controls src={msg.mediaUrl} className="mt-2 max-w-full" />;
    }
    if (msg.mediaType === 'document') {
        return (
            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg text-xs text-blue-600 hover:bg-gray-200">
                📎 Ver documento
            </a>
        );
    }
    return null;
}
