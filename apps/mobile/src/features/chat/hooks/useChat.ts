import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { conversationApi } from '../../../services/api/conversation.api';
import { socketManager } from '../../../services/socket/socket.manager';
import { outboxService } from '../../../services/outbox/outbox.service';
import { outboxSyncManager } from '../../../services/outbox/outbox-sync.manager';
import { useSocketStore } from '../../../store/socket.store';
import { useAppStore } from '../../../store/app.store';
import { useAuthStore } from '../../../store/auth.store';
import { buildInvertedChatFeed } from '../../../utils/message-grouper';
import { reconcileChatMessages } from '../../../utils/message-reconciler';
import type { LocalMessage, OutboxMessage, ChatFeedItem } from '../../../types/chat.types';
import type {
  IMessage,
  MessageAckResponse,
  UserProfile,
  IConversation,
} from '@chatlock/shared-types';

export interface UseChatReturn {
  feedItems: ChatFeedItem[];
  recipient: UserProfile;
  isLoading: boolean;
  isSending: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  isRefreshing: boolean;
  error: Error | null;
  sendMessage: (content: string) => Promise<void>;
  retryMessage: (clientMessageId: string) => Promise<void>;
  loadMoreMessages: () => void;
  refetchHistory: () => Promise<unknown>;
  refresh: () => Promise<void>;
}

function generateClientMessageId(): string {
  return 'c_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
}

