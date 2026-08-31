import type {
  UserProfile,
  MessageType,
  MessageAttachment,
  MessageReaction,
} from '@chatlock/shared-types';

export type DeliveryStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface OutboxMessage {
  clientMessageId: string;
  conversationId: string;
  senderId: string;
  sender?: UserProfile;
  content: string;
  type?: MessageType;
  attachments?: MessageAttachment[];
  status: DeliveryStatus;
  deliveredAt?: string | null;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  isRetryable?: boolean;
  retryPayload: {
    conversationId: string;
    content: string;
    clientMessageId: string;
  };
}

export interface LocalMessage {
  id?: string;
  conversationId: string;
  senderId: string | UserProfile;
  clientMessageId: string;
  sender?: UserProfile;
  type?: MessageType;
  content: string;
  attachments?: MessageAttachment[];
  status: DeliveryStatus;
  deliveredAt?: string | null;
  readAt?: string | null;
  reactions?: MessageReaction[];
  replyToMessageId?: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  isEdited?: boolean;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
  retryPayload?: {
    conversationId: string;
    content: string;
    clientMessageId: string;
  };
}

export type ChatListItemType = 'message' | 'date_separator';

export interface ChatMessageItem {
  itemType: 'message';
  id: string;
  message: LocalMessage;
  isOutbound: boolean;
  showAvatar: boolean;
  showTime: boolean;
  isConsecutive: boolean;
}

export interface DateSeparatorItem {
  itemType: 'date_separator';
  id: string;
  label: string;
  timestamp: string | Date;
}

export type ChatFeedItem = ChatMessageItem | DateSeparatorItem;

export interface ConversationItemData {
  id: string;
  recipient: UserProfile;
  lastMessage?: {
    content: string;
    senderId: string;
    createdAt: string;
  };
  lastMessageAt?: string;
  unreadCount: number;
  isOnline?: boolean;
}
