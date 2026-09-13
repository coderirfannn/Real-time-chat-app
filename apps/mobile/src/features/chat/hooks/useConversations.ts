import { useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationApi } from '../../../services/api/conversation.api';
import { socketManager } from '../../../services/socket/socket.manager';
import { useAuthStore } from '../../../store/auth.store';
import { useNotificationStore } from '../../../store/notification.store';
import type { IMessage, UserProfile, PresenceUpdatePayload } from '@chatlock/shared-types';
import type { ConversationItemData } from '../../../types/chat.types';

export const CONVERSATIONS_QUERY_KEY = ['conversations'];

interface ConversationApiItem {
  id?: string;
  _id?: string;
  type: string;
  participants: Array<UserProfile | string>;
  lastMessageId?: unknown;
  lastMessage?: {
    content?: string;
    senderId?: string;
    createdAt?: string;
  };
  lastMessageAt?: string;
  unreadCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Module-level deduplication cache to prevent duplicate unread increments across multiple hook instances
const processedIncomingMessageIds = new Set<string>();

export function useConversations() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id || (currentUser as { _id?: string })?._id || '';
  const activeConvId = useNotificationStore((state) => state.activeConversationId);

  const {
    data: rawData,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: () => conversationApi.getConversations({ page: 1, limit: 50 }),
    enabled: Boolean(currentUserId),
    staleTime: 30 * 1000,
  });

  // Socket listener for new messages to update conversation preview and sort
  const handleNewMessage = useCallback(
    (message: IMessage) => {
      const msgUniqueKey =
        message.id ||
        message.clientMessageId ||
        `${message.conversationId}_${message.createdAt}_${message.content}`;

      if (processedIncomingMessageIds.has(msgUniqueKey)) {
        return;
      }
      processedIncomingMessageIds.add(msgUniqueKey);
      if (processedIncomingMessageIds.size > 500) {
        const first = processedIncomingMessageIds.values().next().value;
        if (first) processedIncomingMessageIds.delete(first);
      }

      queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, (oldData: unknown) => {
        if (!oldData) return oldData;
        const list = Array.isArray(oldData)
          ? oldData
          : (oldData as { docs?: ConversationApiItem[] }).docs || [];

        const exists = list.some(
          (item: ConversationApiItem) => (item.id || item._id) === message.conversationId,
        );

        if (!exists) {
          queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
          return oldData;
        }

        const activeConvId = useNotificationStore.getState().activeConversationId;
        const isViewing = activeConvId === message.conversationId;

        const updated = list.map((item: ConversationApiItem) => {
          const itemId = item.id || item._id;
          if (itemId === message.conversationId) {
            const user = useAuthStore.getState().user;
            const myUserId = user?.id || (user as { _id?: string })?._id || currentUserId;

            const senderIdStr =
              typeof message.senderId === 'string'
                ? message.senderId
                : (message.senderId as { id?: string; _id?: string })?.id ||
                  (message.senderId as { id?: string; _id?: string })?._id ||
                  String(message.senderId || '');

            const isSender = Boolean(myUserId && senderIdStr && senderIdStr === myUserId);

            // If this message was already applied to the item, do not increment unreadCount again
            const isSameMessage =
              item.lastMessageAt === message.createdAt &&
              item.lastMessage?.content === message.content;

            if (isSameMessage) {
              return item;
            }

            const newLastMessage = {
              id: message.id,
              content: message.content,
              senderId: senderIdStr,
              createdAt: message.createdAt,
            };
            return {
              ...item,
              lastMessage: newLastMessage,
              lastMessageId: newLastMessage,
              lastMessageAt: message.createdAt,
              unreadCount: isSender || isViewing ? 0 : (item.unreadCount || 0) + 1,
            };
          }
          return item;
        });

        // Sort by lastMessageAt descending
        updated.sort((a, b) => {
          const timeA = new Date(a.lastMessageAt || a.updatedAt || 0).getTime();
          const timeB = new Date(b.lastMessageAt || b.updatedAt || 0).getTime();
          return timeB - timeA;
        });

        return Array.isArray(oldData) ? updated : { ...(oldData as object), docs: updated };
      });
    },
    [queryClient, currentUserId],
  );

  // Socket listener for read receipts to clear unread counters
  const handleMessageRead = useCallback(
    (payload: { conversationId: string; userId: string }) => {
      const user = useAuthStore.getState().user;
      const myUserId = user?.id || (user as { _id?: string })?._id || currentUserId;

      if (!payload.userId || payload.userId === myUserId) {
        queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, (oldData: unknown) => {
          if (!oldData) return oldData;
          const list = Array.isArray(oldData)
            ? oldData
            : (oldData as { docs?: ConversationApiItem[] }).docs || [];

          const updated = list.map((item: ConversationApiItem) => {
            const itemId = item.id || item._id;
            if (itemId === payload.conversationId) {
              return {
                ...item,
                unreadCount: 0,
              };
            }
            return item;
          });

          return Array.isArray(oldData) ? updated : { ...(oldData as object), docs: updated };
        });
      }
    },
    [queryClient, currentUserId],
  );

  // Socket listener for presence updates
  const handlePresenceUpdate = useCallback(
    (payload: PresenceUpdatePayload) => {
      queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, (oldData: unknown) => {
        if (!oldData) return oldData;
        const list = Array.isArray(oldData)
          ? oldData
          : (oldData as { docs?: ConversationApiItem[] }).docs || [];

        const updated = list.map((item: ConversationApiItem) => {
          if (Array.isArray(item.participants)) {
            const updatedParticipants = item.participants.map((p) => {
              if (typeof p === 'object' && p.id === payload.userId) {
                return {
                  ...p,
                  status: payload.status,
                  lastSeenAt: payload.lastSeenAt || p.lastSeenAt,
                };
              }
              return p;
            });
            return { ...item, participants: updatedParticipants };
          }
          return item;
        });

        return Array.isArray(oldData) ? updated : { ...(oldData as object), docs: updated };
      });
    },
    [queryClient],
  );

  useEffect(() => {
    const unsubNew = socketManager.onNewMessage(handleNewMessage);
    const unsubRead = socketManager.onMessageRead(handleMessageRead);
    const unsubPresence = socketManager.onPresenceUpdate(handlePresenceUpdate);

    return () => {
      unsubNew();
      unsubRead();
      unsubPresence();
    };
  }, [handleNewMessage, handleMessageRead, handlePresenceUpdate]);

  const conversations: ConversationItemData[] = useMemo(() => {
    if (!rawData) return [];
    const list: ConversationApiItem[] = Array.isArray(rawData)
      ? rawData
      : (rawData as { docs?: ConversationApiItem[] }).docs || [];

    return list.map((conv) => {
      const convId = conv.id || conv._id || '';

      // Find peer participant
      let recipient: UserProfile = {
        id: 'unknown',
        username: 'User',
        displayName: 'Direct Chat',
        status: 'offline',
      };

      if (Array.isArray(conv.participants)) {
        const peer = conv.participants.find((p) => {
          if (typeof p === 'string') return p !== currentUserId;
          return p.id !== currentUserId && (p as { _id?: string })._id !== currentUserId;
        });

        if (peer && typeof peer === 'object') {
          recipient = peer;
        }
      }

      const lastMsg =
        conv.lastMessage ||
        (conv.lastMessageId && typeof conv.lastMessageId === 'object'
          ? (conv.lastMessageId as { content?: string; senderId?: string; createdAt?: string })
          : undefined);

      const rawSender = lastMsg?.senderId;
      const lastSenderId =
        typeof rawSender === 'string'
          ? rawSender
          : (rawSender as unknown as { id?: string; _id?: string })?.id ||
            (rawSender as unknown as { id?: string; _id?: string })?._id ||
            (rawSender ? String(rawSender) : '');

      const isLastSenderMe = Boolean(
        currentUserId && lastSenderId && lastSenderId === currentUserId,
      );

      return {
        id: convId,
        recipient,
        lastMessage: lastMsg
          ? {
              content: lastMsg.content || '',
              senderId: lastSenderId,
              createdAt: lastMsg.createdAt || conv.lastMessageAt || '',
            }
          : undefined,
        lastMessageAt: conv.lastMessageAt || conv.updatedAt,
        unreadCount: activeConvId === convId || isLastSenderMe ? 0 : conv.unreadCount || 0,
        isOnline: recipient.status === 'online',
      };
    });
  }, [rawData, currentUserId, activeConvId]);

  return {
    conversations,
    isLoading,
    isRefetching,
    error: error as Error | null,
    refetch,
  };
}
