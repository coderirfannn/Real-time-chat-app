import { appStorage } from '../storage/app-storage.service';
import type { IStorageService } from '../storage/storage.interface';

const STORAGE_PREFIX = 'e2ee_decrypted:';

export class DecryptedCacheService {
  private memoryCache: Map<string, string> = new Map();

  constructor(private readonly storage: IStorageService = appStorage) {}

  /**
   * Synchronous 0ms lookup from in-memory cache for render loops and message lists.
   */
  public getSync(id: string): string | undefined {
    if (!id) return undefined;
    return this.memoryCache.get(id);
  }

  /**
   * Asynchronous lookup: checks in-memory cache first, falling back to durable appStorage.
   */
  public async get(id: string): Promise<string | undefined> {
    if (!id) return undefined;
    const memoryHit = this.memoryCache.get(id);
    if (memoryHit !== undefined) {
      return memoryHit;
    }

    try {
      const stored = await this.storage.getItem(`${STORAGE_PREFIX}${id}`);
      if (stored !== null) {
        this.memoryCache.set(id, stored);
        return stored;
      }
    } catch {
      // Ignore storage read errors
    }

    return undefined;
  }

  /**
   * Caches decrypted plaintext synchronously and asynchronously persists to storage.
   * Can accept an alternate ID (e.g. associating clientMessageId and serverMessageId).
   */
  public async set(id: string, plaintext: string, altId?: string): Promise<void> {
    if (!id) return;
    this.memoryCache.set(id, plaintext);
    if (altId) {
      this.memoryCache.set(altId, plaintext);
    }

    try {
      await this.storage.setItem(`${STORAGE_PREFIX}${id}`, plaintext);
      if (altId) {
        await this.storage.setItem(`${STORAGE_PREFIX}${altId}`, plaintext);
      }
    } catch {
      // Ignore storage write errors
    }
  }

  /**
   * Synchronous cache set for fast path.
   */
  public setSync(id: string, plaintext: string, altId?: string): void {
    if (!id) return;
    this.memoryCache.set(id, plaintext);
    if (altId) {
      this.memoryCache.set(altId, plaintext);
    }
    // Fire-and-forget persistent write
    this.storage.setItem(`${STORAGE_PREFIX}${id}`, plaintext).catch(() => {});
    if (altId) {
      this.storage.setItem(`${STORAGE_PREFIX}${altId}`, plaintext).catch(() => {});
    }
  }

  /**
   * Checks if an ID exists in the synchronous cache.
   */
  public hasSync(id: string): boolean {
    if (!id) return false;
    return this.memoryCache.has(id);
  }

  /**
   * Checks if an ID exists in cache or storage.
   */
  public async has(id: string): Promise<boolean> {
    if (!id) return false;
    if (this.memoryCache.has(id)) return true;
    const val = await this.get(id);
    return val !== undefined;
  }

  /**
   * Clears the in-memory cache and persisted items.
   */
  public async clear(): Promise<void> {
    this.memoryCache.clear();
  }

  public clearSync(): void {
    this.memoryCache.clear();
  }
}

export const decryptedCacheService = new DecryptedCacheService();
