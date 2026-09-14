import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { KeyPair, OneTimePreKeyPair, SignedPreKeyPair } from './crypto.types';

const STORAGE_KEYS = {
  IDENTITY_KEY: 'chatlock_e2ee_identity_key',
  SIGNED_PRE_KEY: 'chatlock_e2ee_signed_pre_key',
  KEY_VERSION: 'chatlock_e2ee_key_version',
  OPK_INDEX: 'chatlock_e2ee_opk_index',
  OPK_PREFIX: 'chatlock_e2ee_opk_',
} as const;

interface SimpleIDBDatabase {
  transaction: (
    storeNames: string | string[],
    mode?: string,
  ) => {
    objectStore: (name: string) => {
      get: (key: string) => {
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
        result?: string;
        error?: unknown;
      };
      put: (
        value: string,
        key: string,
      ) => {
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
        error?: unknown;
      };
      delete: (key: string) => {
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
        error?: unknown;
      };
      clear: () => {
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
        error?: unknown;
      };
    };
  };
  objectStoreNames: { contains: (name: string) => boolean };
  createObjectStore: (name: string) => unknown;
}

class WebIndexedDBStorage {
  private dbPromise: Promise<SimpleIDBDatabase> | null = null;
  private memoryFallback: Map<string, string> = new Map();

