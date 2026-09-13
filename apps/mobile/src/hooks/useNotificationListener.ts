import { useEffect } from 'react';
import { socketManager } from '../services/socket/socket.manager';
import { notificationService } from '../services/notifications/notification.service';
import { useAuthStore } from '../store/auth.store';
import { useNotificationStore } from '../store/notification.store';
import type { IMessage } from '@chatlock/shared-types';

export function useNotificationListener() {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const hydrateSettings = useNotificationStore((state) => state.hydrateNotificationSettings);

  useEffect(() => {
    notificationService.initialize().catch(() => {});
    hydrateSettings().catch(() => {});
  }, [hydrateSettings]);

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
