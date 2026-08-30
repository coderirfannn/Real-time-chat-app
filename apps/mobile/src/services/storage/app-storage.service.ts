import type { IStorageService } from './storage.interface';

export class AppStorageService implements IStorageService {
  private memoryMap: Map<string, string> = new Map();

  public async getItem(key: string): Promise<string | null> {
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch {
        return this.memoryMap.get(key) ?? null;
      }
    }
    return this.memoryMap.get(key) ?? null;
  }

  public async setItem(key: string, value: string): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, value);
        return;
      } catch {
        this.memoryMap.set(key, value);
        return;
      }
    }
    this.memoryMap.set(key, value);
  }

  public async removeItem(key: string): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch {
        this.memoryMap.delete(key);
      }
    }
    this.memoryMap.delete(key);
  }

  public async clear(): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.clear();
      } catch {
        this.memoryMap.clear();
      }
    }
    this.memoryMap.clear();
  }
}

export const appStorage = new AppStorageService();
