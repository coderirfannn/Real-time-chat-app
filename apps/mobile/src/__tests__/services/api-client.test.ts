import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiClient, ApiError } from '../../services/api/client';
import { secureStorage } from '../../services/storage/secure-storage.service';

describe('ApiClient Unit Tests', () => {
  let client: ApiClient;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    client = new ApiClient('http://test-api.local/api/v1', 5000);
    await secureStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('injects Bearer token and custom request headers into request', async () => {
    await secureStorage.setItem('access_token', 'test-access-token');

    let capturedHeaders: Record<string, string> | undefined;
    global.fetch = vi.fn().mockImplementation((_url, options) => {
      capturedHeaders = options.headers as Record<string, string>;
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ success: true, data: { status: 'ok' } })),
      });
    });

    const res = await client.get<{ status: string }>('/health');

    expect(res).toEqual({ status: 'ok' });
    expect(capturedHeaders).toBeDefined();
    expect(capturedHeaders?.['Authorization']).toBe('Bearer test-access-token');
    expect(capturedHeaders?.['X-Request-ID']).toBeDefined();
  });

  it('skips Authorization header when skipAuth is true', async () => {
    await secureStorage.setItem('access_token', 'test-access-token');

    let capturedHeaders: Record<string, string> | undefined;
    global.fetch = vi.fn().mockImplementation((_url, options) => {
      capturedHeaders = options.headers as Record<string, string>;
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ success: true, data: { user: 'test' } })),
      });
    });

    await client.post('/auth/login', { username: 'test' }, { skipAuth: true });

    expect(capturedHeaders?.['Authorization']).toBeUndefined();
  });

  it('normalizes API error responses into ApiError instances', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () =>
          Promise.resolve(
            JSON.stringify({
              success: false,
              error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
            }),
          ),
      }),
    );

    await expect(client.post('/auth/login', {})).rejects.toThrow(ApiError);

    try {
      await client.post('/auth/login', {});
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.statusCode).toBe(400);
      expect(apiErr.errorCode).toBe('INVALID_CREDENTIALS');
      expect(apiErr.message).toBe('Invalid username or password');
    }
  });

  it('handles 401 Unauthorized with automatic token refresh and transparent retry', async () => {
    await secureStorage.setItem('access_token', 'expired-token');
    await secureStorage.setItem('refresh_token', 'valid-refresh-token');

    let conversationCalls = 0;
    global.fetch = vi.fn().mockImplementation((url) => {
      const urlStr = String(url);

      if (urlStr.includes('/auth/refresh')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                success: true,
                data: {
                  tokens: {
                    accessToken: 'new-fresh-token',
                    refreshToken: 'new-refresh-token',
                  },
                },
              }),
            ),
        });
      }

      if (urlStr.includes('/conversations')) {
        conversationCalls++;
        if (conversationCalls === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  success: false,
                  error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
                }),
              ),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                success: true,
                data: [{ id: 'conv-1' }],
              }),
            ),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ success: true, data: {} })),
      });
    });

    const res = await client.get<Array<{ id: string }>>('/conversations');

    expect(res).toEqual([{ id: 'conv-1' }]);
    expect(await secureStorage.getItem('access_token')).toBe('new-fresh-token');
    expect(await secureStorage.getItem('refresh_token')).toBe('new-refresh-token');
  });
});
