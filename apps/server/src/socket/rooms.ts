import { Types } from 'mongoose';
import {
  conversationRepository,
  type ConversationRepository,
} from '../repositories/conversation.repository.js';
import type { AuthenticatedSocket } from './middleware/auth.socket.middleware.js';
import { logger } from '../utils/logger.js';

const roomLogger = logger.child('RoomManager');

export const CONVERSATION_ROOM_PREFIX = 'conversation:';
export const USER_ROOM_PREFIX = 'user:';

export interface RoomOperationResult {
  success: boolean;
  room?: string;
  error?: string;
}

export class RoomManager {
  constructor(private readonly conversationRepo: ConversationRepository = conversationRepository) {}

  /**
   * Generates formatted room string for a conversation.
   */
  public getConversationRoom(conversationId: string): string {
    return `${CONVERSATION_ROOM_PREFIX}${conversationId.trim()}`;
  }

  /**
   * Generates formatted room string for a specific user notification stream.
   */
  public getUserRoom(userId: string): string {
    return `${USER_ROOM_PREFIX}${userId.trim()}`;
  }

  /**
   * Parses conversation ID from either a raw ID or 'conversation:{id}' room string.
   */
  public parseConversationId(roomOrId: string): string | null {
    if (!roomOrId || typeof roomOrId !== 'string') {
      return null;
    }

    const trimmed = roomOrId.trim();
    const id = trimmed.startsWith(CONVERSATION_ROOM_PREFIX)
      ? trimmed.substring(CONVERSATION_ROOM_PREFIX.length).trim()
      : trimmed;

    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return id;
  }

  /**
   * Validates participant authorization and joins the conversation room.
   */
  public async authorizeAndJoinConversation(
    socket: AuthenticatedSocket,
    roomOrId: string,
  ): Promise<RoomOperationResult> {
    const conversationId = this.parseConversationId(roomOrId);

    if (!conversationId) {
      roomLogger.warn('Attempted to join room with invalid ID format', {
        socketId: socket.id,
        roomOrId,
      });
      return {
        success: false,
        error: 'Invalid conversation ID format',
      };
    }

    const userId = socket.data.user.id;

    // Check database authorization
    const isMember = await this.conversationRepo.isParticipant(conversationId, userId);

    if (!isMember) {
      roomLogger.warn('Unauthorized attempt to join conversation room', {
        socketId: socket.id,
        userId,
        conversationId,
      });
      return {
        success: false,
        error: 'You are not authorized to join this conversation',
      };
    }

    const roomName = this.getConversationRoom(conversationId);
    socket.join(roomName);

    roomLogger.debug('Socket joined conversation room', {
      socketId: socket.id,
      userId,
      roomName,
    });

    return {
      success: true,
      room: roomName,
    };
  }

  /**
   * Leaves a conversation room.
   */
  public async leaveConversation(
    socket: AuthenticatedSocket,
    roomOrId: string,
  ): Promise<RoomOperationResult> {
    const conversationId = this.parseConversationId(roomOrId);

    if (!conversationId) {
      return {
        success: false,
        error: 'Invalid conversation ID format',
      };
    }

    const roomName = this.getConversationRoom(conversationId);
    socket.leave(roomName);

    roomLogger.debug('Socket left conversation room', {
      socketId: socket.id,
      userId: socket.data.user?.id,
      roomName,
    });

    return {
      success: true,
      room: roomName,
    };
  }
}

export const roomManager = new RoomManager();
