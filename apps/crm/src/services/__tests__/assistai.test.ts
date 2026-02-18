import { jest } from '@jest/globals';

// Define mock functions
const mockUpsertConversation = jest.fn();
const mockFindFirstConversation = jest.fn();
const mockUpsertMessage = jest.fn();
const mockFindFirstIntegration = jest.fn();

// Mock Prisma using unstable_mockModule for ESM support
jest.unstable_mockModule('../../db.js', () => ({
    prisma: {
        conversation: {
            upsert: mockUpsertConversation,
            findFirst: mockFindFirstConversation
        },
        message: {
            upsert: mockUpsertMessage
        },
        integration: {
            findFirst: mockFindFirstIntegration
        }
    }
}));

// Import modules AFTER mocking
const { AssistAIService } = await import('../assistai.js');
const { prisma } = await import('../../db.js');

// Mock Fetch
global.fetch = jest.fn() as any;

import { AssistAIConfig } from '../assistai.js';

describe('AssistAIService', () => {
    const mockConfig: AssistAIConfig = {
        baseUrl: 'https://api.assistai.lat',
        apiToken: 'test-token',
        tenantDomain: 'test-domain',
        organizationCode: 'test-org'
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should sync conversations correctly', async () => {
        // Mock API Response based on URL
        (global.fetch as jest.Mock).mockImplementation(async (url: any) => {
            const urlString = url.toString();
            if (urlString.includes('/agents')) {
                return {
                    ok: true,
                    json: async () => ({ data: [{ code: 'agent-1', name: 'Support Bot' }] })
                };
            }
            if (urlString.includes('/conversation') && !urlString.includes('/messages')) {
                return {
                    ok: true,
                    json: async () => ({
                        data: [
                            { id: 'uuid-1', contactPhone: '1234567890', source: 'whatsapp', createdAt: new Date().toISOString(), agentCode: 'agent-1' }
                        ]
                    })
                };
            }
            if (urlString.includes('/messages')) {
                return {
                    ok: true,
                    json: async () => ({
                        data: [
                            { id: 'msg-1', content: 'Hello', role: 'user', createdAt: new Date().toISOString() }
                        ]
                    })
                };
            }
            return { ok: false, status: 404, statusText: 'Not Found' };
        });

        // Mock Prisma Response
        mockUpsertConversation.mockResolvedValue({ id: 'local-conv-1' });

        const result = await AssistAIService.syncRecentConversations(mockConfig, 'org-1', 5);

        expect(result.syncedCount).toBe(1);
        expect(mockUpsertConversation).toHaveBeenCalledWith(expect.objectContaining({
            where: { sessionId: 'assistai-uuid-1' },
            create: expect.objectContaining({
                platform: 'WHATSAPP',
                customerContact: '1234567890',
                agentName: 'Support Bot'
            })
        }));
    });

    it('should send message successfully', async () => {
        (global.fetch as jest.Mock).mockImplementation(async (url) => {
            return {
                ok: true,
                json: async () => ({ success: true, messageId: 'net-msg-1' })
            };
        });

        const result = await AssistAIService.sendMessage(mockConfig, 'uuid-1', 'Hello from Human', 'Admin User');

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/conversations/uuid-1/messages'),
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('Admin User')
            })
        );
        expect(result).toBeDefined();
        expect(result.success).toBe(true);

        // Test Intervention
        await AssistAIService.sendMessage(mockConfig, 'uuid-1', 'Intervention Msg', 'Admin User', true);
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/conversations/uuid-1/messages'),
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('"intervention":true')
            })
        );
    });
});
