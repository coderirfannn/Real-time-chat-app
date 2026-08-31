import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { conversationApi } from '../../../services/api/conversation.api';
import { socketManager } from '../../../services/socket/socket.manager';
import { useAuthStore } from '../../../store/auth.store';
import { buildInvertedChatFeed } from '../../../utils/message-grouper';
import { reconcileChatMessages } from '../../../utils/message-reconciler';
import type { LocalMessage, ChatFeedItem } from '../../../types/chat.types';
import type { IMessage, MessageAckResponse, UserProfile } from '@chatlock/shared-types';

export interface UseChatReturn {
  feedItems: ChatFeedItem[];
  recipient: UserProfile;
  isLoading: boolean;
  isSending: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  error: Error | null;
  sendMessage: (content: string) => Promise<void>;
  retryMessage: (clientMessageId: string) => Promise<void>;
  loadMoreMessages: () => void;
  refetchHistory: () => Promise<unknown>;
}

function generateClientMessageId(): string {
  return 'c_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
}

export function useChat(conversationId: string): UseChatReturn {
  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id || '';

  const [socketMessages, setSocketMessages] = useState<LocalMessage[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<LocalMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  // 1. Fetch conversation details (participants & recipient)
  const { data: convData, isLoading: isLoadingConv } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => conversationApi.getConversationById(conversationId),
    enabled: Boolean(conversationId && currentUserId),
  });

  // 2. Fetch message history with Cursor Pagination
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

  // 3. Socket Room Lifecycle: Join on mount, leave on unmount
  useEffect(() => {
    if (!conversationId) return;

    socketManager.joinConversation(conversationId).catch(() => {});

    return () => {
      socketManager.leaveConversation(conversationId).catch(() => {});
    };
  }, [conversationId]);

  // 4. Socket Listeners: onNewMessage & onMessageSent with safe reconciliation
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
    });

    const unsubSent = socketManager.onMessageSent((ack: MessageAckResponse) => {
      if (!ack.clientMessageId) return;

      setOptimisticMessages((prev) =>
        prev.map((m) => {
          if (m.clientMessageId === ack.clientMessageId) {
            return {
              ...m,
              id: ack.serverMessageId || m.id,
              status: ack.success ? ('sent' as const) : ('failed' as const),
            };
          }
          return m;
        }),
      );
    });

    return () => {
      unsubNew();
      unsubSent();
    };
  }, [conversationId]);

  // 5. Send message with optimistic local state
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !conversationId) return;

      const clientMessageId = generateClientMessageId();
      const optimisticMessage: LocalMessage = {
        conversationId,
        senderId: currentUserId,
        sender: currentUser ?? undefined,
        clientMessageId,
        type: 'text',
        content: content.trim(),
        status: 'sending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        retryPayload: {
          conversationId,
          content: content.trim(),
          clientMessageId,
        },
      };

      setOptimisticMessages((prev) => [...prev, optimisticMessage]);
      setIsSending(true);

      try {
        const ack = await socketManager.sendMessage({
          conversationId,
          clientMessageId,
          content: content.trim(),
          type: 'text',
        });

        setOptimisticMessages((prev) =>
          prev.map((m) => {
            if (m.clientMessageId === clientMessageId) {
              return {
                ...m,
                id: ack.serverMessageId || m.id,
                status: ack.success ? 'sent' : 'failed',
              };
            }
            return m;
          }),
        );
      } catch {
        setOptimisticMessages((prev) =>
          prev.map((m) => {
            if (m.clientMessageId === clientMessageId) {
              return { ...m, status: 'failed' };
            }
            return m;
          }),
        );
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, currentUser, currentUserId],
  );

  // 6. Retry failed message
  const retryMessage = useCallback(
    async (clientMessageId: string) => {
      const target = optimisticMessages.find((m) => m.clientMessageId === clientMessageId);
      if (!target || !target.retryPayload) return;

      setOptimisticMessages((prev) =>
        prev.map((m) => (m.clientMessageId === clientMessageId ? { ...m, status: 'sending' } : m)),
      );

      try {
        const ack = await socketManager.sendMessage({
          conversationId: target.retryPayload.conversationId,
          clientMessageId: target.retryPayload.clientMessageId,
          content: target.retryPayload.content,
          type: 'text',
        });

        setOptimisticMessages((prev) =>
          prev.map((m) => {
            if (m.clientMessageId === clientMessageId) {
              return {
                ...m,
                id: ack.serverMessageId || m.id,
                status: ack.success ? 'sent' : 'failed',
              };
            }
            return m;
          }),
        );
      } catch {
        setOptimisticMessages((prev) =>
          prev.map((m) => (m.clientMessageId === clientMessageId ? { ...m, status: 'failed' } : m)),
        );
      }
    },
    [optimisticMessages],
  );

  // 7. Load older messages (upward pagination)
  const loadMoreMessages = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 8. Reconcile history pages with socket and optimistic messages
  const allMessages: LocalMessage[] = useMemo(() => {
    return reconcileChatMessages({
      historyPages: infiniteHistory?.pages,
      socketMessages,
      optimisticMessages,
    });
  }, [infiniteHistory?.pages, socketMessages, optimisticMessages]);

  // 9. Build inverted feed items
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
    error: (historyError as Error) || null,
    sendMessage,
    retryMessage,
    loadMoreMessages,
    refetchHistory,
  };
}