  private getDB(): Promise<SimpleIDBDatabase> | null {
    if (typeof globalThis === 'undefined') return null;
    const g = globalThis as unknown as {
      indexedDB?: {
        open: (
          name: string,
          version?: number,
        ) => {
          onupgradeneeded: (() => void) | null;
          onsuccess: (() => void) | null;
          onerror: (() => void) | null;
          result: SimpleIDBDatabase;
          error?: unknown;
        };
      };
    };
    if (!g.indexedDB) return null;

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        try {
          const req = g.indexedDB!.open('chatlock_e2ee_keystore', 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('crypto_keys')) {
              db.createObjectStore('crypto_keys');
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        } catch (err) {
          reject(err);
        }
      });
    }
    return this.dbPromise;
  }

  public async get(key: string): Promise<string | null> {
    const dbPromise = this.getDB();
    if (!dbPromise) return this.memoryFallback.get(key) ?? null;
    try {
      const db = await dbPromise;
      return new Promise((resolve) => {
        const tx = db.transaction('crypto_keys', 'readonly');
        const store = tx.objectStore('crypto_keys');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(this.memoryFallback.get(key) ?? null);
      });
    } catch {
      return this.memoryFallback.get(key) ?? null;
    }
  }

  public async set(key: string, value: string): Promise<void> {
    this.memoryFallback.set(key, value);
    const dbPromise = this.getDB();
    if (!dbPromise) return;
    try {
      const db = await dbPromise;
      return new Promise((resolve, reject) => {
        const tx = db.transaction('crypto_keys', 'readwrite');
        const store = tx.objectStore('crypto_keys');
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback already populated
    }
  }

  public async delete(key: string): Promise<void> {
    this.memoryFallback.delete(key);
    const dbPromise = this.getDB();
    if (!dbPromise) return;
    try {
      const db = await dbPromise;
      return new Promise((resolve) => {
        const tx = db.transaction('crypto_keys', 'readwrite');
        const store = tx.objectStore('crypto_keys');
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {
      // Ignore
    }
  }

  public async clear(): Promise<void> {
    this.memoryFallback.clear();
    const dbPromise = this.getDB();
    if (!dbPromise) return;
    try {
      const db = await dbPromise;
      return new Promise((resolve) => {
        const tx = db.transaction('crypto_keys', 'readwrite');
        const store = tx.objectStore('crypto_keys');
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {
      // Ignore
    }
  }
}

export class DeviceKeyStore {
  private webStorage: WebIndexedDBStorage | null = null;
  private memoryFallback: Map<string, string> = new Map();

  constructor() {
    if (Platform.OS === 'web') {
      this.webStorage = new WebIndexedDBStorage();
    }
  }

  private async rawGet(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return this.webStorage
        ? await this.webStorage.get(key)
        : (this.memoryFallback.get(key) ?? null);
    }

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
        if (val !== null && val !== undefined) return val;
      }
    } catch {
      // Fallback
    }

    return this.memoryFallback.get(key) ?? null;
  }

  private async rawSet(key: string, value: string): Promise<void> {
    this.memoryFallback.set(key, value);

    if (Platform.OS === 'web') {
      if (this.webStorage) {
        await this.webStorage.set(key, value);
      }
      return;
    }

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
      // Fallback in memory
    }
  }

  private async rawDelete(key: string): Promise<void> {
    this.memoryFallback.delete(key);

    if (Platform.OS === 'web') {
      if (this.webStorage) {
        await this.webStorage.delete(key);
      }
      return;
    }

    try {
      const deleteItemFn =
        SecureStore.deleteItemAsync ||
        (SecureStore as unknown as { default?: { deleteItemAsync?: (k: string) => Promise<void> } })
          .default?.deleteItemAsync;

      if (typeof deleteItemFn === 'function') {
        await deleteItemFn(key);
      }
    } catch {
      // Fallback
    }
  }

  /**
   * Persists device Ed25519 identity key pair securely.
   */
  public async saveIdentityKeyPair(keyPair: KeyPair): Promise<void> {
    await this.rawSet(STORAGE_KEYS.IDENTITY_KEY, JSON.stringify(keyPair));
  }

  /**
   * Retrieves device Ed25519 identity key pair.
   */
  public async getIdentityKeyPair(): Promise<KeyPair | null> {
    const raw = await this.rawGet(STORAGE_KEYS.IDENTITY_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as KeyPair;
    } catch {
      return null;
    }
  }

  /**
   * Persists device X25519 signed pre-key securely.
   */
  public async saveSignedPreKey(signedPreKey: SignedPreKeyPair): Promise<void> {
    await this.rawSet(STORAGE_KEYS.SIGNED_PRE_KEY, JSON.stringify(signedPreKey));
  }

  /**
   * Retrieves device X25519 signed pre-key.
   */
  public async getSignedPreKey(): Promise<SignedPreKeyPair | null> {
    const raw = await this.rawGet(STORAGE_KEYS.SIGNED_PRE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SignedPreKeyPair;
    } catch {
      return null;
    }
  }

  /**
   * Stores a batch of one-time pre-keys, saving each key individually to respect Android KeyStore size limits.
   */
  public async saveOneTimePreKeys(keys: OneTimePreKeyPair[]): Promise<void> {
    const existingIndexRaw = await this.rawGet(STORAGE_KEYS.OPK_INDEX);
    const existingIndex: number[] = existingIndexRaw ? JSON.parse(existingIndexRaw) : [];
    const indexSet = new Set<number>(existingIndex);

    for (const key of keys) {
      await this.rawSet(`${STORAGE_KEYS.OPK_PREFIX}${key.keyId}`, JSON.stringify(key));
      indexSet.add(key.keyId);
    }

    await this.rawSet(STORAGE_KEYS.OPK_INDEX, JSON.stringify(Array.from(indexSet)));
  }

  /**
   * Retrieves all stored one-time pre-keys.
   */
  public async getOneTimePreKeys(): Promise<OneTimePreKeyPair[]> {
    const indexRaw = await this.rawGet(STORAGE_KEYS.OPK_INDEX);
    if (!indexRaw) return [];

    const keyIds: number[] = JSON.parse(indexRaw);
    const results: OneTimePreKeyPair[] = [];

    for (const id of keyIds) {
      const raw = await this.rawGet(`${STORAGE_KEYS.OPK_PREFIX}${id}`);
      if (raw) {
        try {
          results.push(JSON.parse(raw) as OneTimePreKeyPair);
        } catch {
          // Ignore corrupted key
        }
      }
    }

    return results;
  }

  /**
   * Retrieves a single one-time pre-key by keyId.
   */
  public async getOneTimePreKey(keyId: number): Promise<OneTimePreKeyPair | null> {
    const raw = await this.rawGet(`${STORAGE_KEYS.OPK_PREFIX}${keyId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OneTimePreKeyPair;
    } catch {
      return null;
    }
  }

  /**
   * Deletes a consumed one-time pre-key.
   */
  public async markOneTimePreKeyUsed(keyId: number): Promise<void> {
    await this.rawDelete(`${STORAGE_KEYS.OPK_PREFIX}${keyId}`);

    const indexRaw = await this.rawGet(STORAGE_KEYS.OPK_INDEX);
    if (indexRaw) {
      try {
        const keyIds: number[] = JSON.parse(indexRaw);
        const filtered = keyIds.filter((id) => id !== keyId);
        await this.rawSet(STORAGE_KEYS.OPK_INDEX, JSON.stringify(filtered));
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Persists key version.
   */
  public async setKeyVersion(version: number): Promise<void> {
    await this.rawSet(STORAGE_KEYS.KEY_VERSION, version.toString());
  }

  /**
   * Retrieves key version.
   */
  public async getKeyVersion(): Promise<number> {
    const raw = await this.rawGet(STORAGE_KEYS.KEY_VERSION);
    if (!raw) return 1;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 1 : parsed;
  }

  /**
   * Checks whether cryptographic keys exist on this device.
   */
  public async hasKeys(): Promise<boolean> {
    const identityKey = await this.getIdentityKeyPair();
    const signedPreKey = await this.getSignedPreKey();
    return identityKey !== null && signedPreKey !== null;
  }

  /**
   * Clears all cryptographic key material from local storage.
   */
  public async clearAllKeys(): Promise<void> {
    const indexRaw = await this.rawGet(STORAGE_KEYS.OPK_INDEX);
    if (indexRaw) {
      try {
        const keyIds: number[] = JSON.parse(indexRaw);
        for (const id of keyIds) {
          await this.rawDelete(`${STORAGE_KEYS.OPK_PREFIX}${id}`);
        }
      } catch {
        // Ignore
      }
    }

    await this.rawDelete(STORAGE_KEYS.IDENTITY_KEY);
    await this.rawDelete(STORAGE_KEYS.SIGNED_PRE_KEY);
    await this.rawDelete(STORAGE_KEYS.KEY_VERSION);
    await this.rawDelete(STORAGE_KEYS.OPK_INDEX);

    if (this.webStorage) {
      await this.webStorage.clear();
    }
    this.memoryFallback.clear();
  }
}

export const deviceKeyStore = new DeviceKeyStore();
