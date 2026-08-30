import {
  SocketEvents,
  type SendMessagePayload,
  type MessageAckResponse,
} from '@chatlock/shared-types';
import { sendMessageSchema } from '@chatlock/validation';
import { messageService, type MessageService } from '../../services/message.service.js';
import { roomManager } from '../rooms.js';
import type { AuthenticatedSocket } from '../middleware/auth.socket.middleware.js';
import type { TypedSocketServer } from '../index.js';
import { AppError } from '../../errors/app-error.js';
import { ErrorCode } from '../../errors/error-codes.js';
import { logger } from '../../utils/logger.js';

const socketMsgLogger = logger.child('SocketMessaging');

/**
 * Registers real-time messaging event listeners on an authenticated socket.
 */
export function registerMessageEvents(
  socket: AuthenticatedSocket,
  io: TypedSocketServer,
  service: MessageService = messageService,
): void {
  const handleSendMessage = async (
    rawPayload: SendMessagePayload,
    callback?: (res: MessageAckResponse) => void,
  ) => {
    const clientMsgId =
      rawPayload && typeof rawPayload === 'object' ? rawPayload.clientMessageId : '';

    try {
      // 1. Zero-Trust Identity: strictly derive sender from socket auth context
      const senderId = socket.data.user.id;

      // 2. Validate message payload
      const parseResult = sendMessageSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        const errorMsg =
          parseResult.error.errors.map((e) => e.message).join(', ') || 'Invalid message payload';

        const failAck: MessageAckResponse = {
          success: false,
          clientMessageId: clientMsgId,
          errorCode: ErrorCode.VALIDATION_ERROR,
          error: errorMsg,
        };

        if (callback) callback(failAck);
        socket.emit(SocketEvents.ERROR, {
          code: ErrorCode.VALIDATION_ERROR,
          message: errorMsg,
        });
        return;
      }

      const validPayload = parseResult.data;

      // 3. Process and persist message via MessageService
      const result = await service.sendMessage(senderId, validPayload);

      // 4. Construct successful ACK
      const ack: MessageAckResponse = {
        success: true,
        clientMessageId: validPayload.clientMessageId,
        serverMessageId: result.message.id,
        message: result.message,
      };

      // 5. Broadcast to room if not a duplicate
      if (!result.isDuplicate) {
        const room = roomManager.getConversationRoom(validPayload.conversationId);
        io.to(room).emit(SocketEvents.MESSAGE_NEW, result.message);
        io.to(room).emit(SocketEvents.RECEIVE_MESSAGE, result.message);

        socketMsgLogger.debug('Message broadcasted to room', {
          room,
          messageId: result.message.id,
          senderId,
          clientMessageId: validPayload.clientMessageId,
        });
      }

      // 6. Acknowledge sender
      if (callback) {
        callback(ack);
      }
      socket.emit(SocketEvents.MESSAGE_SENT, ack);
    } catch (error) {
      const isAppError = error instanceof AppError;
      const errorCode = isAppError ? error.errorCode : ErrorCode.INTERNAL_SERVER_ERROR;
      const errorMessage = (error as Error).message || 'Failed to process message';

      socketMsgLogger.warn('Error processing socket message', {
        socketId: socket.id,
        senderId: socket.data.user?.id,
        errorCode,
        errorMessage,
      });

      const failAck: MessageAckResponse = {
        success: false,
        clientMessageId: clientMsgId,
        errorCode,
        error: errorMessage,
      };

      if (callback) {
        callback(failAck);
      }
      socket.emit(SocketEvents.ERROR, {
        code: errorCode,
        message: errorMessage,
      });
    }
  };

  // Primary event: message:send
  socket.on(SocketEvents.MESSAGE_SEND, handleSendMessage);

  // Backward-compatible event: send_message
  socket.on(
    SocketEvents.SEND_MESSAGE,
    handleSendMessage as unknown as (
      payload: SendMessagePayload | { conversationId: string; content: string; tempId?: string },
      callback?: (
        res: MessageAckResponse | { success: boolean; messageId?: string; error?: string },
      ) => void,
    ) => void,
  );
}
