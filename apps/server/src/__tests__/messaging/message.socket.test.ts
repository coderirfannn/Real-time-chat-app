import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http, { type Server as HttpServer } from 'http';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import { Types } from 'mongoose';
import { SocketEvents, type MessageAckResponse, type IMessage } from '@chatlock/shared-types';
import { createApp } from '../../app.js';
import { initSocketServer, closeSocketIO, connectionManager } from '../../socket/index.js';
import { conversationRepository } from '../../repositories/conversation.repository.js';
import { messageRepository } from '../../repositories/message.repository.js';
import { messageReceiptRepository } from '../../repositories/message-receipt.repository.js';
import { signAccessToken } from '../../utils/token.js';
import { ErrorCode } from '../../errors/error-codes.js';
import type { IMessageDoc } from '../../models/message.model.js';
import type { IConversationDoc } from '../../models/conversation.model.js';

describe('Real-Time Messaging Socket.IO End-to-End Tests', () => {
  let httpServer: HttpServer;
  let serverPort: number;
  let serverUrl: string;

  const senderId = new Types.ObjectId().toString();
  const recipientId = new Types.ObjectId().toString();
  const outsiderId = new Types.ObjectId().toString();
  const convId = new Types.ObjectId().toString();

  const senderToken = signAccessToken({
    sub: senderId,
    email: 'sender@example.com',
    username: 'sender_user',
  }).token;

  const recipientToken = signAccessToken({
    sub: recipientId,
    email: 'recipient@example.com',
    username: 'recipient_user',
  }).token;

  const outsiderToken = signAccessToken({
    sub: outsiderId,
    email: 'outsider@example.com',
    username: 'outsider_user',
  }).token;

  beforeAll(async () => {
    const app = createApp();
    httpServer = http.createServer(app);
    initSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 0;
        serverUrl = `http://localhost:${serverPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await closeSocketIO();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    connectionManager.clear();
    vi.spyOn(conversationRepository, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(convId),
      participants: [new Types.ObjectId(senderId), new Types.ObjectId(recipientId)],
    } as unknown as IConversationDoc);
    vi.spyOn(messageReceiptRepository, 'upsertReceipt').mockResolvedValue(null);
  });

  it('delivers real-time message to conversation room and ACKs sender', async () => {
    vi.spyOn(conversationRepository, 'isParticipant').mockResolvedValue(true);

    const msgDocId = new Types.ObjectId();
    const mockCreatedDoc = {
      _id: msgDocId,
      id: msgDocId.toString(),
      conversationId: new Types.ObjectId(convId),
      senderId: new Types.ObjectId(senderId),
      clientMessageId: 'cm_reliable_01',
      type: 'text',
      content: 'Hello, Real-Time World!',
      createdAt: new Date(),
      updatedAt: new Date(),
      toJSON: () => ({
        id: msgDocId.toString(),
        conversationId: convId,
        senderId,
        clientMessageId: 'cm_reliable_01',
        type: 'text',
        content: 'Hello, Real-Time World!',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    };

    vi.spyOn(messageRepository, 'findByClientMessageId').mockResolvedValue(null);
    vi.spyOn(messageRepository, 'createMessage').mockResolvedValue(
      mockCreatedDoc as unknown as IMessageDoc,
    );
    vi.spyOn(conversationRepository, 'updateLastMessage').mockResolvedValue(null);

    // Connect sender and recipient
    const senderClient: ClientSocket = Client(serverUrl, {
      auth: { token: senderToken },
      transports: ['websocket'],
    });

    const recipientClient: ClientSocket = Client(serverUrl, {
      auth: { token: recipientToken },
      transports: ['websocket'],
    });

    // Wait for both to connect and join conversation room
    await Promise.all([
      new Promise<void>((resolve) => {
        senderClient.on('connect', () => {
          senderClient.emit(SocketEvents.JOIN_ROOM, { conversationId: convId }, () => resolve());
        });
      }),
      new Promise<void>((resolve) => {
        recipientClient.on('connect', () => {
          recipientClient.emit(SocketEvents.JOIN_ROOM, { conversationId: convId }, () => resolve());
        });
      }),
    ]);

    // Send message and verify ACK + broadcast
    await new Promise<void>((resolve, reject) => {
      let ackReceived = false;
      let broadcastReceived = false;

      const checkDone = () => {
        if (ackReceived && broadcastReceived) {
          senderClient.disconnect();
          recipientClient.disconnect();
          resolve();
        }
      };

      recipientClient.on(SocketEvents.MESSAGE_NEW, (receivedMsg: IMessage) => {
        try {
          expect(receivedMsg.id).toBe(msgDocId.toString());
          expect(receivedMsg.content).toBe('Hello, Real-Time World!');
          expect(receivedMsg.senderId).toBe(senderId);
          broadcastReceived = true;
          checkDone();
        } catch (err) {
          reject(err);
        }
      });

      senderClient.emit(
        SocketEvents.MESSAGE_SEND,
        {
          conversationId: convId,
          clientMessageId: 'cm_reliable_01',
          content: 'Hello, Real-Time World!',
          type: 'text',
        },
        (ack: MessageAckResponse) => {
          try {
            expect(ack.success).toBe(true);
            expect(ack.clientMessageId).toBe('cm_reliable_01');
            expect(ack.serverMessageId).toBe(msgDocId.toString());
            expect(ack.message?.content).toBe('Hello, Real-Time World!');
            ackReceived = true;
            checkDone();
          } catch (err) {
            reject(err);
          }
        },
      );
    });
  });

  it('handles duplicate message submission idempotently without re-broadcasting', async () => {
    vi.spyOn(conversationRepository, 'isParticipant').mockResolvedValue(true);

    const msgDocId = new Types.ObjectId();
    const existingDoc = {
      _id: msgDocId,
      id: msgDocId.toString(),
      conversationId: new Types.ObjectId(convId),
      senderId: new Types.ObjectId(senderId),
      clientMessageId: 'cm_duplicate_01',
      type: 'text',
      content: 'Existing message content',
      createdAt: new Date(),
      toJSON: () => ({
        id: msgDocId.toString(),
        conversationId: convId,
        senderId,
        clientMessageId: 'cm_duplicate_01',
        type: 'text',
        content: 'Existing message content',
        createdAt: new Date().toISOString(),
      }),
    };

    // Return existing message (simulate duplicate)
    vi.spyOn(messageRepository, 'findByClientMessageId').mockResolvedValue(
      existingDoc as unknown as IMessageDoc,
    );
    const createSpy = vi.spyOn(messageRepository, 'createMessage');

    const senderClient: ClientSocket = Client(serverUrl, {
      auth: { token: senderToken },
      transports: ['websocket'],
    });

    const recipientClient: ClientSocket = Client(serverUrl, {
      auth: { token: recipientToken },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise<void>((resolve) => {
        senderClient.on('connect', () => {
          senderClient.emit(SocketEvents.JOIN_ROOM, { conversationId: convId }, () => resolve());
        });
      }),
      new Promise<void>((resolve) => {
        recipientClient.on('connect', () => {
          recipientClient.emit(SocketEvents.JOIN_ROOM, { conversationId: convId }, () => resolve());
        });
      }),
    ]);

    const recipientBroadcastSpy = vi.fn();
    recipientClient.on(SocketEvents.MESSAGE_NEW, recipientBroadcastSpy);

    await new Promise<void>((resolve, reject) => {
      senderClient.emit(
        SocketEvents.MESSAGE_SEND,
        {
          conversationId: convId,
          clientMessageId: 'cm_duplicate_01',
          content: 'Existing message content',
        },
        (ack: MessageAckResponse) => {
          try {
            // ACK succeeds with existing message ID
            expect(ack.success).toBe(true);
            expect(ack.serverMessageId).toBe(msgDocId.toString());
            expect(ack.clientMessageId).toBe('cm_duplicate_01');
            expect(createSpy).not.toHaveBeenCalled();

            // Give a short delay to confirm no duplicate broadcast was emitted
            setTimeout(() => {
              expect(recipientBroadcastSpy).not.toHaveBeenCalled();
              senderClient.disconnect();
              recipientClient.disconnect();
              resolve();
            }, 50);
          } catch (err) {
            reject(err);
          }
        },
      );
    });
  });

  it('rejects message sending when user is not a participant in the conversation', async () => {
    // Outsider is not a participant
    vi.spyOn(conversationRepository, 'isParticipant').mockResolvedValue(false);

    const outsiderClient: ClientSocket = Client(serverUrl, {
      auth: { token: outsiderToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      outsiderClient.on('connect', () => {
        outsiderClient.emit(
          SocketEvents.MESSAGE_SEND,
          {
            conversationId: convId,
            clientMessageId: 'cm_unauthorized',
            content: 'Attempt to send in unauthorized chat',
          },
          (ack: MessageAckResponse) => {
            try {
              expect(ack.success).toBe(false);
              expect(ack.errorCode).toBe(ErrorCode.FORBIDDEN);
              expect(ack.error).toMatch(/not authorized/i);
              outsiderClient.disconnect();
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        );
      });
    });
  });

  it('rejects message sending on invalid payload (empty content)', async () => {
    const senderClient: ClientSocket = Client(serverUrl, {
      auth: { token: senderToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      senderClient.on('connect', () => {
        senderClient.emit(
          SocketEvents.MESSAGE_SEND,
          {
            conversationId: convId,
            clientMessageId: 'cm_invalid',
            content: '', // Empty content violates min(1) rule
          },
          (ack: MessageAckResponse) => {
            try {
              expect(ack.success).toBe(false);
              expect(ack.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
              senderClient.disconnect();
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        );
      });
    });
  });
});
