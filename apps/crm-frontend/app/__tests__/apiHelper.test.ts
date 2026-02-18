import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, apiGet, apiPost } from '../apiHelper';
import { logger } from '../logger';

// Mock fetch global
global.fetch = vi.fn();

// Mock logger
vi.mock('../logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        apiError: vi.fn(),
    },
}));

describe('apiHelper', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('apiFetch', () => {
        it('should successfully fetch data', async () => {
            const mockData = { id: 1, name: 'Test' };
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockData,
            });

            const result = await apiFetch('/test');

            expect(result).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith('/test', {});
        });

        it('should throw error on HTTP error', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({ error: 'Not found' }),
            });

            await expect(apiFetch('/test')).rejects.toThrow('Not found');
            expect(logger.apiError).toHaveBeenCalled();
        });

        it('should retry on network error', async () => {
            // First two calls fail, third succeeds
            (global.fetch as any)
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ success: true }),
                });

            const result = await apiFetch('/test');

            expect(result).toEqual({ success: true });
            expect(global.fetch).toHaveBeenCalledTimes(3);
            expect(logger.warn).toHaveBeenCalledTimes(2);
        });

        it('should retry on 500 error', async () => {
            // First call fails with 500, second succeeds
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    json: async () => ({ error: 'Server error' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ success: true }),
                });

            const result = await apiFetch('/test');

            expect(result).toEqual({ success: true });
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('should not retry when skipRetry is true', async () => {
            (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

            await expect(apiFetch('/test', { skipRetry: true })).rejects.toThrow('Network error');
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('apiGet', () => {
        it('should make GET request', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: 'test' }),
            });

            await apiGet('/test');

            expect(global.fetch).toHaveBeenCalledWith('/test', { method: 'GET' });
        });
    });

    describe('apiPost', () => {
        it('should make POST request with body', async () => {
            const body = { name: 'Test' };
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 1 }),
            });

            await apiPost('/test', body);

            expect(global.fetch).toHaveBeenCalledWith('/test', {
                method: 'POST',
                body: JSON.stringify(body),
            });
        });
    });
});
