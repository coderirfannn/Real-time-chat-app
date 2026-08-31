import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  PresenceUpdatePayload,
  MessageAttachment,
  MessageType,
} from '@chatlock/shared-types';

export interface UseChatReturn {
  feedItems: ChatFeedItem[];
  recipient: UserProfile;
  isLoading: boolean;
  isSending: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  isRefreshing: boolean;
  isPeerTyping: boolean;
  error: Error | null;
  sendMessage: (content: string, attachments?: MessageAttachment[]) => Promise<void>;
  retryMessage: (clientMessageId: string) => Promise<void>;
  startTyping: () => void;
  stopTyping: () => void;
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
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [peerPresence, setPeerPresence] = useState<{ status?: string; lastSeenAt?: string }>({});

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Extract recipient info and merge with live presence
  const recipient: UserProfile = useMemo(() => {
    let basePeer: UserProfile = {
      id: 'peer',
      username: 'Chat',
      displayName: 'Conversation',
      status: 'offline',
    };

    if (convData) {
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
          basePeer = peer;
        }
      }
    }

    return {
      ...basePeer,
      status: (peerPresence.status as UserProfile['status']) || basePeer.status || 'offline',
      lastSeenAt: peerPresence.lastSeenAt || basePeer.lastSeenAt,
    };
  }, [convData, currentUserId, peerPresence]);

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

  // 6. Periodic Heartbeat Loop (refreshes Redis presence TTL every 25 seconds)
  useEffect(() => {
    if (socketConnectionState !== 'connected') return;

    const interval = setInterval(() => {
      socketManager.sendHeartbeat().catch(() => {});
    }, 25000);

    return () => {
      clearInterval(interval);
    };
  }, [socketConnectionState]);

  // 7. Presence and Typing Listeners
  useEffect(() => {
    if (!conversationId) return;

    const unsubTypingStart = socketManager.onTypingStart((payload) => {
      if (payload.conversationId === conversationId && payload.userId !== currentUserId) {
        setIsPeerTyping(true);

        // Auto-expire stale typing indicator after 4 seconds
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setIsPeerTyping(false);
        }, 4000);
      }
    });

    const unsubTypingStop = socketManager.onTypingStop((payload) => {
      if (payload.conversationId === conversationId && payload.userId !== currentUserId) {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        setIsPeerTyping(false);
      }
    });

    const unsubPresence = socketManager.onPresenceUpdate((payload: PresenceUpdatePayload) => {
      if (payload.userId === recipient.id) {
        setPeerPresence({
          status: payload.status,
          lastSeenAt: payload.lastSeenAt,
        });
      }
    });

    return () => {
      unsubTypingStart();
      unsubTypingStop();
      unsubPresence();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, currentUserId, recipient.id]);

  // 8. Auto-mark conversation as read on initial history load or room focus
  useEffect(() => {
    if (!conversationId || socketConnectionState !== 'connected') return;

    // Send read receipt for all unread incoming messages in this conversation
    socketManager.sendReadReceipt(conversationId);
  }, [conversationId, socketConnectionState, infiniteHistory?.pages]);

  // 9. Socket Listeners: onNewMessage, onMessageSent, onMessageDelivered, onMessageRead
  useEffect(() => {
    const unsubNew = socketManager.onNewMessage((newMsg: IMessage) => {
      if (newMsg.conversationId !== conversationId) return;

      const isIncoming = newMsg.senderId !== currentUserId;
      const formattedMsg: LocalMessage = {
        ...newMsg,
        clientMessageId: newMsg.clientMessageId || `srv_${newMsg.id}`,
        status: isIncoming ? 'read' : (newMsg.status as LocalMessage['status']) || 'delivered',
      };

      // Automatically dispatch delivery & read receipts for incoming messages
      if (isIncoming && newMsg.id) {
        socketManager.sendDeliveryReceipt(conversationId, newMsg.id);
        socketManager.sendReadReceipt(conversationId, newMsg.id);
      }

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

      // Clear typing indicator when message arrives from peer
      if (isIncoming) {
        setIsPeerTyping(false);
      }

      // Update global conversations query cache
      queryClient.setQueryData(['conversations'], (oldData: unknown) => {
        if (!oldData) return oldData;
        const list = Array.isArray(oldData)
          ? oldData
          : (oldData as { docs?: IConversation[] }).docs || [];

        const updated = list.map((c: IConversation) => {
          if (c.id === conversationId) {
            return {
              ...c,
              lastMessage: newMsg,
              lastMessageAt: newMsg.createdAt,
            };
          }
          return c;
        });

        return Array.isArray(oldData) ? updated : { ...(oldData as object), docs: updated };
      });
    });

    const unsubSent = socketManager.onMessageSent((ack: MessageAckResponse) => {
      if (!ack.clientMessageId) return;

      // Dequeue from outbox service upon server ACK
      outboxService.dequeue(ack.clientMessageId).catch(() => {});
    });

    const unsubDelivered = socketManager.onMessageDelivered((payload) => {
      if (payload.conversationId !== conversationId) return;

      setSocketMessages((prev) =>
        prev.map((msg) => {
          const match =
            (payload.messageId && msg.id === payload.messageId) ||
            (payload.messageIds && msg.id && payload.messageIds.includes(msg.id));

          if (match && msg.status !== 'read') {
            return {
              ...msg,
              status: 'delivered',
              deliveredAt: payload.deliveredAt || msg.deliveredAt,
            };
          }
          return msg;
        }),
      );
    });

    const unsubRead = socketManager.onMessageRead((payload) => {
      if (payload.conversationId !== conversationId) return;

      setSocketMessages((prev) =>
        prev.map((msg) => {
          const match =
            !payload.messageId && !payload.messageIds
              ? true // Entire conversation marked read
              : (payload.messageId && msg.id === payload.messageId) ||
                (payload.messageIds && msg.id && payload.messageIds.includes(msg.id));

          if (match) {
            return {
              ...msg,
              status: 'read',
              readAt: payload.readAt || msg.readAt,
            };
          }
          return msg;
        }),
      );
    });

    return () => {
      unsubNew();
      unsubSent();
      unsubDelivered();
      unsubRead();
    };
  }, [conversationId, queryClient, currentUserId]);

  // 9. Send message with offline-first durable outbox queue
  const sendMessage = useCallback(
    async (content: string, attachments?: MessageAttachment[]) => {
      const hasContent = content.trim().length > 0;
      const hasAttachments = Boolean(attachments && attachments.length > 0);

      if ((!hasContent && !hasAttachments) || !conversationId) return;

      // Stop typing immediately upon send
      socketManager.stopTyping(conversationId);

      const clientMessageId = generateClientMessageId();
      const isConnected = socketManager.isConnected() && isNetworkOnline;

      let msgType: MessageType = 'text';
      if (attachments && attachments.length > 0) {
        const first = attachments[0];
        if (first?.mimeType.startsWith('image/')) msgType = 'image';
        else if (first?.mimeType.startsWith('video/')) msgType = 'video';
        else if (first?.mimeType.startsWith('audio/')) msgType = 'audio';
        else msgType = 'file';
      }

      const outboxItem: OutboxMessage = {
        conversationId,
        senderId: currentUserId,
        sender: currentUser ?? undefined,
        clientMessageId,
        type: msgType,
        content: content.trim(),
        attachments: hasAttachments ? attachments : undefined,
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

  const startTyping = useCallback(() => {
    if (conversationId && socketManager.isConnected()) {
      socketManager.startTyping(conversationId);
    }
  }, [conversationId]);

  const stopTyping = useCallback(() => {
    if (conversationId && socketManager.isConnected()) {
      socketManager.stopTyping(conversationId);
    }
  }, [conversationId]);

  // 10. Retry failed or pending message
  const retryMessage = useCallback(async (clientMessageId: string) => {
    await outboxSyncManager.retryMessage(clientMessageId);
  }, []);

  // 11. Load older messages (upward pagination)
  const loadMoreMessages = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 12. Pull-to-refresh / full synchronization
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

  // 13. Reconcile history pages with socket and outbox messages
  const allMessages: LocalMessage[] = useMemo(() => {
    return reconcileChatMessages({
      historyPages: infiniteHistory?.pages,
      socketMessages,
      outboxMessages,
    });
  }, [infiniteHistory?.pages, socketMessages, outboxMessages]);

  // 14. Build inverted feed items
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
    isPeerTyping,
    error: (historyError as Error) || null,
    sendMessage,
    retryMessage,
    startTyping,
    stopTyping,
    loadMoreMessages,
    refetchHistory,
    refresh,
  };
}
