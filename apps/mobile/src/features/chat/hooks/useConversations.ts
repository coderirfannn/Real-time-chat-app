import { useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationApi } from '../../../services/api/conversation.api.js';
import { socketManager } from '../../../services/socket/socket.manager.js';
import { useAuthStore } from '../../../store/auth.store.js';
import type { IMessage, UserProfile } from '@chatlock/shared-types';
import type { ConversationItemData } from '../../../types/chat.types.js';

export const CONVERSATIONS_QUERY_KEY = ['conversations'];

interface ConversationApiItem {
  id?: string;
  _id?: string;
  type: string;
  participants: Array<UserProfile | string>;
  lastMessageId?: unknown;
  lastMessageAt?: string;
  unreadCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export function useConversations() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id);

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
      queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, (oldData: unknown) => {
        if (!oldData) return oldData;
        const list = Array.isArray(oldData)
          ? oldData
          : (oldData as { docs?: ConversationApiItem[] }).docs || [];

        const updated = list.map((item: ConversationApiItem) => {
          const itemId = item.id || item._id;
          if (itemId === message.conversationId) {
            const isSender =
              (typeof message.senderId === 'string'
                ? message.senderId
                : (message.senderId as { id?: string; _id?: string }).id) === currentUserId;
            return {
              ...item,
              lastMessage: {
                content: message.content,
                senderId: message.senderId,
                createdAt: message.createdAt,
              },
              lastMessageAt: message.createdAt,
              unreadCount: isSender ? item.unreadCount || 0 : (item.unreadCount || 0) + 1,
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

  useEffect(() => {
    const unsub = socketManager.onNewMessage(handleNewMessage);
    return unsub;
  }, [handleNewMessage]);

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
        conv.lastMessageId && typeof conv.lastMessageId === 'object'
          ? (conv.lastMessageId as { content?: string; senderId?: string; createdAt?: string })
          : (conv as { lastMessage?: { content?: string; senderId?: string; createdAt?: string } })
              .lastMessage;

      return {
        id: convId,
        recipient,
        lastMessage: lastMsg
          ? {
              content: lastMsg.content || '',
              senderId: typeof lastMsg.senderId === 'string' ? lastMsg.senderId : '',
              createdAt: lastMsg.createdAt || conv.lastMessageAt || '',
            }
          : undefined,
        lastMessageAt: conv.lastMessageAt || conv.updatedAt,
        unreadCount: conv.unreadCount || 0,
        isOnline: recipient.status === 'online',
      };
    });
  }, [rawData, currentUserId]);

  return {
    conversations,
    isLoading,
    isRefetching,
    error: error as Error | null,
    refetch,
  };
}
