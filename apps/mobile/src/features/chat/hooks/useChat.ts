import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { conversationApi } from '../../../services/api/conversation.api';
import { socketManager } from '../../../services/socket/socket.manager';
import { outboxService } from '../../../services/outbox/outbox.service';
import { outboxSyncManager } from '../../../services/outbox/outbox-sync.manager';
import { useSocketStore } from '../../../store/socket.store';
import { useAppStore } from '../../../store/app.store';
import { useAuthStore } from '../../../store/auth.store';
import { useNotificationStore } from '../../../store/notification.store';
import { buildInvertedChatFeed } from '../../../utils/message-grouper';
import { reconcileChatMessages, resolveHighestStatus } from '../../../utils/message-reconciler';
import { CONVERSATIONS_QUERY_KEY } from './useConversations';
import type { LocalMessage, OutboxMessage, ChatFeedItem } from '../../../types/chat.types';
import type {
  IMessage,
  MessageAckResponse,
  UserProfile,
  PresenceUpdatePayload,
  MessageAttachment,
  MessageType,
  MessageReaction,
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
  sendMessage: (
    content: string,
    attachments?: MessageAttachment[],
    replyToMessageId?: string,
  ) => Promise<void>;
  retryMessage: (clientMessageId: string) => Promise<void>;
  startTyping: () => void;
  stopTyping: () => void;
  loadMoreMessages: () => void;
  refetchHistory: () => Promise<unknown>;
  refresh: () => Promise<void>;
  replyingTo: LocalMessage | null;
  setReplyingTo: (message: LocalMessage | null) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  parentMessagesMap: Record<string, LocalMessage>;
  currentUserId: string;
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
  const [replyingTo, setReplyingTo] = useState<LocalMessage | null>(null);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allMessagesRef = useRef<LocalMessage[]>([]);

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

  // 4. Socket Room Lifecycle: Join on mount, leave on unmount & track active conversation
  useEffect(() => {
    if (!conversationId) return;

    socketManager.joinConversation(conversationId).catch(() => {});
    useNotificationStore.getState().setActiveConversationId(conversationId);

    // Mark conversation as read both via REST API and Socket.IO
    conversationApi.markAsRead(conversationId).catch(() => {});
    socketManager.sendReadReceipt(conversationId);

    // Instantly zero out unread counter for this conversation in query cache
    queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, (oldData: unknown) => {
      if (!oldData) return oldData;
      const list = Array.isArray(oldData)
        ? oldData
        : (oldData as { docs?: Record<string, unknown>[] }).docs || [];

      const updated = list.map((item) => {
        const itemId = item['id'] || item['_id'];
        if (itemId === conversationId) {
          return { ...item, unreadCount: 0 };
        }
        return item;
      });

      return Array.isArray(oldData) ? updated : { ...(oldData as object), docs: updated };
    });

    return () => {
      socketManager.leaveConversation(conversationId).catch(() => {});
      useNotificationStore.getState().setActiveConversationId(null);

      // Ensure unread count remains 0 upon leaving the read conversation
      queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, (oldData: unknown) => {
        if (!oldData) return oldData;
        const list = Array.isArray(oldData)
          ? oldData
          : (oldData as { docs?: Record<string, unknown>[] }).docs || [];

        const updated = list.map((item) => {
          const itemId = item['id'] || item['_id'];
          if (itemId === conversationId) {
            return { ...item, unreadCount: 0 };
          }
          return item;
        });

        return Array.isArray(oldData) ? updated : { ...(oldData as object), docs: updated };
      });
    };
  }, [conversationId, queryClient]);

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

      const senderIdStr =
        typeof newMsg.senderId === 'string'
          ? newMsg.senderId
          : (newMsg.senderId as { id?: string; _id?: string })?.id ||
            (newMsg.senderId as { id?: string; _id?: string })?._id ||
            String(newMsg.senderId || '');

      const isIncoming = Boolean(currentUserId && senderIdStr && senderIdStr !== currentUserId);
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
      queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, (oldData: unknown) => {
        if (!oldData) return oldData;
        const list = Array.isArray(oldData)
          ? oldData
          : (oldData as { docs?: Record<string, unknown>[] }).docs || [];

        const updated = list.map((c) => {
          const cId = c['id'] || c['_id'];
          if (cId === conversationId) {
            return {
              ...c,
              lastMessage: newMsg,
              lastMessageId: newMsg,
              lastMessageAt: newMsg.createdAt,
              unreadCount: 0,
            };
          }
          return c;
        });

        return Array.isArray(oldData) ? updated : { ...(oldData as object), docs: updated };
      });
    });

    const unsubSent = socketManager.onMessageSent((ack: MessageAckResponse) => {
      if (!ack.clientMessageId) return;

      // Immediately upgrade optimistic message status in feed upon server ACK
      setSocketMessages((prev) =>
        prev.map((msg) => {
          if (msg.clientMessageId === ack.clientMessageId) {
            return {
              ...msg,
              id: ack.serverMessageId || msg.id,
              status: resolveHighestStatus(msg.status, ack.success ? 'sent' : 'failed'),
            };
          }
          return msg;
        }),
      );

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

    const unsubReaction = socketManager.onMessageReaction((payload) => {
      if (payload.conversationId !== conversationId) return;

      setSocketMessages((prev) => {
        const match = prev.find((m) => m.id === payload.messageId);
        if (match) {
          return prev.map((m) =>
            m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m,
          );
        } else {
          const historyMsg = allMessagesRef.current.find((m) => m.id === payload.messageId);
          if (historyMsg) {
            return [...prev, { ...historyMsg, reactions: payload.reactions }];
          }
          return prev;
        }
      });
    });

    return () => {
      unsubNew();
      unsubSent();
      unsubDelivered();
      unsubRead();
      unsubReaction();
    };
  }, [conversationId, queryClient, currentUserId]);

  // 9. Send message with offline-first durable outbox queue
  const sendMessage = useCallback(
    async (content: string, attachments?: MessageAttachment[], replyToMessageId?: string) => {
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

      const targetReplyId = replyToMessageId || replyingTo?.id;

      const outboxItem: OutboxMessage = {
        conversationId,
        senderId: currentUserId,
        sender: currentUser ?? undefined,
        clientMessageId,
        type: msgType,
        content: content.trim(),
        attachments: hasAttachments ? attachments : undefined,
        replyToMessageId: targetReplyId,
        status: isConnected ? 'sending' : 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attempts: 0,
        retryPayload: {
          conversationId,
          content: content.trim(),
          clientMessageId,
          replyToMessageId: targetReplyId,
        },
      };

      const nowIso = new Date().toISOString();
      const optimisticMsg: LocalMessage = {
        id: clientMessageId,
        clientMessageId,
        conversationId,
        senderId: currentUserId,
        sender: currentUser ?? undefined,
        content: content.trim(),
        type: msgType,
        attachments: hasAttachments ? attachments : undefined,
        replyToMessageId: targetReplyId,
        status: isConnected ? 'sending' : 'pending',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // 1. INSTANT OPTIMISTIC FEED INJECTION (0ms latency - appears immediately in chat feed!)
      setSocketMessages((prev) => {
        const exists = prev.some((m) => m.clientMessageId === clientMessageId);
        if (exists) return prev;
        return [...prev, optimisticMsg];
      });

      // 2. Immediately update conversation snippet in conversations list cache
      queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, (oldData: unknown) => {
        if (!oldData) return oldData;
        const list = Array.isArray(oldData)
          ? oldData
          : (oldData as { docs?: Record<string, unknown>[] }).docs || [];

        const updated = list.map((c) => {
          const cId = c['id'] || c['_id'];
          if (cId === conversationId) {
            return {
              ...c,
              lastMessage: optimisticMsg,
              lastMessageId: optimisticMsg,
              lastMessageAt: nowIso,
              unreadCount: 0,
            };
          }
          return c;
        });

        return Array.isArray(oldData) ? updated : { ...(oldData as object), docs: updated };
      });

      setReplyingTo(null);

      // 3. Persist to outbox queue and dispatch over WebSocket in background without blocking UI
      outboxService
        .enqueue(outboxItem)
        .then(() => {
          if (isConnected) {
            setIsSending(true);
            outboxSyncManager
              .sendMessageWithBackoff(outboxItem)
              .finally(() => setIsSending(false));
          }
        })
        .catch(() => {
          if (isConnected) {
            setIsSending(true);
            outboxSyncManager
              .sendMessageWithBackoff(outboxItem)
              .finally(() => setIsSending(false));
          }
        });
    },
    [conversationId, currentUser, currentUserId, isNetworkOnline, replyingTo, queryClient],
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

  allMessagesRef.current = allMessages;

  // 14. Build inverted feed items
  const feedItems = useMemo(
    () => buildInvertedChatFeed(allMessages, currentUserId),
    [allMessages, currentUserId],
  );

  // 15. Map of message ID to message for O(1) reply previews
  const parentMessagesMap = useMemo(() => {
    const map: Record<string, LocalMessage> = {};
    for (const msg of allMessages) {
      if (msg.id) {
        map[msg.id] = msg;
      }
    }
    return map;
  }, [allMessages]);

  // 16. Optimistic Reaction toggle
  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!currentUserId || !messageId) return;

      setSocketMessages((prev) => {
        const found = prev.find((m) => m.id === messageId);
        if (found) {
          const currentReactions = found.reactions || [];
          const idx = currentReactions.findIndex(
            (r) => r.userId === currentUserId && r.emoji === emoji,
          );
          let nextReactions: MessageReaction[];
          if (idx >= 0) {
            nextReactions = currentReactions.filter((_, i) => i !== idx);
          } else {
            nextReactions = [
              ...currentReactions,
              { emoji, userId: currentUserId, createdAt: new Date().toISOString() },
            ];
          }
          return prev.map((m) => (m.id === messageId ? { ...m, reactions: nextReactions } : m));
        } else {
          const historyMsg = allMessagesRef.current.find((m) => m.id === messageId);
          if (historyMsg) {
            const currentReactions = historyMsg.reactions || [];
            const idx = currentReactions.findIndex(
              (r) => r.userId === currentUserId && r.emoji === emoji,
            );
            let nextReactions: MessageReaction[];
            if (idx >= 0) {
              nextReactions = currentReactions.filter((_, i) => i !== idx);
            } else {
              nextReactions = [
                ...currentReactions,
                { emoji, userId: currentUserId, createdAt: new Date().toISOString() },
              ];
            }
            return [...prev, { ...historyMsg, reactions: nextReactions }];
          }
          return prev;
        }
      });

      // Emit real-time reaction to server & peer
      if (conversationId) {
        socketManager.sendReaction(conversationId, messageId, emoji).catch((err) => {
          console.warn('[useChat] Failed to dispatch reaction:', err);
        });
      }
    },
    [currentUserId, conversationId],
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
    replyingTo,
    setReplyingTo,
    toggleReaction,
    parentMessagesMap,
    currentUserId,
  };
}
