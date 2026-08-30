import { describe, it, expect } from 'vitest';
import { getRedisStatus, isRedisReady, pingRedis, disconnectRedis } from '../redis/client.js';

describe('Redis Connection Infrastructure', () => {
  it('returns valid initial connection status', () => {
    const status = getRedisStatus();
    expect(['closed', 'connecting', 'ready', 'error', 'reconnecting', 'end']).toContain(status);
  });

  it('reports isRedisReady correctly when closed', () => {
    const ready = isRedisReady();
    expect(ready).toBe(false);
  });

  it('ping returns false when client is not connected', async () => {
    const pingResult = await pingRedis();
    expect(pingResult).toBe(false);
  });

  it('disconnects safely when closed', async () => {
    await expect(disconnectRedis()).resolves.toBeUndefined();
  });
});
