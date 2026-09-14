import { useNotificationStore } from '../../store/notification.store';
import { secureStorage } from '../storage/secure-storage.service';

export interface IncomingMessageNotificationPayload {
  conversationId: string;
  senderId: string;
  senderName?: string;
  content: string;
}

interface WebAudioContext {
  state: string;
  currentTime: number;
  resume: () => Promise<void>;
  createOscillator: () => {
    type: string;
    frequency: { setValueAtTime: (val: number, time: number) => void };
    connect: (dest: unknown) => void;
    start: (time: number) => void;
    stop: (time: number) => void;
  };
  createGain: () => {
    gain: {
      setValueAtTime: (val: number, time: number) => void;
      exponentialRampToValueAtTime: (val: number, time: number) => void;
    };
    connect: (dest: unknown) => void;
  };
  destination: unknown;
}

export class WebNotificationService {
  private static instance: WebNotificationService | null = null;
  private isInitialized = false;
  private deviceId: string | null = null;

  private constructor() {}

  public static getInstance(): WebNotificationService {
    if (!WebNotificationService.instance) {
      WebNotificationService.instance = new WebNotificationService();
    }
    return WebNotificationService.instance;
  }

  public getHasPermission(): boolean {
    return true;
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  public getPushToken(): string | null {
    return null;
  }

  /**
   * Retrieves or generates a persistent device UUID stored in secure storage.
   */
  public async getDeviceId(): Promise<string> {
    if (this.deviceId) return this.deviceId;

    try {
      let storedId = await secureStorage.getItem('chatlock_device_uuid');
      if (!storedId) {
        const rand =
          Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        storedId = `dev_web_${Date.now().toString(36)}_${rand}`;
        await secureStorage.setItem('chatlock_device_uuid', storedId);
      }
      this.deviceId = storedId;
      return storedId;
    } catch {
      return 'dev_web_fallback';
    }
  }

  /**
   * Synchronizes browser tab badge via W3C Badging API if supported.
   */
  public async syncBadgeCount(count: number): Promise<void> {
    try {
      const safeCount = Math.max(0, Math.floor(count));
      const globalScope =
        typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {};
      const nav = globalScope['navigator'] as
        | { setAppBadge?: (count: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
        | undefined;

      if (nav && typeof nav.setAppBadge === 'function') {
        if (safeCount > 0) {
          await nav.setAppBadge(safeCount);
        } else if (typeof nav.clearAppBadge === 'function') {
          await nav.clearAppBadge();
        }
      }
    } catch {
      // Badging API not supported or restricted in this environment
    }
  }

  /**
   * Clears the browser tab badge.
   */
  public async clearBadge(): Promise<void> {
    await this.syncBadgeCount(0);
  }

  /**
   * Web push token registration no-op.
   */
  public async registerForPushNotifications(): Promise<string | null> {
    return null;
  }

  /**
   * Web push token deactivation no-op.
   */
  public async deactivatePushToken(): Promise<void> {
    // Safe no-op on web
  }

  public async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  public async triggerVibration(): Promise<void> {
    const { vibrateEnabled } = useNotificationStore.getState();
    if (!vibrateEnabled) return;

    try {
      const globalScope =
        typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {};
      const nav = globalScope['navigator'] as
        { vibrate?: (pattern: number[]) => boolean } | undefined;
      if (nav && typeof nav.vibrate === 'function') {
        nav.vibrate([200, 100, 200]);
      }
    } catch {
      // Ignore vibration errors
    }
  }

  public playBellSound(): void {
    const { soundEnabled } = useNotificationStore.getState();
    if (!soundEnabled) return;

    try {
      const globalScope =
        typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {};
      const AudioContextClass = (globalScope['AudioContext'] ||
        globalScope['webkitAudioContext']) as (new () => WebAudioContext) | undefined;

      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      // Tone 1: 880 Hz (A5 bell fundamental)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2: 1320 Hz (E6 bell chime overtone, offset by 90ms)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now + 0.09);
      gain2.gain.setValueAtTime(0.22, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.55);
    } catch {
      // AudioContext autoplay restrictions
    }
  }

  public async notifyIncomingMessage(payload: IncomingMessageNotificationPayload): Promise<void> {
    const {
      notificationsEnabled,
      soundEnabled,
      vibrateEnabled,
      inAppAlertsEnabled,
      activeConversationId,
    } = useNotificationStore.getState();

    if (!notificationsEnabled) return;
    if (activeConversationId === payload.conversationId) return;

    if (vibrateEnabled) {
      await this.triggerVibration();
    }

    if (soundEnabled) {
      this.playBellSound();
    }

    // Browser Notification API for web desktop alerts when outside active chat
    if (inAppAlertsEnabled && activeConversationId !== payload.conversationId) {
      try {
        const globalScope =
          typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {};
        const NotificationClass = globalScope['Notification'] as
          | { permission: string; new (title: string, opts?: Record<string, unknown>): unknown }
          | undefined;

        if (NotificationClass && NotificationClass.permission === 'granted') {
          new NotificationClass(payload.senderName || 'New message', {
            body: payload.content || 'Sent a message',
          });
        }
      } catch {
        // Ignore desktop notification errors
      }
    }
  }
}

export const notificationService = WebNotificationService.getInstance();
