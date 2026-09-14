import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { socketManager } from '../services/socket/socket.manager';
import { notificationService } from '../services/notifications/notification.service';
import { useAuthStore } from '../store/auth.store';
import { useNotificationStore } from '../store/notification.store';
import type { IMessage } from '@chatlock/shared-types';

export function useNotificationListener(): void {
  const router = useRouter();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const hydrateSettings = useNotificationStore((state) => state.hydrateNotificationSettings);

  useEffect(() => {
    notificationService.initialize().catch(() => {});
    hydrateSettings().catch(() => {});
  }, [hydrateSettings]);

  // Deep-link on notification tap (when user clicks an incoming push notification)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let subscription: { remove: () => void } | null = null;
    try {
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response?.notification?.request?.content?.data as
          { conversationId?: string } | undefined;
        if (data?.conversationId) {
          const targetPath = `/(main)/chat/${data.conversationId}` as unknown as Parameters<
            typeof router.push
          >[0];
          router.push(targetPath);
        }
      });
    } catch {
      // Safe fallback in test/mock environment
    }

    return () => {
      subscription?.remove();
    };
  }, [router]);

  useEffect(() => {
    if (!currentUserId) return;

    const unsub = socketManager.onNewMessage((message: IMessage) => {
      const senderIdStr =
        typeof message.senderId === 'string'
          ? message.senderId
          : (message.senderId as { id?: string; _id?: string })?.id ||
            (message.senderId as { id?: string; _id?: string })?._id ||
            '';

      if (senderIdStr === currentUserId) return;

      const senderObj =
        typeof message.senderId === 'object' && message.senderId !== null
          ? (message.senderId as Record<string, unknown>)
          : null;

      const senderName =
        (typeof senderObj?.displayName === 'string' && senderObj.displayName) ||
        (typeof senderObj?.username === 'string' && senderObj.username) ||
        'New message';

      notificationService.notifyIncomingMessage({
        conversationId: message.conversationId,
        senderId: senderIdStr,
        senderName,
        content: message.content || '',
      });
    });

    return () => {
      unsub();
    };
  }, [currentUserId]);
}
