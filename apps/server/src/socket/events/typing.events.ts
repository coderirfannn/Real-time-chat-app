import type { AuthenticatedSocket } from '../middleware/auth.socket.middleware.js';
import type { TypedSocketServer } from '../index.js';
import { conversationRepository } from '../../repositories/conversation.repository.js';
import { roomManager } from '../rooms.js';
import { typingEventSchema } from '@chatlock/validation';
import { SocketEvents } from '@chatlock/shared-types';
import { logger } from '../../utils/logger.js';

const typingLogger = logger.child('TypingEvents');

/**
 * Registers typing event listeners (typing:start, typing:stop) with participant validation.
 */
export function registerTypingEvents(socket: AuthenticatedSocket, _io: TypedSocketServer): void {
  const userId = socket.data.user.id;

  const handleTypingStart = async (rawPayload: unknown) => {
    const parseResult = typingEventSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return;
    }

    const { conversationId } = parseResult.data;

    try {
      // Validate participant authorization
      const isParticipant = await conversationRepository.isParticipant(conversationId, userId);
      if (!isParticipant) {
        return;
      }

      const room = roomManager.getConversationRoom(conversationId);
      // Broadcast to other participants in the room (excluding sender)
      socket.to(room).emit(SocketEvents.TYPING_START, {
        conversationId,
        userId,
      });
      socket.to(room).emit(SocketEvents.TYPING_START_LEGACY, {
        conversationId,
        userId,
      });

      typingLogger.debug('Typing start broadcasted', { conversationId, userId, room });
    } catch (err) {
      typingLogger.warn('Error handling typing:start event', {
        conversationId,
        userId,
        error: err,
      });
    }
  };

  const handleTypingStop = async (rawPayload: unknown) => {
    const parseResult = typingEventSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return;
    }

    const { conversationId } = parseResult.data;

    try {
      const isParticipant = await conversationRepository.isParticipant(conversationId, userId);
      if (!isParticipant) {
        return;
      }

      const room = roomManager.getConversationRoom(conversationId);
      socket.to(room).emit(SocketEvents.TYPING_STOP, {
        conversationId,
        userId,
      });
      socket.to(room).emit(SocketEvents.TYPING_STOP_LEGACY, {
        conversationId,
        userId,
      });

      typingLogger.debug('Typing stop broadcasted', { conversationId, userId, room });
    } catch (err) {
      typingLogger.warn('Error handling typing:stop event', { conversationId, userId, error: err });
    }
  };

  socket.on(SocketEvents.TYPING_START, handleTypingStart);
  socket.on(SocketEvents.TYPING_START_LEGACY, handleTypingStart);
  socket.on(SocketEvents.TYPING_STOP, handleTypingStop);
  socket.on(SocketEvents.TYPING_STOP_LEGACY, handleTypingStop);
}
