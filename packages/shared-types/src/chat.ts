import type { ID, Timestamps } from './common.js';
import type { UserProfile } from './user.js';

export type ConversationType = 'direct' | 'group' | 'channel';

export type MessageType = 'text' | 'image' | 'file' | 'audio' | 'video' | 'system';

export type MessageDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export type AttachmentUploadStatus = 'uploading' | 'uploaded' | 'failed';

export interface MessageReaction {
  emoji: string;
  userId: ID;
  createdAt: string;
}

export interface MessageAttachment {
  id: ID;
  url: string;
  key?: string;
  name: string;
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  uploadStatus?: AttachmentUploadStatus;
}

export interface IMessage extends Timestamps {
  id: ID;
  conversationId: ID;
  senderId: ID;
  clientMessageId: string;
  sender?: UserProfile;
  type: MessageType;
  content: string;
  attachments?: MessageAttachment[];
  status: MessageDeliveryStatus;
  deliveredAt?: string | null;
  readAt?: string | null;
  reactions?: MessageReaction[];
  replyToMessageId?: ID;
  editedAt?: string | null;
  deletedAt?: string | null;
  isEdited: boolean;
  isDeleted: boolean;
}

export interface IConversation extends Timestamps {
  id: ID;
  type: ConversationType;
  title?: string;
  avatarUrl?: string;
  creatorId?: ID;
  participants: ID[];
  admins?: ID[];
  lastMessageId?: ID;
  lastMessage?: IMessage;
  lastMessageAt?: string;
  unreadCount?: number;
  isArchived?: boolean;
  directKey?: string;
}
