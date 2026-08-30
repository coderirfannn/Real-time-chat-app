import { describe, it, expect, vi } from 'vitest';

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        apiUrl: 'http://localhost:5000/api/v1',
        socketUrl: 'http://localhost:5000',
        appEnv: 'development',
      },
    },
  },
}));

describe('Mobile App Foundation', () => {
  it('loads valid mobile configuration', async () => {
    const { mobileConfig } = await import('../config/env.js');
    expect(mobileConfig).toBeDefined();
    expect(mobileConfig.apiUrl).toBe('http://localhost:5000/api/v1');
    expect(mobileConfig.socketUrl).toBe('http://localhost:5000');
    expect(mobileConfig.env).toBe('development');
    expect(mobileConfig.isDevelopment).toBe(true);
  });
});
