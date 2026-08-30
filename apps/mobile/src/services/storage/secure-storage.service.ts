import * as SecureStore from 'expo-secure-store';
import type { IStorageService } from './storage.interface.js';

export class SecureStorageService implements IStorageService {
  private memoryFallback: Map<string, string> = new Map();
  private knownKeys: Set<string> = new Set();
  private isNativeAvailable: boolean | null = null;

  private async checkAvailability(): Promise<boolean> {
    if (this.isNativeAvailable !== null) {
      return this.isNativeAvailable;
    }

    try {
      const isAvailFn =
        SecureStore.isAvailableAsync ||
        (SecureStore as unknown as { default?: { isAvailableAsync?: () => Promise<boolean> } })
          .default?.isAvailableAsync;

      if (typeof isAvailFn === 'function') {
        this.isNativeAvailable = await isAvailFn();
      } else {
        this.isNativeAvailable = false;
      }
    } catch {
      this.isNativeAvailable = false;
    }

    return this.isNativeAvailable;
  }

  public async getItem(key: string): Promise<string | null> {
    const available = await this.checkAvailability();
    if (available) {
      try {
        const getItemFn =
          SecureStore.getItemAsync ||
          (
            SecureStore as unknown as {
              default?: { getItemAsync?: (k: string) => Promise<string | null> };
            }
          ).default?.getItemAsync;

        if (typeof getItemFn === 'function') {
          const val = await getItemFn(key);
          if (val !== null && val !== undefined) {
            return val;
          }
        }
      } catch {
        // Fallback to in-memory map
      }
    }
    return this.memoryFallback.get(key) ?? null;
  }

  public async setItem(key: string, value: string): Promise<void> {
    this.knownKeys.add(key);
    this.memoryFallback.set(key, value);
    const available = await this.checkAvailability();
    if (available) {
      try {
        const setItemFn =
          SecureStore.setItemAsync ||
          (
            SecureStore as unknown as {
              default?: { setItemAsync?: (k: string, v: string) => Promise<void> };
            }
          ).default?.setItemAsync;

        if (typeof setItemFn === 'function') {
          await setItemFn(key, value);
        }
      } catch {
        // Already persisted in memory fallback
      }
    }
  }

  public async removeItem(key: string): Promise<void> {
    this.knownKeys.delete(key);
    this.memoryFallback.delete(key);
    const available = await this.checkAvailability();
    if (available) {
      try {
        const deleteItemFn =
          SecureStore.deleteItemAsync ||
          (
            SecureStore as unknown as {
              default?: { deleteItemAsync?: (k: string) => Promise<void> };
            }
          ).default?.deleteItemAsync;

        if (typeof deleteItemFn === 'function') {
          await deleteItemFn(key);
        }
      } catch {
        // Already removed from memory fallback
      }
    }
  }

  public async clear(): Promise<void> {
    const available = await this.checkAvailability();
    if (available) {
      const deleteItemFn =
        SecureStore.deleteItemAsync ||
        (
          SecureStore as unknown as {
            default?: { deleteItemAsync?: (k: string) => Promise<void> };
          }
        ).default?.deleteItemAsync;

      if (typeof deleteItemFn === 'function') {
        for (const key of this.knownKeys) {
          try {
            await deleteItemFn(key);
          } catch {
            // ignore
          }
        }
      }
    }
    this.knownKeys.clear();
    this.memoryFallback.clear();
  }
}

export const secureStorage = new SecureStorageService();
