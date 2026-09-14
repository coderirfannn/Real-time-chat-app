import { sessionManagerService, type SessionManagerService } from './session-manager.service';
import { decryptedCacheService, type DecryptedCacheService } from './decrypted-cache.service';
import { NotificationService } from '../notifications/notification.service';
import type { E2EEEncryptedPayload, MessageEncryptionState } from '@chatlock/shared-types';

export const DECRYPTION_FAILED_PLACEHOLDER = '🔒 Encrypted message (unable to decrypt)';

function extractUserId(sender: unknown): string {
  if (!sender) return '';
  if (typeof sender === 'string') return sender;
  if (typeof sender === 'object') {
    return (
      (sender as { id?: string; _id?: string }).id ||
      (sender as { id?: string; _id?: string })._id ||
      ''
    );
  }
  return String(sender);
}

export class E2EEMessageService {
  constructor(
    private readonly sessionManager: SessionManagerService = sessionManagerService,
    private readonly decryptedCache: DecryptedCacheService = decryptedCacheService,
  ) {}

  /**
   * Encrypts an outbound private message for a recipient device using Double Ratchet.
   * Stores the plaintext locally in decryptedCache so the sender never needs to decrypt their own message.
   */
  public async prepareOutboundMessage(params: {
    peerUserId: string;
    peerDeviceId?: string;
    plaintext: string;
    clientMessageId: string;
    currentUserId: string;
  }): Promise<{
    ciphertext: string;
    e2eePayload: E2EEEncryptedPayload;
    encryptionState: 'E2EE';
    senderDeviceId: string;
  }> {
    const senderDeviceId = await NotificationService.getInstance().getDeviceId();

    // 1. Perform X3DH/Double Ratchet encryption
    const result = await this.sessionManager.encryptMessage(
      params.peerUserId,
      params.peerDeviceId,
      params.plaintext,
      params.currentUserId,
    );

    // 2. Cache the outbound plaintext under clientMessageId
    await this.decryptedCache.set(params.clientMessageId, params.plaintext);

    return {
      ciphertext: result.payload.ciphertext,
      e2eePayload: result.payload,
      encryptionState: 'E2EE',
      senderDeviceId,
    };
  }

  /**
   * Decrypts an inbound message payload using Double Ratchet.
   * Falls back safely to DECRYPTION_FAILED_PLACEHOLDER on any failure.
   */
  public async decryptInboundMessage(params: {
    messageId?: string;
    clientMessageId?: string;
    senderId: unknown;
    senderDeviceId?: string;
    content: string;
    e2eePayload?: E2EEEncryptedPayload;
    encryptionState?: MessageEncryptionState;
    currentUserId?: string;
  }): Promise<string> {
    const senderUserId = extractUserId(params.senderId);

    // 1. Outbound messages from the current user: return local plaintext
    if (params.currentUserId && senderUserId === params.currentUserId) {
      if (params.clientMessageId) {
        const cached = this.decryptedCache.getSync(params.clientMessageId);
        if (cached !== undefined) return cached;
      }
      if (params.messageId) {
        const cached = this.decryptedCache.getSync(params.messageId);
        if (cached !== undefined) return cached;
      }
      return params.content;
    }

    // 2. Legacy plaintext messages
    if (
      params.encryptionState === 'LEGACY_PLAINTEXT' ||
      (!params.e2eePayload && params.encryptionState !== 'E2EE')
    ) {
      return params.content;
    }

    if (!params.e2eePayload) {
      return params.content;
    }

    // 3. Check decrypted cache
    const idKey = params.messageId || params.clientMessageId;
    if (idKey) {
      const cached = await this.decryptedCache.get(idKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    // 4. Resolve sender device ID
    const deviceId =
      params.senderDeviceId || params.e2eePayload.initHeader?.initiatorDeviceId || 'default';

    // 5. Decrypt using Double Ratchet
    try {
      const plaintext = await this.sessionManager.decryptMessage(
        senderUserId,
        deviceId,
        params.e2eePayload,
      );

      // Cache decrypted plaintext for future renders and upward pagination
      if (params.messageId) {
        await this.decryptedCache.set(params.messageId, plaintext, params.clientMessageId);
      } else if (params.clientMessageId) {
        await this.decryptedCache.set(params.clientMessageId, plaintext);
      }

      return plaintext;
    } catch (err) {
      console.warn('[E2EEMessageService] Failed to decrypt E2EE message:', err);
      return DECRYPTION_FAILED_PLACEHOLDER;
    }
  }

  /**
   * Batch decrypts an array of messages (e.g. from history API query).
   */
  public async decryptMessageList<
    T extends {
      id?: string;
      clientMessageId?: string;
      senderId: unknown;
      senderDeviceId?: string;
      content: string;
      e2eePayload?: E2EEEncryptedPayload;
      encryptionState?: MessageEncryptionState;
    },
  >(messages: T[], currentUserId: string): Promise<T[]> {
    const decryptedList: T[] = [];

    for (const msg of messages) {
      if (
        msg.encryptionState === 'E2EE' &&
        msg.e2eePayload &&
        extractUserId(msg.senderId) !== currentUserId
      ) {
        const plaintext = await this.decryptInboundMessage({
          messageId: msg.id,
          clientMessageId: msg.clientMessageId,
          senderId: msg.senderId,
          senderDeviceId: msg.senderDeviceId,
          content: msg.content,
          e2eePayload: msg.e2eePayload,
          encryptionState: msg.encryptionState,
          currentUserId,
        });
        decryptedList.push({ ...msg, content: plaintext });
      } else {
        decryptedList.push(msg);
      }
    }

    return decryptedList;
  }
}

export const e2eeMessageService = new E2EEMessageService();
