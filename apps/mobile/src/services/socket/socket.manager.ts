import { socketService, type TypedClientSocket } from '../socket.service.js';
import { useSocketStore } from '../../store/socket.store.js';
import {
  type SendMessagePayload,
  type MessageAckResponse,
  type IMessage,
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

  public isConnected(): boolean {
    return socketService.isConnected();
  }
}

export const socketManager = SocketManager.getInstance();
