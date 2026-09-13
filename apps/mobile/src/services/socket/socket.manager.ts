import { socketService, type TypedClientSocket } from '../socket.service';
import { useSocketStore } from '../../store/socket.store';
import { apiClient } from '../api/client';
import { useAuthStore } from '../../store/auth.store';
import { secureStorage } from '../storage/secure-storage.service';
import {
  type SendMessagePayload,
  type MessageAckResponse,
  type IMessage,
  type PresenceUpdatePayload,
  type MessageReaction,
  type MessageReactionEventPayload,
} from '@chatlock/shared-types';

export class SocketManager {
  private static instance: SocketManager | null = null;
  private initialized = false;

  private constructor() {}

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  /**
   * Binds socket events to store state.
   */
  public initialize(): void {
    if (this.initialized) return;

    // Attach automatic token refresh recovery provider
    socketService.setTokenRefreshProvider(async () => {
      try {
        const freshToken = await apiClient.handleTokenRefresh();
        if (freshToken) {
          const refreshToken = (await secureStorage.getItem('refresh_token')) || '';
          await useAuthStore.getState().setTokens(freshToken, refreshToken);
          return freshToken;
        }
      } catch (err) {
        console.warn('[SocketManager] Automatic token refresh failed:', err);
      }
      return null;
    });

    const socket: TypedClientSocket = socketService.getSocket();

    socket.on('connect', () => {
      useSocketStore.getState().setConnectionState('connected');
      useSocketStore.getState().setLastError(null);
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') {
        useSocketStore.getState().setConnectionState('disconnected');
      } else {
        useSocketStore.getState().setConnectionState('reconnecting');
      }
    });

    socket.on('connect_error', (error) => {
      useSocketStore.getState().setConnectionState('error');
      useSocketStore.getState().setLastError(error.message);
    });

    socket.io.on('reconnect_attempt', () => {
      useSocketStore.getState().setConnectionState('reconnecting');
    });

    socket.io.on('reconnect', () => {
      useSocketStore.getState().setConnectionState('connected');
      useSocketStore.getState().setLastError(null);
    });

    this.initialized = true;
  }

  /**
   * Connects the socket with access token.
   */
  public connect(token: string): void {
    this.initialize();
    useSocketStore.getState().setConnectionState('connecting');
    socketService.connect(token);
  }

  /**
   * Disconnects the socket cleanly.
   */
  public disconnect(): void {
    socketService.disconnect();
    useSocketStore.getState().setConnectionState('disconnected');
    useSocketStore.getState().clearActiveRooms();
  }

  /**
   * Joins a conversation room and tracks active rooms in store.
   */
  public async joinConversation(
    conversationId: string,
  ): Promise<{ success: boolean; room?: string; error?: string }> {
    const result = await socketService.joinConversation(conversationId);
    if (result.success && result.room) {
      useSocketStore.getState().addActiveRoom(result.room);
    }
    return result;
  }

  /**
   * Leaves a conversation room and updates store.
   */
  public async leaveConversation(
    conversationId: string,
  ): Promise<{ success: boolean; room?: string; error?: string }> {
    const result = await socketService.leaveConversation(conversationId);
    if (result.success && result.room) {
      useSocketStore.getState().removeActiveRoom(result.room);
    }
    return result;
  }

  /**
   * Sends real-time message via socket.
   */
  public async sendMessage(payload: SendMessagePayload): Promise<MessageAckResponse> {
    return socketService.sendMessage(payload);
  }

  /**
   * Sends typing:start event.
   */
  public startTyping(conversationId: string): void {
    socketService.startTyping(conversationId);
  }

  /**
   * Sends typing:stop event.
   */
  public stopTyping(conversationId: string): void {
    socketService.stopTyping(conversationId);
  }

  /**
   * Sends presence heartbeat.
   */
  public async sendHeartbeat(): Promise<{ success: boolean }> {
    return socketService.sendHeartbeat();
  }

  /**
   * Registers callback for typing:start events.
   */
  public onTypingStart(
    listener: (payload: { conversationId: string; userId: string }) => void,
  ): () => void {
    return socketService.onTypingStart(listener);
  }

  /**
   * Registers callback for typing:stop events.
   */
  public onTypingStop(
    listener: (payload: { conversationId: string; userId: string }) => void,
  ): () => void {
    return socketService.onTypingStop(listener);
  }

  /**
   * Registers callback for user presence changes.
   */
  public onPresenceUpdate(listener: (payload: PresenceUpdatePayload) => void): () => void {
    return socketService.onPresenceUpdate(listener);
  }

  /**
   * Registers callback for incoming new messages.
   */
  public onNewMessage(listener: (message: IMessage) => void): () => void {
    return socketService.onNewMessage(listener);
  }

  /**
   * Registers callback for message sent ACK.
   */
  public onMessageSent(listener: (ack: MessageAckResponse) => void): () => void {
    return socketService.onMessageSent(listener);
  }

  /**
   * Sends delivery receipt for one or more messages.
   */
  public sendDeliveryReceipt(conversationId: string, messageIdOrIds: string | string[]): void {
    socketService.sendDeliveryReceipt(conversationId, messageIdOrIds);
  }

  /**
   * Sends read receipt for one, multiple, or all messages in a conversation.
   */
  public sendReadReceipt(conversationId: string, messageIdOrIds?: string | string[]): void {
    socketService.sendReadReceipt(conversationId, messageIdOrIds);
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
    return socketService.onMessageDelivered(listener);
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
    return socketService.onMessageRead(listener);
  }

  /**
   * Toggles emoji reaction on a message via socket.
   */
  public async sendReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<{ success: boolean; reactions?: MessageReaction[]; error?: string }> {
    return socketService.sendReaction(conversationId, messageId, emoji);
  }

  /**
   * Registers callback for real-time reaction events.
   */
  public onMessageReaction(
    listener: (payload: MessageReactionEventPayload) => void,
  ): () => void {
    return socketService.onMessageReaction(listener);
  }

  public isConnected(): boolean {
    return socketService.isConnected();
  }
}

export const socketManager = SocketManager.getInstance();
