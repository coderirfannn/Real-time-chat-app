import {
  SocketEvents,
  type MessageDeliveredPayload,
  type MessageReadPayload,
  type ReceiptUpdatePayload,
} from '@chatlock/shared-types';
import { messageDeliveredSchema, messageReadSchema } from '@chatlock/validation';
import { receiptService, type ReceiptService } from '../../services/receipt.service.js';
import { roomManager } from '../rooms.js';
import type { AuthenticatedSocket } from '../middleware/auth.socket.middleware.js';
import type { TypedSocketServer } from '../index.js';
import { AppError } from '../../errors/app-error.js';
import { ErrorCode } from '../../errors/error-codes.js';
import { logger } from '../../utils/logger.js';

const receiptSocketLogger = logger.child('ReceiptSocket');

/**
 * Registers real-time delivery and read receipt listeners on an authenticated socket.
 */
export function registerReceiptEvents(
  socket: AuthenticatedSocket,
  io: TypedSocketServer,
  service: ReceiptService = receiptService,
): void {
  // ====================================================
  // 1. MESSAGE DELIVERED HANDLER
  // ====================================================
  const handleMessageDelivered = async (
    rawPayload: MessageDeliveredPayload,
    callback?: (res: { success: boolean; error?: string }) => void,
  ) => {
    try {
      const userId = socket.data.user.id;
      const parseResult = messageDeliveredSchema.safeParse(rawPayload);

      if (!parseResult.success) {
        const errorMsg =
          parseResult.error.errors.map((e) => e.message).join(', ') ||
          'Invalid delivery receipt payload';
        if (callback) callback({ success: false, error: errorMsg });
        return;
      }

      const validPayload = parseResult.data;
      const receiptUpdate: ReceiptUpdatePayload = await service.processDeliveryReceipt(
        userId,
        validPayload,
      );

      // Broadcast receipt update to the conversation room
      const room = roomManager.getConversationRoom(validPayload.conversationId);
      io.to(room).emit(SocketEvents.MESSAGE_DELIVERED, receiptUpdate);
      io.to(room).emit(SocketEvents.MESSAGE_DELIVERED_LEGACY, receiptUpdate);

      receiptSocketLogger.debug('Broadcasted message:delivered', {
        room,
        userId,
        messageId: receiptUpdate.messageId,
        messageIds: receiptUpdate.messageIds,
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      const isAppError = error instanceof AppError;
      const errorCode = isAppError ? error.errorCode : ErrorCode.INTERNAL_SERVER_ERROR;
      const errorMessage = (error as Error).message || 'Failed to process delivery receipt';

      receiptSocketLogger.warn('Error processing delivery receipt', {
        socketId: socket.id,
        userId: socket.data.user?.id,
        errorCode,
        errorMessage,
      });

      if (callback) {
        callback({ success: false, error: errorMessage });
      }
    }
  };

  // ====================================================
  // 2. MESSAGE READ HANDLER
  // ====================================================
  const handleMessageRead = async (
    rawPayload: MessageReadPayload,
    callback?: (res: { success: boolean; error?: string }) => void,
  ) => {
    try {
      const userId = socket.data.user.id;
      const parseResult = messageReadSchema.safeParse(rawPayload);

      if (!parseResult.success) {
        const errorMsg =
          parseResult.error.errors.map((e) => e.message).join(', ') ||
          'Invalid read receipt payload';
        if (callback) callback({ success: false, error: errorMsg });
        return;
      }

      const validPayload = parseResult.data;
      const receiptUpdate: ReceiptUpdatePayload = await service.processReadReceipt(
        userId,
        validPayload,
      );

      // Broadcast receipt update to the conversation room
      const room = roomManager.getConversationRoom(validPayload.conversationId);
      io.to(room).emit(SocketEvents.MESSAGE_READ, receiptUpdate);
      io.to(room).emit(SocketEvents.MESSAGE_READ_LEGACY, receiptUpdate);

      receiptSocketLogger.debug('Broadcasted message:read', {
        room,
        userId,
        messageId: receiptUpdate.messageId,
        messageIds: receiptUpdate.messageIds,
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      const isAppError = error instanceof AppError;
      const errorCode = isAppError ? error.errorCode : ErrorCode.INTERNAL_SERVER_ERROR;
      const errorMessage = (error as Error).message || 'Failed to process read receipt';

      receiptSocketLogger.warn('Error processing read receipt', {
        socketId: socket.id,
        userId: socket.data.user?.id,
        errorCode,
        errorMessage,
      });

      if (callback) {
        callback({ success: false, error: errorMessage });
      }
    }
  };

  // Register primary event listeners
  socket.on(SocketEvents.MESSAGE_DELIVERED, handleMessageDelivered);
  socket.on(SocketEvents.MESSAGE_READ, handleMessageRead);

  // Register legacy aliases for backward compatibility
  socket.on(SocketEvents.MESSAGE_DELIVERED_LEGACY, handleMessageDelivered);
  socket.on(SocketEvents.MESSAGE_READ_LEGACY, handleMessageRead);
}
