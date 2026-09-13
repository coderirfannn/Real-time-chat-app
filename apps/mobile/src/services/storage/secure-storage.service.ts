import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { IStorageService } from './storage.interface';

const WEB_STORAGE_PREFIX = 'chatlock_sec_';

export class SecureStorageService implements IStorageService {
  private memoryFallback: Map<string, string> = new Map();
  private knownKeys: Set<string> = new Set();
  private isNativeAvailable: boolean | null = null;

  private getWebStorage(): {
    getItem: (k: string) => string | null;
    setItem: (k: string, v: string) => void;
    removeItem: (k: string) => void;
    key: (i: number) => string | null;
    readonly length: number;
  } | null {
    try {
      if (typeof globalThis !== 'undefined') {
        const win = (globalThis as Record<string, unknown>)['window'] as
          | {
              localStorage?: {
                getItem: (k: string) => string | null;
                setItem: (k: string, v: string) => void;
                removeItem: (k: string) => void;
                key: (i: number) => string | null;
                readonly length: number;
              };
            }
          | undefined;
        if (win && win.localStorage && typeof win.localStorage.getItem === 'function') {
          return win.localStorage;
        }
      }
    } catch {
      // Access denied (e.g. sandboxed iframe or disabled cookies)
    }
    return null;
  }

  private async checkAvailability(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }

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
        // Fallback to web storage or in-memory map
      }
    }

    const webStorage = this.getWebStorage();
    if (webStorage) {
      try {
        const val = webStorage.getItem(`${WEB_STORAGE_PREFIX}${key}`);
        if (val !== null && val !== undefined) {
          return val;
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
          return;
        }
      } catch {
        // Fallback to web storage
      }
    }

    const webStorage = this.getWebStorage();
    if (webStorage) {
      try {
        webStorage.setItem(`${WEB_STORAGE_PREFIX}${key}`, value);
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
        // Fallback
      }
    }

    const webStorage = this.getWebStorage();
    if (webStorage) {
      try {
        webStorage.removeItem(`${WEB_STORAGE_PREFIX}${key}`);
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

    const webStorage = this.getWebStorage();
    if (webStorage) {
      try {
        for (const key of this.knownKeys) {
          webStorage.removeItem(`${WEB_STORAGE_PREFIX}${key}`);
        }
        const toRemove: string[] = [];
        for (let i = 0; i < webStorage.length; i++) {
          const k = webStorage.key(i);
          if (k && k.startsWith(WEB_STORAGE_PREFIX)) {
            toRemove.push(k);
          }
        }
        toRemove.forEach((k) => webStorage.removeItem(k));
      } catch {
        // ignore
      }
    }

    this.knownKeys.clear();
    this.memoryFallback.clear();
  }
}

export const secureStorage = new SecureStorageService();
