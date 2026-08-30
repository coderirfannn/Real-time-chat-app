import type { ID, Timestamps } from './common.js';
import type { UserProfile } from './user.js';

export type ConversationType = 'direct' | 'group' | 'channel';

export type MessageType = 'text' | 'image' | 'file' | 'audio' | 'video' | 'system';

export type MessageDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface MessageReaction {
  emoji: string;
  userId: ID;
  createdAt: string;
}

export interface MessageAttachment {
  id: ID;
  url: string;
  name: string;
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
  duration?: number;
}

export interface IMessage extends Timestamps {
  id: ID;
  conversationId: ID;
  senderId: ID;
  sender?: UserProfile;
  type: MessageType;
  content: string;
  attachments?: MessageAttachment[];
  status: MessageDeliveryStatus;
  reactions?: MessageReaction[];
  replyToMessageId?: ID;
  isEdited: boolean;
  isDeleted: boolean;
}

export interface IConversation extends Timestamps {
  id: ID;
  type: ConversationType;
  title?: string;
  avatarUrl?: string;
  creatorId: ID;
  participants: ID[];
  lastMessage?: IMessage;
  unreadCount?: number;
  isArchived?: boolean;
}
