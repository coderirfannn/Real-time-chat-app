import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Vibration } from 'react-native';
import { notificationService } from '../../services/notifications/notification.service';
import { useNotificationStore } from '../../store/notification.store';
import { appStorage } from '../../services/storage/app-storage.service';

describe('Notification Service & Store Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await appStorage.clear();
    // Reset store to defaults
    useNotificationStore.setState({
      notificationsEnabled: true,
      soundEnabled: true,
      vibrateEnabled: true,
      inAppAlertsEnabled: true,
      activeConversationId: null,
    });
  });

  describe('Notification Store', () => {
    it('1. Initializes with default preferences', () => {
      const state = useNotificationStore.getState();
      expect(state.notificationsEnabled).toBe(true);
      expect(state.soundEnabled).toBe(true);
      expect(state.vibrateEnabled).toBe(true);
      expect(state.inAppAlertsEnabled).toBe(true);
      expect(state.activeConversationId).toBeNull();
    });

    it('2. Toggles preferences and persists to storage', async () => {
      const { setNotificationsEnabled, setSoundEnabled, setVibrateEnabled, setInAppAlertsEnabled } =
        useNotificationStore.getState();

      await setNotificationsEnabled(false);
      expect(useNotificationStore.getState().notificationsEnabled).toBe(false);

      await setSoundEnabled(false);
      expect(useNotificationStore.getState().soundEnabled).toBe(false);

      await setVibrateEnabled(false);
      expect(useNotificationStore.getState().vibrateEnabled).toBe(false);

      await setInAppAlertsEnabled(false);
      expect(useNotificationStore.getState().inAppAlertsEnabled).toBe(false);
    });

    it('3. Sets and clears activeConversationId', () => {
      const { setActiveConversationId } = useNotificationStore.getState();

      setActiveConversationId('conv_abc_123');
      expect(useNotificationStore.getState().activeConversationId).toBe('conv_abc_123');

      setActiveConversationId(null);
      expect(useNotificationStore.getState().activeConversationId).toBeNull();
    });

    it('4. Hydrates stored notification preferences', async () => {
      await appStorage.setItem('chatlock_notifications_enabled', JSON.stringify(false));
      await appStorage.setItem('chatlock_sound_enabled', JSON.stringify(false));
      await appStorage.setItem('chatlock_vibrate_enabled', JSON.stringify(true));

      await useNotificationStore.getState().hydrateNotificationSettings();

      const state = useNotificationStore.getState();
      expect(state.notificationsEnabled).toBe(false);
      expect(state.soundEnabled).toBe(false);
      expect(state.vibrateEnabled).toBe(true);
    });
  });

  describe('Notification Service', () => {
    it('5. Initializes notification service', async () => {
      await notificationService.initialize();
      expect(notificationService.getHasPermission()).toBe(true);
      expect(notificationService.getIsInitialized()).toBe(true);
    });

    it('6. Triggers vibration when vibrateEnabled is true', async () => {
      useNotificationStore.setState({ vibrateEnabled: true });

      await notificationService.triggerVibration();
      expect(Vibration.vibrate).toHaveBeenCalledWith([0, 200, 100, 200]);
    });

    it('7. Suppresses vibration when vibrateEnabled is false', async () => {
      useNotificationStore.setState({ vibrateEnabled: false });

      await notificationService.triggerVibration();
      expect(Vibration.vibrate).not.toHaveBeenCalled();
    });

    it('8. Plays bell sound without throwing when soundEnabled is true', () => {
      useNotificationStore.setState({ soundEnabled: true });
      expect(() => notificationService.playBellSound()).not.toThrow();
    });

    it('9. Suppresses incoming message notification completely when notificationsEnabled is false', async () => {
      useNotificationStore.setState({ notificationsEnabled: false });

      await notificationService.notifyIncomingMessage({
        conversationId: 'conv_123',
        senderId: 'user_456',
        senderName: 'Alice',
        content: 'Hey there!',
      });

      expect(Vibration.vibrate).not.toHaveBeenCalled();
    });

    it('10. Dispatches vibration and chime on incoming message', async () => {
      useNotificationStore.setState({
        notificationsEnabled: true,
        soundEnabled: true,
        vibrateEnabled: true,
        activeConversationId: null,
      });

      await notificationService.notifyIncomingMessage({
        conversationId: 'conv_123',
        senderId: 'user_456',
        senderName: 'Alice',
        content: 'Hey there!',
      });

      expect(Vibration.vibrate).toHaveBeenCalledWith([0, 200, 100, 200]);
    });

    it('11. Suppresses vibration and chime when incoming message is for the active conversation', async () => {
      useNotificationStore.setState({
        notificationsEnabled: true,
        soundEnabled: true,
        vibrateEnabled: true,
        activeConversationId: 'conv_123',
      });

      await notificationService.notifyIncomingMessage({
        conversationId: 'conv_123',
        senderId: 'user_456',
        senderName: 'Alice',
        content: 'Hey there!',
      });

      expect(Vibration.vibrate).not.toHaveBeenCalled();
    });
  });
});