export function useChat(conversationId: string): UseChatReturn {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id || '';
  const socketConnectionState = useSocketStore((state) => state.connectionState);
  const isNetworkOnline = useAppStore((state) => state.isOnline);

  const [socketMessages, setSocketMessages] = useState<LocalMessage[]>([]);
  const [outboxMessages, setOutboxMessages] = useState<OutboxMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. Fetch conversation details (participants & recipient)
  const { data: convData, isLoading: isLoadingConv } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => conversationApi.getConversationById(conversationId),
    enabled: Boolean(conversationId && currentUserId),
  });

  // 2. Fetch message history with Cursor Pagination (latest 50 first)
  const {
    data: infiniteHistory,
    isLoading: isLoadingHistory,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: historyError,
    refetch: refetchHistory,
  } = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam }) =>
      conversationApi.getMessages(conversationId, {
        cursor: pageParam,
        limit: 50,
        direction: 'before',
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
    enabled: Boolean(conversationId && currentUserId),
    staleTime: 60 * 1000,
  });

  // 3. Outbox subscription: load and listen to persistent outbox queue for this conversation
  useEffect(() => {
    if (!conversationId) return;

    const unsubOutbox = outboxService.subscribe((allOutbox) => {
      const convOutbox = allOutbox.filter((m) => m.conversationId === conversationId);
      setOutboxMessages(convOutbox);
    });

    return () => {
      unsubOutbox();
    };
  }, [conversationId]);

  // Extract recipient info
  const recipient: UserProfile = useMemo(() => {
    if (!convData) {
      return { id: 'peer', username: 'Chat', displayName: 'Conversation', status: 'offline' };
    }

    const rawConv =
      (convData as { conversation?: { participants?: Array<UserProfile | string> } })
        .conversation || convData;
    const participants = (rawConv as { participants?: Array<UserProfile | string> }).participants;

    if (Array.isArray(participants)) {
      const peer = participants.find((p) => {
        if (typeof p === 'string') return p !== currentUserId;
        return p.id !== currentUserId && (p as { _id?: string })._id !== currentUserId;
      });

      if (peer && typeof peer === 'object') {
        return peer;
      }
    }

    return { id: 'peer', username: 'Chat', displayName: 'Conversation', status: 'offline' };
  }, [convData, currentUserId]);

  // 4. Socket Room Lifecycle: Join on mount, leave on unmount
  useEffect(() => {
    if (!conversationId) return;

    socketManager.joinConversation(conversationId).catch(() => {});

    return () => {
      socketManager.leaveConversation(conversationId).catch(() => {});
    };
  }, [conversationId]);

  // 5. Reconnection Gap Synchronization: automatically refetch history and drain outbox on connect
  useEffect(() => {
    if (socketConnectionState === 'connected' && conversationId) {
      refetchHistory().catch(() => {});
      outboxSyncManager.processQueue().catch(() => {});
    }
  }, [socketConnectionState, conversationId, refetchHistory]);

  // 6. Socket Listeners: onNewMessage & onMessageSent with cache reconciliation
  useEffect(() => {
    const unsubNew = socketManager.onNewMessage((newMsg: IMessage) => {
      if (newMsg.conversationId !== conversationId) return;

      const formattedMsg: LocalMessage = {
        ...newMsg,
        clientMessageId: newMsg.clientMessageId || `srv_${newMsg.id}`,
        status: 'delivered',
      };

      setSocketMessages((prev) => {
        const exists = prev.some(
          (m) =>
            (newMsg.id && m.id === newMsg.id) ||
            (newMsg.clientMessageId && m.clientMessageId === newMsg.clientMessageId),
        );
        if (exists) {
          return prev.map((m) => {
            if (
              (newMsg.id && m.id === newMsg.id) ||
              (newMsg.clientMessageId && m.clientMessageId === newMsg.clientMessageId)
            ) {
              return { ...m, ...formattedMsg };
            }
            return m;
          });
        }
        return [...prev, formattedMsg];
      });

      // Update global conversations query cache
      queryClient.setQueryData<IConversation[]>(['conversations'], (oldConvs) => {
        if (!oldConvs) return oldConvs;
        return oldConvs.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              lastMessage: newMsg,
              lastMessageAt: newMsg.createdAt,
            };
          }
          return c;
        });
      });
    });

    const unsubSent = socketManager.onMessageSent((ack: MessageAckResponse) => {
      if (!ack.clientMessageId) return;

      // Dequeue from outbox service upon server ACK
      outboxService.dequeue(ack.clientMessageId).catch(() => {});
    });

    return () => {
      unsubNew();
      unsubSent();
    };
  }, [conversationId, queryClient]);

  // 7. Send message with offline-first durable outbox queue
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !conversationId) return;

      const clientMessageId = generateClientMessageId();
      const isConnected = socketManager.isConnected() && isNetworkOnline;

      const outboxItem: OutboxMessage = {
        conversationId,
        senderId: currentUserId,
        sender: currentUser ?? undefined,
        clientMessageId,
        type: 'text',
        content: content.trim(),
        status: isConnected ? 'sending' : 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attempts: 0,
        retryPayload: {
          conversationId,
          content: content.trim(),
          clientMessageId,
        },
      };

      // 1. Save to durable persistent storage immediately
      await outboxService.enqueue(outboxItem);

      // 2. If online and socket connected, attempt immediate delivery
      if (isConnected) {
        setIsSending(true);
        try {
          await outboxSyncManager.sendMessageWithBackoff(outboxItem);
        } finally {
          setIsSending(false);
        }
      }
    },
    [conversationId, currentUser, currentUserId, isNetworkOnline],
  );

  // 8. Retry failed or pending message
  const retryMessage = useCallback(async (clientMessageId: string) => {
    await outboxSyncManager.retryMessage(clientMessageId);
  }, []);

  // 9. Load older messages (upward pagination)
  const loadMoreMessages = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 10. Pull-to-refresh / full synchronization
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetchHistory();
      if (socketManager.isConnected()) {
        await outboxSyncManager.processQueue();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchHistory]);

  // 11. Reconcile history pages with socket and outbox messages
  const allMessages: LocalMessage[] = useMemo(() => {
    return reconcileChatMessages({
      historyPages: infiniteHistory?.pages,
      socketMessages,
      outboxMessages,
    });
  }, [infiniteHistory?.pages, socketMessages, outboxMessages]);

  // 12. Build inverted feed items
  const feedItems = useMemo(
    () => buildInvertedChatFeed(allMessages, currentUserId),
    [allMessages, currentUserId],
  );

  return {
    feedItems,
    recipient,
    isLoading: isLoadingConv || isLoadingHistory,
    isSending,
    isFetchingNextPage: Boolean(isFetchingNextPage),
    hasNextPage: Boolean(hasNextPage),
    isRefreshing,
    error: (historyError as Error) || null,
    sendMessage,
    retryMessage,
    loadMoreMessages,
    refetchHistory,
    refresh,
  };
}
