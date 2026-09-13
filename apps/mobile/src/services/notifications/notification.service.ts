import { Platform, Vibration } from 'react-native';
import { useNotificationStore } from '../../store/notification.store';

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

export class NotificationService {
  private static instance: NotificationService | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public getHasPermission(): boolean {
    return true;
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  public async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  /**
   * Triggers device vibration according to device capabilities and settings.
   * Uses React Native core Vibration API for seamless cross-platform reliability on iOS and Android.
   */
  public async triggerVibration(): Promise<void> {
    const { vibrateEnabled } = useNotificationStore.getState();
    if (!vibrateEnabled) return;

    try {
      if (Platform.OS === 'web') {
        const globalScope =
          typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {};
        const nav = globalScope['navigator'] as { vibrate?: (pattern: number[]) => boolean } | undefined;
        if (nav && typeof nav.vibrate === 'function') {
          nav.vibrate([200, 100, 200]);
        }
        return;
      }

      // Native iOS & Android hardware vibration
      Vibration.vibrate([0, 200, 100, 200]);
    } catch (err) {
      console.warn('[NotificationService] Vibration error:', err);
    }
  }

  /**
   * Synthesizes or plays an audible notification bell chime.
   * On Web, uses Web Audio API oscillator synthesis (crisp two-tone bell chime).
   */
  public playBellSound(): void {
    const { soundEnabled } = useNotificationStore.getState();
    if (!soundEnabled) return;

    if (Platform.OS === 'web') {
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
  }

  /**
   * Main notification handler when an incoming message is received.
   * Automatically vibrates and rings according to device hardware and settings.
   */
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

    // 1. Device Vibration
    if (vibrateEnabled) {
      await this.triggerVibration();
    }

    // 2. Bell Sound / Chime
    if (soundEnabled) {
      this.playBellSound();
    }

    // 3. Desktop / Browser Notification if available and outside active chat
    if (inAppAlertsEnabled && activeConversationId !== payload.conversationId) {
      try {
        const globalScope = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {};
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

export const notificationService = NotificationService.getInstance();
