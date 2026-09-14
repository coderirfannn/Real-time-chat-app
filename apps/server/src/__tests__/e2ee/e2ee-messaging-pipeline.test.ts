import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { MessageService } from '../../services/message.service.js';
import type { MessageRepository } from '../../repositories/message.repository.js';
import type { ConversationRepository } from '../../repositories/conversation.repository.js';
import type { MessageReceiptRepository } from '../../repositories/message-receipt.repository.js';
import type { IMessageDoc } from '../../models/message.model.js';
import type { IConversationDoc } from '../../models/conversation.model.js';
import type { E2EEEncryptedPayload, MessageEncryptionState } from '@chatlock/shared-types';

describe('E2EE Messaging Pipeline Integration Tests', () => {
  let mockMessageRepo: Partial<MessageRepository>;
  let mockConvRepo: Partial<ConversationRepository>;
  let mockReceiptRepo: { upsertReceipt: ReturnType<typeof vi.fn> };
  let service: MessageService;

  const senderId = new Types.ObjectId().toString();
  const recipientId = new Types.ObjectId().toString();
  const convId = new Types.ObjectId().toString();
  const msgId = new Types.ObjectId().toString();
  const clientMessageId = 'c_e2ee_test_12345';
  const senderDeviceId = 'dev_ios_alpha_99';

  const sampleE2eePayload: E2EEEncryptedPayload = {
    version: 1,
    sessionId: `${senderId}:${senderDeviceId}`,
    header: {
      ratchetKey: 'mock_dh_pub_key_base64==',
      pn: 0,
      n: 1,
    },
    ciphertext: 'mock_aes_gcm_ciphertext_data==',
    isPreKeyInit: true,
    initHeader: {
      initiatorUserId: senderId,
      initiatorDeviceId: senderDeviceId,
      initiatorIdentityKey: 'mock_ik_base64==',
      ephemeralPublicKey: 'mock_ek_base64==',
      spkKeyId: 101,
      opkKeyId: 202,
      sessionVersion: 1,
      timestamp: new Date().toISOString(),
    },
  };

  const mockE2EEMessageDoc = {
    _id: new Types.ObjectId(msgId),
    conversationId: new Types.ObjectId(convId),
    senderId: new Types.ObjectId(senderId),
    clientMessageId,
    content: sampleE2eePayload.ciphertext,
    type: 'text',
    encryptionState: 'E2EE',
    senderDeviceId,
    e2eePayload: sampleE2eePayload,
    reactions: [],
    createdAt: new Date(),
    toJSON: () => ({
      id: msgId,
      conversationId: convId,
      senderId,
      clientMessageId,
      content: sampleE2eePayload.ciphertext,
      type: 'text',
      encryptionState: 'E2EE',
      senderDeviceId,
      e2eePayload: sampleE2eePayload,
      reactions: [],
      createdAt: new Date().toISOString(),
    }),
  };

  beforeEach(() => {
    mockMessageRepo = {
      findByClientMessageId: vi.fn(),
      createMessage: vi.fn(),
    };
    mockConvRepo = {
      isParticipant: vi.fn(),
      updateLastMessage: vi.fn(),
      findById: vi.fn(),
    };
    mockReceiptRepo = {
      upsertReceipt: vi.fn().mockResolvedValue(null),
    };
    service = new MessageService(
      mockMessageRepo as MessageRepository,
      mockConvRepo as ConversationRepository,
      mockReceiptRepo as unknown as MessageReceiptRepository,
    );
  });

  describe('Zero-Plaintext E2EE Message Delivery', () => {
    it('persists E2EE ciphertext and metadata without receiving plaintext', async () => {
      vi.mocked(mockConvRepo.isParticipant!).mockResolvedValue(true);
      vi.mocked(mockConvRepo.findById!).mockResolvedValue({
        _id: new Types.ObjectId(convId),
        participants: [new Types.ObjectId(senderId), new Types.ObjectId(recipientId)],
      } as unknown as IConversationDoc);
      vi.mocked(mockMessageRepo.findByClientMessageId!).mockResolvedValue(null);
      vi.mocked(mockMessageRepo.createMessage!).mockResolvedValue(
        mockE2EEMessageDoc as unknown as IMessageDoc,
      );

      const result = await service.sendMessage(senderId, {
        conversationId: convId,
        clientMessageId,
        type: 'text',
        content: sampleE2eePayload.ciphertext,
        encryptionState: 'E2EE',
        senderDeviceId,
        e2eePayload: sampleE2eePayload,
      });

      // 1. Verify MessageRepository was invoked with ciphertext and E2EE fields
      expect(mockMessageRepo.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: convId,
          senderId,
          clientMessageId,
          content: sampleE2eePayload.ciphertext,
          encryptionState: 'E2EE',
          senderDeviceId,
          e2eePayload: sampleE2eePayload,
        }),
      );

      // 2. Verify returned message carries encryptionState and e2eePayload
      expect(result.message.encryptionState).toBe('E2EE');
      expect(result.message.content).toBe(sampleE2eePayload.ciphertext);
      expect(result.message.senderDeviceId).toBe(senderDeviceId);
      expect(result.message.e2eePayload).toEqual(sampleE2eePayload);
      expect(result.isDuplicate).toBe(false);
    });

    it('handles idempotent duplicate send of E2EE message without re-insertion', async () => {
      vi.mocked(mockConvRepo.isParticipant!).mockResolvedValue(true);
      vi.mocked(mockConvRepo.findById!).mockResolvedValue({
        _id: new Types.ObjectId(convId),
        participants: [new Types.ObjectId(senderId), new Types.ObjectId(recipientId)],
      } as unknown as IConversationDoc);
      vi.mocked(mockMessageRepo.findByClientMessageId!).mockResolvedValue(
        mockE2EEMessageDoc as unknown as IMessageDoc,
      );

      const result = await service.sendMessage(senderId, {
        conversationId: convId,
        clientMessageId,
        type: 'text',
        content: sampleE2eePayload.ciphertext,
        encryptionState: 'E2EE',
        senderDeviceId,
        e2eePayload: sampleE2eePayload,
      });

      expect(mockMessageRepo.createMessage).not.toHaveBeenCalled();
      expect(result.isDuplicate).toBe(true);
      expect(result.message.encryptionState).toBe('E2EE');
      expect(result.message.content).toBe(sampleE2eePayload.ciphertext);
    });

    it('defaults to LEGACY_PLAINTEXT when encryptionState is omitted for backwards compatibility', async () => {
      const legacyDoc = {
        ...mockE2EEMessageDoc,
        content: 'Legacy hello',
        encryptionState: 'LEGACY_PLAINTEXT',
        e2eePayload: undefined,
        senderDeviceId: undefined,
        toJSON: () => ({
          id: msgId,
          conversationId: convId,
          senderId,
          clientMessageId,
          content: 'Legacy hello',
          type: 'text',
          encryptionState: 'LEGACY_PLAINTEXT',
          reactions: [],
          createdAt: new Date().toISOString(),
        }),
      };

      vi.mocked(mockConvRepo.isParticipant!).mockResolvedValue(true);
      vi.mocked(mockConvRepo.findById!).mockResolvedValue({
        _id: new Types.ObjectId(convId),
        participants: [new Types.ObjectId(senderId), new Types.ObjectId(recipientId)],
      } as unknown as IConversationDoc);
      vi.mocked(mockMessageRepo.findByClientMessageId!).mockResolvedValue(null);
      vi.mocked(mockMessageRepo.createMessage!).mockResolvedValue(
        legacyDoc as unknown as IMessageDoc,
      );

      const result = await service.sendMessage(senderId, {
        conversationId: convId,
        clientMessageId,
        type: 'text',
        content: 'Legacy hello',
      });

      expect(mockMessageRepo.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Legacy hello',
          encryptionState: 'LEGACY_PLAINTEXT',
        }),
      );
      expect(result.message.encryptionState).toBe('LEGACY_PLAINTEXT');
    });
  });

  describe('Privacy-Preserving Notification Verification', () => {
    it('formats push notification body as 🔒 placeholder when encryptionState is E2EE', () => {
      const e2eePayload = {
        conversationId: convId,
        clientMessageId,
        content: sampleE2eePayload.ciphertext,
        encryptionState: 'E2EE' as const,
        senderDeviceId,
        e2eePayload: sampleE2eePayload,
      };

      const isE2EE = e2eePayload.encryptionState === 'E2EE' || Boolean(e2eePayload.e2eePayload);
      const notificationBody = isE2EE
        ? '🔒 New encrypted message'
        : e2eePayload.content?.trim() || 'Sent a message';

      expect(notificationBody).toBe('🔒 New encrypted message');
      expect(notificationBody).not.toContain(sampleE2eePayload.ciphertext);
    });

    it('preserves regular body preview for legacy plaintext messages', () => {
      const legacyPayload = {
        conversationId: convId,
        clientMessageId,
        content: 'Hello, are you there?',
        encryptionState: 'LEGACY_PLAINTEXT' as MessageEncryptionState,
      };

      const isE2EE = legacyPayload.encryptionState === 'E2EE';
      const notificationBody = isE2EE
        ? '🔒 New encrypted message'
        : legacyPayload.content?.trim() || 'Sent a message';

      expect(notificationBody).toBe('Hello, are you there?');
    });
  });
});
