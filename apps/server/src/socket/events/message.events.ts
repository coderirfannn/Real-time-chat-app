import {
  SocketEvents,
  type SendMessagePayload,
  type MessageAckResponse,
  type MessageReactionPayload,
  type MessageReactionEventPayload,
  type MessageReaction,
} from '@chatlock/shared-types';
import { sendMessageSchema, messageReactionSchema } from '@chatlock/validation';
import { messageService, type MessageService } from '../../services/message.service.js';
import { roomManager } from '../rooms.js';
import type { AuthenticatedSocket } from '../middleware/auth.socket.middleware.js';
import type { TypedSocketServer } from '../index.js';
import { deviceRepository } from '../../repositories/device.repository.js';
import { messageReceiptRepository } from '../../repositories/message-receipt.repository.js';
import { pushNotificationService } from '../../services/push-notification.service.js';
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

      // 5. Broadcast to conversation room AND each participant's user room if not a duplicate
      if (!result.isDuplicate) {
        const room = roomManager.getConversationRoom(validPayload.conversationId);
        let emitter = io.to(room);
        if (result.participantIds && result.participantIds.length > 0) {
          for (const pid of result.participantIds) {
            emitter = emitter.to(roomManager.getUserRoom(pid));
          }
        }
        emitter.emit(SocketEvents.MESSAGE_NEW, result.message);
        emitter.emit(SocketEvents.RECEIVE_MESSAGE, result.message);

        socketMsgLogger.debug('Message broadcasted to room and participants', {
          room,
          participantIds: result.participantIds,
          messageId: result.message.id,
          senderId,
          clientMessageId: validPayload.clientMessageId,
        });

        // Non-blocking background push notification dispatch to offline/background recipient devices
        const recipientIds = (result.participantIds || []).filter((pid) => pid !== senderId);
        if (recipientIds.length > 0) {
          const senderDisplayName = socket.data.user.username || 'ChatLock';
          const isE2EE =
            validPayload.encryptionState === 'E2EE' || Boolean(validPayload.e2eePayload);
          const notificationBody = isE2EE
            ? '🔒 New encrypted message'
            : validPayload.content?.trim() ||
              (validPayload.attachments && validPayload.attachments.length > 0
                ? 'Sent an attachment'
                : 'Sent a message');

          // Concurrently fetch active device tokens and calculate total unread badge count for each recipient
          Promise.all(
            recipientIds.map(async (recipientId) => {
              const [tokens, unreadCount] = await Promise.all([
                deviceRepository.findActiveTokensByUser(recipientId),
                messageReceiptRepository.getTotalUnreadCountForUser(recipientId).catch(() => 1),
              ]);

              if (tokens && tokens.length > 0) {
                return pushNotificationService.sendPushNotifications(tokens, {
                  title: senderDisplayName,
                  body: notificationBody,
                  badge: Math.max(1, unreadCount),
                  channelId: 'chat_messages',
                  data: {
                    conversationId: validPayload.conversationId,
                    messageId: result.message.id,
                    senderId,
                  },
                });
              }
              return null;
            }),
          ).catch((err) => {
            socketMsgLogger.warn('Background push notification error', { error: err });
          });
        }
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

  const handleReaction = async (
    rawPayload: MessageReactionPayload,
    callback?: (res: { success: boolean; reactions?: MessageReaction[]; error?: string }) => void,
  ) => {
    try {
      const userId = socket.data.user.id;
      const parseResult = messageReactionSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        const errorMsg =
          parseResult.error.errors.map((e) => e.message).join(', ') || 'Invalid reaction payload';
        if (callback) callback({ success: false, error: errorMsg });
        socket.emit(SocketEvents.ERROR, {
          code: ErrorCode.VALIDATION_ERROR,
          message: errorMsg,
        });
        return;
      }

      const { conversationId, messageId, emoji } = parseResult.data;
      const result = await service.toggleReaction(userId, conversationId, messageId, emoji);

      const eventPayload: MessageReactionEventPayload = {
        conversationId,
        messageId,
        reactions: result.reactions,
        userId,
        emoji,
        action: result.action,
      };

      // Broadcast reaction to conversation room and participants
      const room = roomManager.getConversationRoom(conversationId);
      let emitter = io.to(room);
      if (result.participantIds && result.participantIds.length > 0) {
        for (const pid of result.participantIds) {
          emitter = emitter.to(roomManager.getUserRoom(pid));
        }
      }
      emitter.emit(SocketEvents.MESSAGE_REACTION, eventPayload);

      if (callback) {
        callback({ success: true, reactions: result.reactions });
      }
    } catch (error) {
      const isAppError = error instanceof AppError;
      const errorCode = isAppError ? error.errorCode : ErrorCode.INTERNAL_SERVER_ERROR;
      const errorMessage = (error as Error).message || 'Failed to toggle reaction';

      socketMsgLogger.warn('Error processing reaction', {
        socketId: socket.id,
        userId: socket.data.user?.id,
        errorCode,
        errorMessage,
      });

      if (callback) {
        callback({ success: false, error: errorMessage });
      }
      socket.emit(SocketEvents.ERROR, {
        code: errorCode,
        message: errorMessage,
      });
    }
  };

  // Primary event: message:send
  socket.on(SocketEvents.MESSAGE_SEND, handleSendMessage);

  // Reaction event: message:reaction
  socket.on(SocketEvents.MESSAGE_REACTION, handleReaction);

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
