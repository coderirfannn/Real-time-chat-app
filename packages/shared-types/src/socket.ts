import type { ID } from './common.js';
import type { IMessage, MessageType, MessageAttachment } from './chat.js';
import type { UserStatus } from './user.js';
import type { ReceiptStatus } from './receipt.js';

export enum SocketEvents {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  AUTHENTICATE = 'authenticate',
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  MESSAGE_SEND = 'message:send',
  MESSAGE_SENT = 'message:sent',
  MESSAGE_NEW = 'message:new',
  MESSAGE_DELIVERED = 'message:delivered',
  MESSAGE_READ = 'message:read',
  SEND_MESSAGE = 'send_message',
  RECEIVE_MESSAGE = 'receive_message',
  MESSAGE_DELIVERED_LEGACY = 'message_delivered',
  MESSAGE_READ_LEGACY = 'message_read',
  TYPING_START = 'typing:start',
  TYPING_STOP = 'typing:stop',
  TYPING_START_LEGACY = 'typing_start',
  TYPING_STOP_LEGACY = 'typing_stop',
  PRESENCE_HEARTBEAT = 'presence:heartbeat',
  PRESENCE_UPDATE = 'presence:update',
  USER_PRESENCE = 'user:presence',
  USER_STATUS_CHANGE = 'user_status_change',
  ERROR = 'error',
}

export interface SocketUserContext {
  id: ID;
  email: string;
  username: string;
  deviceId?: string;
}

export interface SendMessagePayload {
  conversationId: ID;
  clientMessageId: string;
  content: string;
  type?: MessageType;
  attachments?: MessageAttachment[];
  replyToMessageId?: ID;
  tempId?: string;
}

export interface MessageAckResponse {
  success: boolean;
  clientMessageId: string;
  serverMessageId?: ID;
  message?: IMessage;
  errorCode?: string;
  error?: string;
}

export interface TypingPayload {
  conversationId: ID;
  userId?: ID;
}

export interface PresenceUpdatePayload {
  userId: ID;
  status: UserStatus;
  lastSeenAt?: string;
}

export interface MessageDeliveredPayload {
  conversationId: ID;
  messageId?: ID;
  messageIds?: ID[];
  deliveredAt?: string;
}

export interface MessageReadPayload {
  conversationId: ID;
  messageId?: ID;
  messageIds?: ID[];
  readAt?: string;
}

export interface ReceiptUpdatePayload {
  conversationId: ID;
  messageId?: ID;
  messageIds?: ID[];
  userId: ID;
  status: ReceiptStatus;
  deliveredAt?: string;
  readAt?: string;
  timestamp: string;
}

export interface ClientToServerEvents {
  [SocketEvents.AUTHENTICATE]: (
    token: string,
    callback: (res: { success: boolean; error?: string }) => void,
  ) => void;
  [SocketEvents.JOIN_ROOM]: (
    payload: { conversationId: ID } | string,
    callback?: (res: { success: boolean; room?: string; error?: string }) => void,
  ) => void;
  [SocketEvents.LEAVE_ROOM]: (
    payload: { conversationId: ID } | string,
    callback?: (res: { success: boolean; room?: string; error?: string }) => void,
  ) => void;
  [SocketEvents.MESSAGE_SEND]: (
    payload: SendMessagePayload,
    callback?: (res: MessageAckResponse) => void,
  ) => void;
  [SocketEvents.SEND_MESSAGE]: (
    payload: SendMessagePayload | { conversationId: ID; content: string; tempId?: string },
    callback?: (
      res: MessageAckResponse | { success: boolean; messageId?: ID; error?: string },
    ) => void,
  ) => void;
  [SocketEvents.MESSAGE_DELIVERED]: (
    payload: MessageDeliveredPayload,
    callback?: (res: { success: boolean; error?: string }) => void,
  ) => void;
  [SocketEvents.MESSAGE_READ]: (
    payload: MessageReadPayload,
    callback?: (res: { success: boolean; error?: string }) => void,
  ) => void;
  [SocketEvents.MESSAGE_DELIVERED_LEGACY]: (
    payload: MessageDeliveredPayload,
    callback?: (res: { success: boolean; error?: string }) => void,
  ) => void;
  [SocketEvents.MESSAGE_READ_LEGACY]: (
    payload: MessageReadPayload,
    callback?: (res: { success: boolean; error?: string }) => void,
  ) => void;
  [SocketEvents.TYPING_START]: (payload: { conversationId: ID }) => void;
  [SocketEvents.TYPING_STOP]: (payload: { conversationId: ID }) => void;
  [SocketEvents.TYPING_START_LEGACY]: (payload: { conversationId: ID }) => void;
  [SocketEvents.TYPING_STOP_LEGACY]: (payload: { conversationId: ID }) => void;
  [SocketEvents.PRESENCE_HEARTBEAT]: (callback?: (res: { success: boolean }) => void) => void;
}

export interface ServerToClientEvents {
  [SocketEvents.MESSAGE_NEW]: (message: IMessage) => void;
  [SocketEvents.MESSAGE_SENT]: (ack: MessageAckResponse) => void;
  [SocketEvents.RECEIVE_MESSAGE]: (message: IMessage) => void;
  [SocketEvents.MESSAGE_DELIVERED]: (payload: ReceiptUpdatePayload) => void;
  [SocketEvents.MESSAGE_READ]: (payload: ReceiptUpdatePayload) => void;
  [SocketEvents.MESSAGE_DELIVERED_LEGACY]: (payload: ReceiptUpdatePayload) => void;
  [SocketEvents.MESSAGE_READ_LEGACY]: (payload: ReceiptUpdatePayload) => void;
  [SocketEvents.TYPING_START]: (payload: { conversationId: ID; userId: ID }) => void;
  [SocketEvents.TYPING_STOP]: (payload: { conversationId: ID; userId: ID }) => void;
  [SocketEvents.TYPING_START_LEGACY]: (payload: { conversationId: ID; userId: ID }) => void;
  [SocketEvents.TYPING_STOP_LEGACY]: (payload: { conversationId: ID; userId: ID }) => void;
  [SocketEvents.USER_PRESENCE]: (payload: PresenceUpdatePayload) => void;
  [SocketEvents.PRESENCE_UPDATE]: (payload: PresenceUpdatePayload) => void;
  [SocketEvents.USER_STATUS_CHANGE]: (payload: {
    userId: ID;
    status: UserStatus;
    lastSeenAt?: string;
  }) => void;
  [SocketEvents.ERROR]: (error: { code: string; message: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  user: SocketUserContext;
  authenticatedAt: number;
}
