import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { E2EESessionState } from '@chatlock/shared-types';

const SESSION_INDEX_KEY = 'chatlock_e2ee_session_index';
const SESSION_PREFIX = 'chatlock_e2ee_session_';

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
      getAll: () => {
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
        result?: string[];
        error?: unknown;
      };
    };
  };
  objectStoreNames: { contains: (name: string) => boolean };
  createObjectStore: (name: string) => unknown;
}

class WebSessionIndexedDBStorage {
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
          const req = g.indexedDB!.open('chatlock_e2ee_keystore', 2);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('crypto_sessions')) {
              db.createObjectStore('crypto_sessions');
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
        const tx = db.transaction('crypto_sessions', 'readonly');
        const store = tx.objectStore('crypto_sessions');
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
      return new Promise((resolve) => {
        const tx = db.transaction('crypto_sessions', 'readwrite');
        const store = tx.objectStore('crypto_sessions');
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
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
        const tx = db.transaction('crypto_sessions', 'readwrite');
        const store = tx.objectStore('crypto_sessions');
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
        const tx = db.transaction('crypto_sessions', 'readwrite');
        const store = tx.objectStore('crypto_sessions');
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {
      // Ignore
    }
  }
}

export class SessionStore {
  private webStorage: WebSessionIndexedDBStorage | null = null;
  private memoryFallback: Map<string, string> = new Map();

  constructor() {
    if (Platform.OS === 'web') {
      this.webStorage = new WebSessionIndexedDBStorage();
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
      // Fallback
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
   * Persists an E2EE session state securely.
   */
  public async saveSession(session: E2EESessionState): Promise<void> {
    await this.rawSet(`${SESSION_PREFIX}${session.sessionId}`, JSON.stringify(session));

    // Update session index
    const indexRaw = await this.rawGet(SESSION_INDEX_KEY);
    const indexList: string[] = indexRaw ? JSON.parse(indexRaw) : [];
    if (!indexList.includes(session.sessionId)) {
      indexList.push(session.sessionId);
      await this.rawSet(SESSION_INDEX_KEY, JSON.stringify(indexList));
    }
  }

  /**
   * Retrieves a session state by sessionId (`${peerUserId}:${peerDeviceId}`).
   */
  public async getSession(sessionId: string): Promise<E2EESessionState | null> {
    const raw = await this.rawGet(`${SESSION_PREFIX}${sessionId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as E2EESessionState;
    } catch {
      return null;
    }
  }

  /**
   * Retrieves the active session for a given peer.
   */
  public async getActiveSession(
    peerUserId: string,
    peerDeviceId?: string,
  ): Promise<E2EESessionState | null> {
    if (peerDeviceId) {
      const session = await this.getSession(`${peerUserId}:${peerDeviceId}`);
      if (session && session.status === 'ACTIVE') return session;
      return null;
    }

    // Look for any active session with peerUserId
    const all = await this.getAllSessions();
    const match = all.find((s) => s.peerUserId === peerUserId && s.status === 'ACTIVE');
    return match ?? null;
  }

  /**
   * Marks an active session as INVALIDATED.
   */
  public async invalidateSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.status = 'INVALIDATED';
      session.lastActiveAt = new Date().toISOString();
      await this.saveSession(session);
    }
  }

  /**
   * Permanently removes a session from local storage.
   */
  public async deleteSession(sessionId: string): Promise<void> {
    await this.rawDelete(`${SESSION_PREFIX}${sessionId}`);

    const indexRaw = await this.rawGet(SESSION_INDEX_KEY);
    if (indexRaw) {
      try {
        const indexList: string[] = JSON.parse(indexRaw);
        const filtered = indexList.filter((id) => id !== sessionId);
        await this.rawSet(SESSION_INDEX_KEY, JSON.stringify(filtered));
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Retrieves all stored sessions.
   */
  public async getAllSessions(): Promise<E2EESessionState[]> {
    const indexRaw = await this.rawGet(SESSION_INDEX_KEY);
    if (!indexRaw) return [];

    try {
      const indexList: string[] = JSON.parse(indexRaw);
      const results: E2EESessionState[] = [];

      for (const id of indexList) {
        const raw = await this.rawGet(`${SESSION_PREFIX}${id}`);
        if (raw) {
          try {
            results.push(JSON.parse(raw) as E2EESessionState);
          } catch {
            // Ignore corrupted session
          }
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  /**
   * Clears all stored sessions.
   */
  public async clearAllSessions(): Promise<void> {
    const indexRaw = await this.rawGet(SESSION_INDEX_KEY);
    if (indexRaw) {
      try {
        const indexList: string[] = JSON.parse(indexRaw);
        for (const id of indexList) {
          await this.rawDelete(`${SESSION_PREFIX}${id}`);
        }
      } catch {
        // Ignore
      }
    }

    await this.rawDelete(SESSION_INDEX_KEY);

    if (this.webStorage) {
      await this.webStorage.clear();
    }
    this.memoryFallback.clear();
  }
}

export const sessionStore = new SessionStore();
