import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useNotificationStore } from '../../store/notification.store';
import { apiClient } from '../api/client';
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

// Configure foreground notification behavior on native platforms
if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // Safe initialization fallback
  }
}

export class NotificationService {
  private static instance: NotificationService | null = null;
  private isInitialized = false;
  private pushToken: string | null = null;
  private deviceId: string | null = null;

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

  public getPushToken(): string | null {
    return this.pushToken;
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
          Math.random().toString(36).substring(2, 10) +
          Math.random().toString(36).substring(2, 10);
        storedId = `dev_${Platform.OS}_${Date.now().toString(36)}_${rand}`;
        await secureStorage.setItem('chatlock_device_uuid', storedId);
      }
      this.deviceId = storedId;
      return storedId;
    } catch {
      return `dev_${Platform.OS}_fallback`;
    }
  }

  /**
   * Synchronizes the native application launcher icon badge count on iOS/Android.
   */
  public async syncBadgeCount(count: number): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      const safeCount = Math.max(0, Math.floor(count));
      if (typeof Notifications.setBadgeCountAsync === 'function') {
        await Promise.resolve(Notifications.setBadgeCountAsync(safeCount)).catch(() => {});
      }
    } catch (err) {
      console.warn('[NotificationService] Failed to set badge count:', err);
    }
  }

  /**
   * Clears the native application launcher icon badge count (resets to 0).
   */
  public async clearBadge(): Promise<void> {
    await this.syncBadgeCount(0);
  }

  /**
   * Deactivates the device push token on the backend upon user logout.
   */
  public async deactivatePushToken(): Promise<void> {
    if (Platform.OS === 'web' || !this.pushToken) return;
    try {
      const deviceId = await this.getDeviceId();
      await apiClient.post('/devices/push-token/deactivate', {
        deviceId,
        pushToken: this.pushToken,
      });
    } catch {
      // Safe non-blocking sync
    }
  }

  /**
   * Initializes notification channels, permissions, and push token registration.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (Platform.OS === 'web') return;

    try {
      // 1. Android Notification Channel (Required for heads-up alerts on Android 8.0+)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('chat_messages', {
          name: 'Chat Messages',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563EB',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
      }

      // 2. Request permissions and register push token with backend
      await this.registerForPushNotifications();
    } catch (err) {
      console.warn('[NotificationService] Initialization warning:', err);
    }
  }

  /**
   * Requests push notification permissions and registers the Expo push token with the server.
   */
  public async registerForPushNotifications(): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    try {
      const permResult = Notifications.getPermissionsAsync
        ? await Promise.resolve(Notifications.getPermissionsAsync()).catch(() => null)
        : null;
      let finalStatus = permResult?.status;

      if (finalStatus !== 'granted') {
        const reqResult = Notifications.requestPermissionsAsync
          ? await Promise.resolve(Notifications.requestPermissionsAsync()).catch(() => null)
          : null;
        finalStatus = reqResult?.status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId ??
        'd0d37a73-72a4-4fcb-902a-e3ded337236f';

      const tokenData = typeof Notifications.getExpoPushTokenAsync === 'function'
        ? await Promise.resolve(
            Notifications.getExpoPushTokenAsync({
              projectId,
            }),
          ).catch(() => null)
        : null;

      const token = tokenData?.data || null;
      this.pushToken = token;

      if (token) {
        const deviceId = await this.getDeviceId();
        // Register token with backend server
        try {
          await apiClient.post('/devices/push-token', {
            pushToken: token,
            platform: Platform.OS,
            deviceId,
            appVersion: Constants.expoConfig?.version || '0.1.0',
          });
        } catch {
          // Safe non-blocking sync if offline
        }
      }

      return token;
    } catch (err) {
      console.warn('[NotificationService] Failed to register push token:', err);
      return null;
    }
  }

  /**
   * Triggers device vibration according to device capabilities and settings.
   */
  public async triggerVibration(): Promise<void> {
    const { vibrateEnabled } = useNotificationStore.getState();
    if (!vibrateEnabled) return;

    try {
      if (Platform.OS === 'web') {
        const globalScope =
          typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {};
        const nav = globalScope['navigator'] as
          { vibrate?: (pattern: number[]) => boolean } | undefined;
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
   * Main notification handler when an incoming message is received while app is active.
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

    // 3. Native In-App Banner / Local Notification
    if (inAppAlertsEnabled && activeConversationId !== payload.conversationId) {
      if (Platform.OS !== 'web') {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: payload.senderName || 'ChatLock',
              body: payload.content || 'Sent a message',
              sound: soundEnabled ? 'default' : undefined,
              data: {
                conversationId: payload.conversationId,
                senderId: payload.senderId,
              },
            },
            trigger: null,
          });
        } catch {
          // Ignore local notification errors
        }
      } else {
        // Desktop / Browser Notification
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
}

export const notificationService = NotificationService.getInstance();
