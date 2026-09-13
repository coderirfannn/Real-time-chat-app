import { create } from 'zustand';
import { appStorage } from '../services/storage/app-storage.service';

export interface NotificationSettingsState {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrateEnabled: boolean;
  inAppAlertsEnabled: boolean;
  activeConversationId: string | null;

  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setSoundEnabled: (enabled: boolean) => Promise<void>;
  setVibrateEnabled: (enabled: boolean) => Promise<void>;
  setInAppAlertsEnabled: (enabled: boolean) => Promise<void>;
  setActiveConversationId: (conversationId: string | null) => void;
  hydrateNotificationSettings: () => Promise<void>;
}

const STORAGE_KEYS = {
  NOTIFICATIONS_ENABLED: 'chatlock_notifications_enabled',
  SOUND_ENABLED: 'chatlock_sound_enabled',
  VIBRATE_ENABLED: 'chatlock_vibrate_enabled',
  IN_APP_ALERTS_ENABLED: 'chatlock_in_app_alerts_enabled',
};

export const useNotificationStore = create<NotificationSettingsState>((set) => ({
  notificationsEnabled: true,
  soundEnabled: true,
  vibrateEnabled: true,
  inAppAlertsEnabled: true,
  activeConversationId: null,

  setNotificationsEnabled: async (enabled: boolean) => {
    await appStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, JSON.stringify(enabled));
    set({ notificationsEnabled: enabled });
  },

  setSoundEnabled: async (enabled: boolean) => {
    await appStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, JSON.stringify(enabled));
    set({ soundEnabled: enabled });
  },

  setVibrateEnabled: async (enabled: boolean) => {
    await appStorage.setItem(STORAGE_KEYS.VIBRATE_ENABLED, JSON.stringify(enabled));
    set({ vibrateEnabled: enabled });
  },

  setInAppAlertsEnabled: async (enabled: boolean) => {
    await appStorage.setItem(STORAGE_KEYS.IN_APP_ALERTS_ENABLED, JSON.stringify(enabled));
    set({ inAppAlertsEnabled: enabled });
  },

  setActiveConversationId: (conversationId: string | null) => {
    set({ activeConversationId: conversationId });
  },

  hydrateNotificationSettings: async () => {
    try {
      const [notifs, sound, vibrate, inApp] = await Promise.all([
        appStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED),
        appStorage.getItem(STORAGE_KEYS.SOUND_ENABLED),
        appStorage.getItem(STORAGE_KEYS.VIBRATE_ENABLED),
        appStorage.getItem(STORAGE_KEYS.IN_APP_ALERTS_ENABLED),
      ]);

      set({
        notificationsEnabled: notifs !== null ? JSON.parse(notifs) : true,
        soundEnabled: sound !== null ? JSON.parse(sound) : true,
        vibrateEnabled: vibrate !== null ? JSON.parse(vibrate) : true,
        inAppAlertsEnabled: inApp !== null ? JSON.parse(inApp) : true,
      });
    } catch {
      // Keep defaults on read error
    }
  },
}));
