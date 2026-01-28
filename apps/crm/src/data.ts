
// State Management for CRM
// Currently stores ephemeral state like Human Takeover status.
// Persistent data should be in Prisma (Postgres).

export type ConversationTakeover = {
    sessionId: string;
    takenBy: string;       // user ID
    takenAt: Date;
    expiresAt: Date;
    previousMode: 'ai-only' | 'hybrid';
};

// In-memory takeover state
export const conversationTakeovers: Map<string, ConversationTakeover> = new Map();
