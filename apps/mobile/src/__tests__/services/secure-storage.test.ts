import { describe, it, expect, beforeEach } from 'vitest';
import { Platform } from 'react-native';
import { SecureStorageService } from '../../services/storage/secure-storage.service';

describe('SecureStorageService Unit Tests', () => {
  let storage: SecureStorageService;

  beforeEach(() => {
    storage = new SecureStorageService();
  });

  it('stores and retrieves a value', async () => {
    await storage.setItem('token_key', 'secret_jwt_value');
    const value = await storage.getItem('token_key');
    expect(value).toBe('secret_jwt_value');
  });

  it('returns null for non-existent key', async () => {
    const value = await storage.getItem('non_existent');
    expect(value).toBeNull();
  });

  it('removes a stored value', async () => {
    await storage.setItem('temp_key', 'temp_value');
    await storage.removeItem('temp_key');
    const value = await storage.getItem('temp_key');
    expect(value).toBeNull();
  });

  it('clears all stored values', async () => {
    await storage.setItem('key_1', 'val_1');
    await storage.setItem('key_2', 'val_2');
    await storage.clear();
    expect(await storage.getItem('key_1')).toBeNull();
    expect(await storage.getItem('key_2')).toBeNull();
  });

  it('persists across service re-instantiation when Web localStorage is available (simulating page refresh)', async () => {
    const mockStore: Record<string, string> = {};
    const mockLocalStorage: Storage = {
      getItem: (k: string) => mockStore[k] ?? null,
      setItem: (k: string, v: string) => {
        mockStore[k] = v;
      },
      removeItem: (k: string) => {
        delete mockStore[k];
      },
      clear: () => {
        for (const k in mockStore) delete mockStore[k];
      },
      key: (i: number) => Object.keys(mockStore)[i] ?? null,
      get length() {
        return Object.keys(mockStore).length;
      },
    };

    const g = globalThis as Record<string, unknown>;
    const originalPlatform = Platform.OS;
    Platform.OS = 'web';
    const originalWindow = g['window'];
    g['window'] = { localStorage: mockLocalStorage };

    try {
      const firstSessionStorage = new SecureStorageService();
      await firstSessionStorage.setItem('access_token', 'persisted_jwt_web_value');
      await firstSessionStorage.setItem('user_data', JSON.stringify({ id: 'u1', name: 'User 1' }));

      // Verify written to mock localStorage
      expect(mockStore['chatlock_sec_access_token']).toBe('persisted_jwt_web_value');

      // Simulate full page refresh with fresh storage instance and empty memory map
      const reloadedPageStorage = new SecureStorageService();
      const restoredToken = await reloadedPageStorage.getItem('access_token');
      const restoredUser = await reloadedPageStorage.getItem('user_data');

      expect(restoredToken).toBe('persisted_jwt_web_value');
      expect(JSON.parse(restoredUser!)).toEqual({ id: 'u1', name: 'User 1' });

      // Clean up via reloaded instance
      await reloadedPageStorage.clear();
      expect(await reloadedPageStorage.getItem('access_token')).toBeNull();
      expect(mockStore['chatlock_sec_access_token']).toBeUndefined();
    } finally {
      Platform.OS = originalPlatform;
      g['window'] = originalWindow;
    }
  });
});
