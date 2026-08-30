import { describe, it, expect } from 'vitest';
import { getMongoStatus, isMongoReady, disconnectMongo } from '../database/connection.js';

describe('Database Connection Infrastructure', () => {
  it('returns valid initial connection status', () => {
    const status = getMongoStatus();
    expect(['disconnected', 'connected', 'connecting', 'disconnecting', 'uninitialized']).toContain(
      status,
    );
  });

  it('reports isMongoReady correctly', () => {
    const ready = isMongoReady();
    expect(typeof ready).toBe('boolean');
  });

  it('disconnects safely when not connected', async () => {
    await expect(disconnectMongo()).resolves.toBeUndefined();
  });
});
