import type { ID } from './common.js';
import type { IMessage, MessageDeliveryStatus } from './chat.js';
import type { UserStatus } from './user.js';

export enum SocketEvents {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  AUTHENTICATE = 'authenticate',
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  SEND_MESSAGE = 'send_message',
  RECEIVE_MESSAGE = 'receive_message',
  MESSAGE_DELIVERED = 'message_delivered',
  MESSAGE_READ = 'message_read',
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',
  USER_STATUS_CHANGE = 'user_status_change',
  ERROR = 'error',
}

export interface SocketUserContext {
  id: ID;
  email: string;
  username: string;
  deviceId?: string;
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
  [SocketEvents.SEND_MESSAGE]: (
    payload: { conversationId: ID; content: string; tempId?: string },
    callback?: (res: { success: boolean; messageId?: ID; error?: string }) => void,
  ) => void;
  [SocketEvents.TYPING_START]: (payload: { conversationId: ID }) => void;
  [SocketEvents.TYPING_STOP]: (payload: { conversationId: ID }) => void;
}

export interface ServerToClientEvents {
  [SocketEvents.RECEIVE_MESSAGE]: (message: IMessage) => void;
  [SocketEvents.MESSAGE_DELIVERED]: (payload: {
    messageId: ID;
    status: MessageDeliveryStatus;
  }) => void;
  [SocketEvents.MESSAGE_READ]: (payload: { messageId: ID; userId: ID; readAt: string }) => void;
  [SocketEvents.TYPING_START]: (payload: { conversationId: ID; userId: ID }) => void;
  [SocketEvents.TYPING_STOP]: (payload: { conversationId: ID; userId: ID }) => void;
  [SocketEvents.USER_STATUS_CHANGE]: (payload: { userId: ID; status: UserStatus }) => void;
  [SocketEvents.ERROR]: (error: { code: string; message: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  user: SocketUserContext;
  authenticatedAt: number;
}
