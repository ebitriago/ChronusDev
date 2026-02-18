import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Inbox from '../Inbox';

// Mock mocks
const mockSocket = {
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
    io: vi.fn(() => mockSocket),
}));

vi.mock('../Toast', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}));

// Mock API_URL
vi.mock('../../app/api', () => ({
    API_URL: 'http://localhost:3000',
    getHeaders: vi.fn(() => ({})),
}));

// Mock sub-components purely for display (shallow-like) if needed, 
// strictly speaking we can render them if they don't have side effects.
// ClientProfile might have side effects, let's mock it to be safe.
vi.mock('../ClientProfile', () => ({
    default: () => <div data-testid="client-profile">Client Profile</div>,
}));

describe('Inbox Component', () => {
    const mockConversations = [
        {
            sessionId: 'sess-1',
            platform: 'whatsapp',
            customerContact: '123456789',
            customerName: 'John Doe',
            messages: [
                { id: 'm1', content: 'Hello', from: 'user', timestamp: new Date().toISOString() }
            ],
            updatedAt: new Date().toISOString(),
            status: 'active'
        },
        {
            sessionId: 'sess-2',
            platform: 'instagram',
            customerContact: 'janedoe',
            customerName: 'Jane Doe',
            messages: [],
            updatedAt: new Date().toISOString(),
            status: 'active'
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    it('renders conversation list correctly', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockConversations,
        });

        // We also need to mock the other parallel fetches (agents, clients)
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/conversations')) {
                return Promise.resolve({ ok: true, json: async () => mockConversations });
            }
            if (url.includes('/assistai/agents')) {
                return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
            }
            if (url.includes('/clients')) {
                return Promise.resolve({ ok: true, json: async () => [] });
            }
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });

        render(<Inbox />);

        // Check for loading state or wait for content
        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        });

        expect(screen.getByText('Inbox Unificado')).toBeInTheDocument();
    });

    it('selects a conversation and shows messages', async () => {
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/conversations')) {
                return Promise.resolve({ ok: true, json: async () => mockConversations });
            }
            if (url.includes('/assistai/agents')) {
                return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
            }
            if (url.includes('/clients')) {
                return Promise.resolve({ ok: true, json: async () => [] });
            }
            // Takeover check
            if (url.includes('/takeover-status')) {
                return Promise.resolve({ ok: true, json: async () => ({ active: false }) });
            }
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });

        render(<Inbox />);

        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });

        const conversationItem = screen.getByText('John Doe');
        fireEvent.click(conversationItem);

        // Should show messages
        // Should show messages
        const msgs = await screen.findAllByText(/Hello/);
        expect(msgs.length).toBeGreaterThan(0);

        // Should try to join socket room
        expect(mockSocket.emit).toHaveBeenCalledWith('join_conversation', 'sess-1');
    });
});
