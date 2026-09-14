import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  E2EEMessageService,
  DECRYPTION_FAILED_PLACEHOLDER,
} from '../../services/crypto/e2ee-message.service';
import {
  DecryptedCacheService,
  decryptedCacheService,
} from '../../services/crypto/decrypted-cache.service';
import { reconcileChatMessages } from '../../utils/message-reconciler';
import type { SessionManagerService } from '../../services/crypto/session-manager.service';
import type { E2EEEncryptedPayload, IMessage } from '@chatlock/shared-types';

describe('E2EE Chat Pipeline Client Integration Tests', () => {
  let mockSessionManager: Partial<SessionManagerService>;
  let cache: DecryptedCacheService;
  let e2eeService: E2EEMessageService;

  const currentUserId = 'user_alice';
  const peerUserId = 'user_bob';
  const clientMessageId = 'c_alice_001';
  const serverMessageId = 'srv_msg_999';
  const plaintext = 'Secret rendezvous at dawn';

  const mockPayload: E2EEEncryptedPayload = {
    version: 1,
    sessionId: `${peerUserId}:dev_bob_1`,
    header: {
      ratchetKey: 'pub_ratchet_key_1',
      pn: 0,
      n: 0,
    },
    ciphertext: 'encrypted_base64_ciphertext_bytes==',
    isPreKeyInit: true,
    initHeader: {
      initiatorUserId: currentUserId,
      initiatorDeviceId: 'dev_alice_1',
      initiatorIdentityKey: 'ik_alice',
      ephemeralPublicKey: 'ek_alice',
      spkKeyId: 1,
      opkKeyId: 10,
      sessionVersion: 1,
      timestamp: new Date().toISOString(),
    },
  };

  beforeEach(() => {
    cache = new DecryptedCacheService({
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    });

    mockSessionManager = {
      encryptMessage: vi.fn().mockResolvedValue({
        payload: mockPayload,
        isNewSession: true,
        initHeader: mockPayload.initHeader,
      }),
      decryptMessage: vi.fn().mockResolvedValue(plaintext),
    };

    e2eeService = new E2EEMessageService(mockSessionManager as SessionManagerService, cache);
  });

  describe('Outbound Message Encryption', () => {
    it('encrypts outbound plaintext into ciphertext and caches local plaintext for 0ms UI', async () => {
      const result = await e2eeService.prepareOutboundMessage({
        peerUserId,
        plaintext,
        clientMessageId,
        currentUserId,
      });

      // 1. Double Ratchet was called
      expect(mockSessionManager.encryptMessage).toHaveBeenCalledWith(
        peerUserId,
        undefined,
        plaintext,
        currentUserId,
      );

      // 2. Ciphertext and metadata returned for network dispatch
      expect(result.ciphertext).toBe(mockPayload.ciphertext);
      expect(result.encryptionState).toBe('E2EE');
      expect(result.e2eePayload).toEqual(mockPayload);

      // 3. Plaintext is cached under clientMessageId
      expect(cache.getSync(clientMessageId)).toBe(plaintext);
    });

    it('returns cached plaintext for outbound messages from the sender without ratcheting', async () => {
      // Pre-seed cache as if sent locally
      await cache.set(clientMessageId, plaintext);

      const resolved = await e2eeService.decryptInboundMessage({
        messageId: serverMessageId,
        clientMessageId,
        senderId: currentUserId,
        content: mockPayload.ciphertext,
        e2eePayload: mockPayload,
        encryptionState: 'E2EE',
        currentUserId,
      });

      expect(resolved).toBe(plaintext);
      expect(mockSessionManager.decryptMessage).not.toHaveBeenCalled();
    });
  });

  describe('Inbound Message Decryption', () => {
    it('decrypts inbound E2EE message and caches plaintext to prevent key re-consumption', async () => {
      const inboundPayload: E2EEEncryptedPayload = {
        ...mockPayload,
        ciphertext: 'incoming_encrypted_secret==',
      };
      vi.mocked(mockSessionManager.decryptMessage!).mockResolvedValue('Hello from Bob');

      // First decryption call
      const firstResult = await e2eeService.decryptInboundMessage({
        messageId: serverMessageId,
        clientMessageId: 'c_bob_42',
        senderId: peerUserId,
        senderDeviceId: 'dev_bob_1',
        content: inboundPayload.ciphertext,
        e2eePayload: inboundPayload,
        encryptionState: 'E2EE',
        currentUserId,
      });

      expect(firstResult).toBe('Hello from Bob');
      expect(mockSessionManager.decryptMessage).toHaveBeenCalledTimes(1);

      // Second decryption call (e.g. scroll up / re-render)
      const secondResult = await e2eeService.decryptInboundMessage({
        messageId: serverMessageId,
        clientMessageId: 'c_bob_42',
        senderId: peerUserId,
        senderDeviceId: 'dev_bob_1',
        content: inboundPayload.ciphertext,
        e2eePayload: inboundPayload,
        encryptionState: 'E2EE',
        currentUserId,
      });

      expect(secondResult).toBe('Hello from Bob');
      // Must NOT invoke Double Ratchet again, avoiding consumed key errors
      expect(mockSessionManager.decryptMessage).toHaveBeenCalledTimes(1);
    });

    it('gracefully degrades to DECRYPTION_FAILED_PLACEHOLDER on decryption failure', async () => {
      vi.mocked(mockSessionManager.decryptMessage!).mockRejectedValue(
        new Error('MAC verification failed: ciphertext tampered'),
      );

      const result = await e2eeService.decryptInboundMessage({
        messageId: 'srv_corrupted_1',
        senderId: peerUserId,
        senderDeviceId: 'dev_bob_1',
        content: 'corrupted_ciphertext==',
        e2eePayload: mockPayload,
        encryptionState: 'E2EE',
        currentUserId,
      });

      expect(result).toBe(DECRYPTION_FAILED_PLACEHOLDER);
      expect(result).toBe('🔒 Encrypted message (unable to decrypt)');
    });

    it('returns raw content for legacy plaintext messages without crypto overhead', async () => {
      const legacyText = 'This is an unencrypted legacy message';

      const result = await e2eeService.decryptInboundMessage({
        messageId: 'srv_legacy_1',
        senderId: peerUserId,
        content: legacyText,
        encryptionState: 'LEGACY_PLAINTEXT',
        currentUserId,
      });

      expect(result).toBe(legacyText);
      expect(mockSessionManager.decryptMessage).not.toHaveBeenCalled();
    });
  });

  describe('Reconciler Plaintext Preservation', () => {
    it('preserves cached plaintext when merging history pages with optimistic messages', () => {
      // Pre-seed cache with decrypted message
      decryptedCacheService.setSync('srv_history_1', 'Decrypted confidential plan');

      const historyMsg: IMessage = {
        id: 'srv_history_1',
        conversationId: 'conv_1',
        senderId: peerUserId,
        clientMessageId: 'c_peer_hist',
        content: 'cipher_on_server_raw_bytes==',
        type: 'text',
        encryptionState: 'E2EE',
        status: 'delivered',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
        isEdited: false,
        isDeleted: false,
      };

      const reconciled = reconcileChatMessages({
        historyPages: [{ messages: [historyMsg] }],
      });

      expect(reconciled).toHaveLength(1);
      expect(reconciled[0]?.content).toBe('Decrypted confidential plan');
      expect(reconciled[0]?.isEncrypted).toBe(true);
    });
  });
});
