import { jest } from '@jest/globals';

const mockSchedule = jest.fn((cron: string, callback: () => void) => {
    callback();
});
const mockFindManyOrg = jest.fn();
const mockSyncRecentConversations = jest.fn();
const mockGetAssistAIConfig = jest.fn();

// Mock dependencies
jest.unstable_mockModule('node-cron', () => ({
    default: {
        schedule: mockSchedule
    }
}));

jest.unstable_mockModule('../../db.js', () => ({
    prisma: {
        organization: {
            findMany: mockFindManyOrg,
            findFirst: jest.fn()
        }
    }
}));

jest.unstable_mockModule('../../services/assistai.js', () => ({
    AssistAIService: {
        syncRecentConversations: mockSyncRecentConversations
    },
    getAssistAIConfig: mockGetAssistAIConfig
}));

// Dynamic imports
const { startAssistAISyncJob } = await import('../assistai-sync.js');
const cron = (await import('node-cron')).default;
const { prisma } = await import('../../db.js');
const { AssistAIService, getAssistAIConfig } = await import('../../services/assistai.js');

describe('AssistAI Sync Job', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should schedule cron job and sync for active organizations', async () => {
        // Mock Data
        const mockOrgs = [{ id: 'org-1', status: 'ACTIVE' }, { id: 'org-2', status: 'ACTIVE' }];
        mockFindManyOrg.mockResolvedValue(mockOrgs);
        mockGetAssistAIConfig.mockResolvedValue({ some: 'config' });
        mockSyncRecentConversations.mockResolvedValue({ syncedCount: 5 });

        // Start Job
        startAssistAISyncJob();

        // Verify Scheduling
        expect(mockSchedule).toHaveBeenCalledWith('* * * * *', expect.any(Function));

        // Use setTimeout to allow async callback in mock to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify Logic Execution
        expect(mockFindManyOrg).toHaveBeenCalledWith({ where: { subscriptionStatus: 'ACTIVE' } });
        expect(mockGetAssistAIConfig).toHaveBeenCalledTimes(2);
        expect(mockSyncRecentConversations).toHaveBeenCalledTimes(2);
        expect(mockSyncRecentConversations).toHaveBeenCalledWith(
            { some: 'config' },
            'org-1',
            20
        );
    });

    it('should handle no active organizations gracefully', async () => {
        mockFindManyOrg.mockResolvedValue([]);

        startAssistAISyncJob();

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(mockFindManyOrg).toHaveBeenCalled();
        expect(mockSyncRecentConversations).not.toHaveBeenCalled();
    });
});
