import { useAppStore } from '../../store/app.store';
import { useAuthStore } from '../../store/auth.store';
import { socketManager } from '../socket/socket.manager';
import { outboxSyncManager } from '../outbox/outbox-sync.manager';

export type NetworkStatus = 'online' | 'offline';

export class NetworkService {
  private static instance: NetworkService | null = null;
  private isInitialized = false;
  private currentStatus: NetworkStatus = 'online';
  private listeners: Set<(status: NetworkStatus) => void> = new Set();

  private constructor() {}

  public static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  /**
   * Initializes network monitoring across Web and Native platforms.
   */
  public initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Web environment listeners
    const globalObj =
      typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : null;
    const win =
      globalObj && typeof globalObj['window'] === 'object'
        ? (globalObj['window'] as Record<string, unknown>)
        : null;
    const nav =
      globalObj && typeof globalObj['navigator'] === 'object'
        ? (globalObj['navigator'] as Record<string, unknown>)
        : null;

    if (win && typeof win['addEventListener'] === 'function') {
      const addEvt = win['addEventListener'] as (event: string, handler: () => void) => void;
      addEvt('online', () => this.handleNetworkChange(true));
      addEvt('offline', () => this.handleNetworkChange(false));
      const onLineVal = nav && typeof nav['onLine'] === 'boolean' ? nav['onLine'] : true;
      this.handleNetworkChange(onLineVal);
    } else {
      // Default to online in native environment
      this.handleNetworkChange(true);
    }
  }

  public handleNetworkChange(isOnline: boolean): void {
    const nextStatus: NetworkStatus = isOnline ? 'online' : 'offline';
    this.currentStatus = nextStatus;

    useAppStore.getState().setIsOnline(isOnline);

    this.listeners.forEach((listener) => {
      try {
        listener(nextStatus);
      } catch (err) {
        void err;
      }
    });

    if (isOnline) {
      this.handleConnectionRestored();
    }
  }

  private handleConnectionRestored(): void {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken && !socketManager.isConnected()) {
      socketManager.connect(accessToken);
    }

    // Process queued offline outbox messages
    outboxSyncManager.processQueue().catch(() => {});
  }

  public isOnline(): boolean {
    return this.currentStatus === 'online';
  }

  public onStatusChange(listener: (status: NetworkStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus);
    return () => this.listeners.delete(listener);
  }
}

export const networkService = NetworkService.getInstance();
