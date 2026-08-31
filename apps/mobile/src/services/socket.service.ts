import { io, type Socket } from 'socket.io-client';
import {
  SocketEvents,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SendMessagePayload,
  type MessageAckResponse,
  type IMessage,
  type PresenceUpdatePayload,
} from '@chatlock/shared-types';
import { mobileConfig } from '../config/env';

export type TypedClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class SocketService {
  private socket: TypedClientSocket | null = null;
  private currentToken: string | null = null;
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || mobileConfig?.socketUrl || 'http://localhost:5000';
  }

  /**
   * Initializes or returns the Socket.IO client instance.
   */
  public getSocket(): TypedClientSocket {
    if (!this.socket) {
      this.socket = io(this.baseUrl, {
        autoConnect: false,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      this.setupDefaultListeners(this.socket);
    }

    return this.socket;
  }

  /**
   * Connects to the Socket.IO gateway with Bearer authentication token.
   */
  public connect(token: string): TypedClientSocket {
    this.currentToken = token;
    const socket = this.getSocket();

    socket.auth = { token };

    if (!socket.connected) {
      socket.connect();
    }

    return socket;
  }

  /**
   * Disconnects the socket.
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.currentToken = null;
    }
  }

  /**
   * Joins a conversation room with server acknowledgment.
   */
  public async joinConversation(
    conversationId: string,
  ): Promise<{ success: boolean; room?: string; error?: string }> {
    const socket = this.getSocket();

    if (!socket.connected) {
      return { success: false, error: 'Socket is not connected' };
    }

    return new Promise((resolve) => {
      socket.emit(
        SocketEvents.JOIN_ROOM,
        { conversationId },
        (res: { success: boolean; room?: string; error?: string }) => {
          resolve(res);
        },
      );
    });
  }

  /**
   * Leaves a conversation room.
   */
  public async leaveConversation(
    conversationId: string,
  ): Promise<{ success: boolean; room?: string; error?: string }> {
    const socket = this.getSocket();

    if (!socket.connected) {
      return { success: false, error: 'Socket is not connected' };
    }

    return new Promise((resolve) => {
      socket.emit(
        SocketEvents.LEAVE_ROOM,
        { conversationId },
        (res: { success: boolean; room?: string; error?: string }) => {
          resolve(res);
        },
      );
    });
  }

  /**
   * Emits message:send with clientMessageId and returns server ACK response.
   */
  public async sendMessage(payload: SendMessagePayload): Promise<MessageAckResponse> {
    const socket = this.getSocket();

    if (!socket.connected) {
      return {
        success: false,
        clientMessageId: payload.clientMessageId,
        errorCode: 'SOCKET_DISCONNECTED',
        error: 'Socket is not connected',
      };
    }

    return new Promise((resolve) => {
      socket.emit(SocketEvents.MESSAGE_SEND, payload, (ack: MessageAckResponse) => {
        resolve(ack);
      });
    });
  }

  /**
   * Dispatches typing:start to conversation participants.
   */
  public startTyping(conversationId: string): void {
    const socket = this.getSocket();
    if (socket.connected) {
      socket.emit(SocketEvents.TYPING_START, { conversationId });
    }
  }

  /**
   * Dispatches typing:stop to conversation participants.
   */
  public stopTyping(conversationId: string): void {
    const socket = this.getSocket();
    if (socket.connected) {
      socket.emit(SocketEvents.TYPING_STOP, { conversationId });
    }
  }

  /**
   * Dispatches presence heartbeat to refresh Redis TTL.
   */
  public async sendHeartbeat(): Promise<{ success: boolean }> {
    const socket = this.getSocket();
    if (!socket.connected) {
      return { success: false };
    }

    return new Promise((resolve) => {
      socket.emit(SocketEvents.PRESENCE_HEARTBEAT, (res: { success: boolean }) => {
        resolve(res || { success: true });
      });
    });
  }

  /**
   * Registers callback for typing:start events.
   */
  public onTypingStart(
    listener: (payload: { conversationId: string; userId: string }) => void,
  ): () => void {
    const socket = this.getSocket();
    socket.on(SocketEvents.TYPING_START, listener);
    socket.on(SocketEvents.TYPING_START_LEGACY, listener);
    return () => {
      socket.off(SocketEvents.TYPING_START, listener);
      socket.off(SocketEvents.TYPING_START_LEGACY, listener);
    };
  }

  /**
   * Registers callback for typing:stop events.
   */
  public onTypingStop(
    listener: (payload: { conversationId: string; userId: string }) => void,
  ): () => void {
    const socket = this.getSocket();
    socket.on(SocketEvents.TYPING_STOP, listener);
    socket.on(SocketEvents.TYPING_STOP_LEGACY, listener);
    return () => {
      socket.off(SocketEvents.TYPING_STOP, listener);
      socket.off(SocketEvents.TYPING_STOP_LEGACY, listener);
    };
  }

  /**
   * Registers callback for presence update events.
   */
  public onPresenceUpdate(listener: (payload: PresenceUpdatePayload) => void): () => void {
    const socket = this.getSocket();
    socket.on(SocketEvents.USER_PRESENCE, listener);
    socket.on(SocketEvents.PRESENCE_UPDATE, listener);
    socket.on(SocketEvents.USER_STATUS_CHANGE, listener);
    return () => {
      socket.off(SocketEvents.USER_PRESENCE, listener);
      socket.off(SocketEvents.PRESENCE_UPDATE, listener);
      socket.off(SocketEvents.USER_STATUS_CHANGE, listener);
    };
  }

  /**
   * Registers a listener for new incoming messages across joined conversation rooms.
   */
  public onNewMessage(listener: (message: IMessage) => void): () => void {
    const socket = this.getSocket();
    socket.on(SocketEvents.MESSAGE_NEW, listener);
    return () => socket.off(SocketEvents.MESSAGE_NEW, listener);
  }

  /**
   * Registers a listener for sender message acknowledgment events.
   */
  public onMessageSent(listener: (ack: MessageAckResponse) => void): () => void {
    const socket = this.getSocket();
    socket.on(SocketEvents.MESSAGE_SENT, listener);
    return () => socket.off(SocketEvents.MESSAGE_SENT, listener);
  }

  /**
   * Sends delivery receipt for one or more messages.
   */
  public sendDeliveryReceipt(conversationId: string, messageIdOrIds: string | string[]): void {
    const socket = this.getSocket();
    if (!socket.connected) return;

    if (Array.isArray(messageIdOrIds)) {
      socket.emit(SocketEvents.MESSAGE_DELIVERED, {
        conversationId,
        messageIds: messageIdOrIds,
      });
    } else {
      socket.emit(SocketEvents.MESSAGE_DELIVERED, {
        conversationId,
        messageId: messageIdOrIds,
      });
    }
  }

  /**
   * Sends read receipt for one, multiple, or all messages in a conversation.
   */
  public sendReadReceipt(conversationId: string, messageIdOrIds?: string | string[]): void {
    const socket = this.getSocket();
    if (!socket.connected) return;

    if (Array.isArray(messageIdOrIds)) {
      socket.emit(SocketEvents.MESSAGE_READ, {
        conversationId,
        messageIds: messageIdOrIds,
      });
    } else if (typeof messageIdOrIds === 'string') {
      socket.emit(SocketEvents.MESSAGE_READ, {
        conversationId,
        messageId: messageIdOrIds,
      });
    } else {
      socket.emit(SocketEvents.MESSAGE_READ, {
        conversationId,
      });
    }
  }

  /**
   * Registers callback for message:delivered events.
   */
  public onMessageDelivered(
    listener: (payload: {
      conversationId: string;
      messageId?: string;
      messageIds?: string[];
      userId: string;
      status: 'delivered';
      deliveredAt?: string;
    }) => void,
  ): () => void {
    const socket = this.getSocket();
    socket.on(SocketEvents.MESSAGE_DELIVERED, listener as never);
    socket.on(SocketEvents.MESSAGE_DELIVERED_LEGACY, listener as never);
    return () => {
      socket.off(SocketEvents.MESSAGE_DELIVERED, listener as never);
      socket.off(SocketEvents.MESSAGE_DELIVERED_LEGACY, listener as never);
    };
  }

  /**
   * Registers callback for message:read events.
   */
  public onMessageRead(
    listener: (payload: {
      conversationId: string;
      messageId?: string;
      messageIds?: string[];
      userId: string;
      status: 'read';
      readAt?: string;
    }) => void,
  ): () => void {
    const socket = this.getSocket();
    socket.on(SocketEvents.MESSAGE_READ, listener as never);
    socket.on(SocketEvents.MESSAGE_READ_LEGACY, listener as never);
    return () => {
      socket.off(SocketEvents.MESSAGE_READ, listener as never);
      socket.off(SocketEvents.MESSAGE_READ_LEGACY, listener as never);
    };
  }

  /**
   * Checks if socket is currently connected.
   */
  public isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }

  /**
   * Gets the connected socket ID.
   */
  public getSocketId(): string | undefined {
    return this.socket?.id;
  }

  private setupDefaultListeners(socket: TypedClientSocket): void {
    socket.on('connect', () => {
      if (this.currentToken && socket.auth) {
        socket.auth = { token: this.currentToken };
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('[ChatLock:Socket] Connection error:', err.message);
    });

    socket.on(SocketEvents.ERROR, (error) => {
      console.warn('[ChatLock:Socket] Gateway error:', error.code, error.message);
    });
  }
}

export const socketService = new SocketService();
