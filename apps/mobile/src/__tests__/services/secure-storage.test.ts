import { describe, it, expect, beforeEach } from 'vitest';
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
});
