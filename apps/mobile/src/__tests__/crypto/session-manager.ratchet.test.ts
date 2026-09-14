import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManagerService } from '../../services/crypto/session-manager.service';
import { CryptoService } from '../../services/crypto/crypto.service';
import { DeviceKeyStore } from '../../services/crypto/device-key-store';
import { SessionStore } from '../../services/crypto/session-store';
import {
  DoubleRatchetService,
  E2EEDecryptionError,
} from '../../services/crypto/double-ratchet.service';
import { E2EEApi } from '../../services/api/e2ee.api';
import { NotificationService } from '../../services/notifications/notification.service';
import { OutboxService } from '../../services/outbox/outbox.service';
import type { PublicDeviceKeyBundle } from '@chatlock/shared-types';
import type { OutboxMessage } from '../../types/chat.types';

describe('SessionManagerService Double Ratchet End-to-End & Lifecycle', () => {
  let crypto: CryptoService;
  let ratchet: DoubleRatchetService;

  // Alice's subsystem
  let aliceKeyStore: DeviceKeyStore;
  let aliceSessionStore: SessionStore;
  let aliceApi: E2EEApi;
  let aliceSessionManager: SessionManagerService;

  // Bob's subsystem
  let bobKeyStore: DeviceKeyStore;
  let bobSessionStore: SessionStore;
  let bobSessionManager: SessionManagerService;

  const aliceUserId = 'user_alice_ratchet';
  const aliceDeviceId = 'dev_alice_hardware_1';

  const bobUserId = 'user_bob_ratchet';
  const bobDeviceId = 'dev_bob_hardware_2';

  beforeEach(async () => {
    vi.restoreAllMocks();

    crypto = new CryptoService();
    ratchet = new DoubleRatchetService();

    // Setup Alice
    aliceKeyStore = new DeviceKeyStore();
    await aliceKeyStore.clearAllKeys();
    aliceSessionStore = new SessionStore();
    await aliceSessionStore.clearAllSessions();
    aliceApi = new E2EEApi();

    // Setup Bob
    bobKeyStore = new DeviceKeyStore();
    await bobKeyStore.clearAllKeys();
    bobSessionStore = new SessionStore();
    await bobSessionStore.clearAllSessions();

    // Generate Alice local identity
    const aliceIdentity = crypto.generateIdentityKeyPair();
    await aliceKeyStore.saveIdentityKeyPair(aliceIdentity);

    // Generate Bob local keys
    const bobIdentity = crypto.generateIdentityKeyPair();
    const bobSpk = crypto.generateSignedPreKey(bobIdentity.privateKey, 1, 30);
    const bobOpks = crypto.generateOneTimePreKeys(1, 10);
    await bobKeyStore.saveIdentityKeyPair(bobIdentity);
    await bobKeyStore.saveSignedPreKey(bobSpk);
    await bobKeyStore.saveOneTimePreKeys(bobOpks);

    // Mock NotificationService device ID
    vi.spyOn(NotificationService.getInstance(), 'getDeviceId').mockResolvedValue(aliceDeviceId);

    aliceSessionManager = new SessionManagerService(
      crypto,
      aliceKeyStore,
      aliceSessionStore,
      aliceApi,
      ratchet,
    );

    bobSessionManager = new SessionManagerService(
      crypto,
      bobKeyStore,
      bobSessionStore,
      new E2EEApi(),
      ratchet,
    );
  });

  it('1. End-to-end conversation: Alice encrypts outbound, Bob decrypts, Bob replies, Alice decrypts', async () => {
    const bobIdentity = (await bobKeyStore.getIdentityKeyPair())!;
    const bobSpk = (await bobKeyStore.getSignedPreKey())!;
    const bobOpk = (await bobKeyStore.getOneTimePreKey(1))!;

    const bundle: PublicDeviceKeyBundle = {
      userId: bobUserId,
      deviceId: bobDeviceId,
      identityKey: bobIdentity.publicKey,
      signedPreKey: {
        keyId: bobSpk.keyId,
        publicKey: bobSpk.publicKey,
        signature: bobSpk.signature,
        createdAt: bobSpk.createdAt,
        expiresAt: bobSpk.expiresAt,
      },
      oneTimePreKey: {
        keyId: bobOpk.keyId,
        publicKey: bobOpk.publicKey,
      },
      keyVersion: 1,
      deviceStatus: 'ACTIVE',
    };

    vi.spyOn(aliceApi, 'getPeerBundle').mockResolvedValue(bundle);

    // --- TURN 1: Alice -> Bob ---
    const alicePlaintext = 'Hello Bob, this message is Double Ratchet encrypted!';
    const { payload: encPayload1, isNewSession } = await aliceSessionManager.encryptMessage(
      bobUserId,
      bobDeviceId,
      alicePlaintext,
      aliceUserId,
    );

    expect(isNewSession).toBe(true);
    expect(encPayload1.isPreKeyInit).toBe(true);
    expect(encPayload1.initHeader).toBeDefined();
    expect(encPayload1.header.n).toBe(0);

    // Bob receives and decrypts message
    const bobDecrypted1 = await bobSessionManager.decryptMessage(
      aliceUserId,
      aliceDeviceId,
      encPayload1,
    );
    expect(bobDecrypted1).toBe(alicePlaintext);

    // --- TURN 2: Bob -> Alice ---
    const bobPlaintext = 'Hello Alice! Decrypted your message successfully!';
    const { payload: encPayload2 } = await bobSessionManager.encryptMessage(
      aliceUserId,
      aliceDeviceId,
      bobPlaintext,
      bobUserId,
    );

    expect(encPayload2.header.n).toBe(0);

    // Alice decrypts Bob's reply
    const aliceDecrypted2 = await aliceSessionManager.decryptMessage(
      bobUserId,
      bobDeviceId,
      encPayload2,
    );
    expect(aliceDecrypted2).toBe(bobPlaintext);

    // --- TURN 3: Alice -> Bob again ---
    const alicePlaintext2 = 'Great! Perfect forward secrecy is working.';
    const { payload: encPayload3 } = await aliceSessionManager.encryptMessage(
      bobUserId,
      bobDeviceId,
      alicePlaintext2,
      aliceUserId,
    );

    const bobDecrypted3 = await bobSessionManager.decryptMessage(
      aliceUserId,
      aliceDeviceId,
      encPayload3,
    );
    expect(bobDecrypted3).toBe(alicePlaintext2);
  });

  it('2. Offline Outbox Simulation: Queued encrypted message persists and decrypts on delivery', async () => {
    const bobIdentity = (await bobKeyStore.getIdentityKeyPair())!;
    const bobSpk = (await bobKeyStore.getSignedPreKey())!;
    const bobOpk = (await bobKeyStore.getOneTimePreKey(1))!;

    vi.spyOn(aliceApi, 'getPeerBundle').mockResolvedValue({
      userId: bobUserId,
      deviceId: bobDeviceId,
      identityKey: bobIdentity.publicKey,
      signedPreKey: {
        keyId: bobSpk.keyId,
        publicKey: bobSpk.publicKey,
        signature: bobSpk.signature,
        createdAt: bobSpk.createdAt,
        expiresAt: bobSpk.expiresAt,
      },
      oneTimePreKey: {
        keyId: bobOpk.keyId,
        publicKey: bobOpk.publicKey,
      },
      keyVersion: 1,
      deviceStatus: 'ACTIVE',
    });

    // 1. Alice encrypts message offline
    const secretText = 'Offline outbox encrypted message payload';
    const { payload } = await aliceSessionManager.encryptMessage(
      bobUserId,
      bobDeviceId,
      secretText,
      aliceUserId,
    );

    // 2. Enqueue into OutboxService
    const outbox = OutboxService.getInstance();
    const outboxItem: OutboxMessage = {
      clientMessageId: 'outbox_msg_101',
      conversationId: 'conv_123',
      senderId: aliceUserId,
      content: payload.ciphertext,
      isEncrypted: true,
      e2eePayload: payload,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempts: 0,
      retryPayload: {
        conversationId: 'conv_123',
        content: payload.ciphertext,
        clientMessageId: 'outbox_msg_101',
        e2eePayload: payload,
      },
    };

    await outbox.enqueue(outboxItem);

    // 3. Verify outbox retrieval
    const pending = await outbox.getConversationPending('conv_123');
    expect(pending.length).toBeGreaterThan(0);
    const queuedItem = pending.find((m) => m.clientMessageId === 'outbox_msg_101');
    expect(queuedItem?.e2eePayload).toBeDefined();

    // 4. Bob receives the dequeued payload and decrypts cleanly
    const decrypted = await bobSessionManager.decryptMessage(
      aliceUserId,
      aliceDeviceId,
      queuedItem!.e2eePayload!,
    );
    expect(decrypted).toBe(secretText);

    // 5. Cleanup outbox
    await outbox.dequeue('outbox_msg_101');
  });

  it('3. Rejects tampered ciphertext with E2EEDecryptionError', async () => {
    const bobIdentity = (await bobKeyStore.getIdentityKeyPair())!;
    const bobSpk = (await bobKeyStore.getSignedPreKey())!;
    const bobOpk = (await bobKeyStore.getOneTimePreKey(1))!;

    vi.spyOn(aliceApi, 'getPeerBundle').mockResolvedValue({
      userId: bobUserId,
      deviceId: bobDeviceId,
      identityKey: bobIdentity.publicKey,
      signedPreKey: {
        keyId: bobSpk.keyId,
        publicKey: bobSpk.publicKey,
        signature: bobSpk.signature,
        createdAt: bobSpk.createdAt,
        expiresAt: bobSpk.expiresAt,
      },
      oneTimePreKey: {
        keyId: bobOpk.keyId,
        publicKey: bobOpk.publicKey,
      },
      keyVersion: 1,
      deviceStatus: 'ACTIVE',
    });

    const { payload } = await aliceSessionManager.encryptMessage(
      bobUserId,
      bobDeviceId,
      'Confidential document',
      aliceUserId,
    );

    // Tamper ciphertext
    const tamperedPayload = {
      ...payload,
      ciphertext: payload.ciphertext.slice(0, -4) + 'AAAA',
    };

    await expect(
      bobSessionManager.decryptMessage(aliceUserId, aliceDeviceId, tamperedPayload),
    ).rejects.toThrow(E2EEDecryptionError);
  });

  it('4. Session Rotation: rotateSession establishes a fresh session', async () => {
    const bobIdentity = (await bobKeyStore.getIdentityKeyPair())!;
    const bobSpk = (await bobKeyStore.getSignedPreKey())!;
    const bobOpk = (await bobKeyStore.getOneTimePreKey(1))!;

    vi.spyOn(aliceApi, 'getPeerBundle').mockResolvedValue({
      userId: bobUserId,
      deviceId: bobDeviceId,
      identityKey: bobIdentity.publicKey,
      signedPreKey: {
        keyId: bobSpk.keyId,
        publicKey: bobSpk.publicKey,
        signature: bobSpk.signature,
        createdAt: bobSpk.createdAt,
        expiresAt: bobSpk.expiresAt,
      },
      oneTimePreKey: {
        keyId: bobOpk.keyId,
        publicKey: bobOpk.publicKey,
      },
      keyVersion: 1,
      deviceStatus: 'ACTIVE',
    });

    // 1. Initial exchange
    const { payload: p1 } = await aliceSessionManager.encryptMessage(
      bobUserId,
      bobDeviceId,
      'Pre-rotation message',
      aliceUserId,
    );
    await bobSessionManager.decryptMessage(aliceUserId, aliceDeviceId, p1);

    // 2. Rotate session
    const { session: newSession } = await aliceSessionManager.rotateSession(bobUserId, bobDeviceId);
    expect(newSession.status).toBe('ACTIVE');

    // 3. Encrypt post-rotation
    const { payload: p2 } = await aliceSessionManager.encryptMessage(
      bobUserId,
      bobDeviceId,
      'Post-rotation message',
      aliceUserId,
    );
    expect(p2.header.n).toBe(0);
  });

  it('5. Device Revocation: Refuses session establishment if peer device is REVOKED', async () => {
    vi.spyOn(aliceApi, 'getPeerBundle').mockResolvedValue({
      userId: bobUserId,
      deviceId: bobDeviceId,
      identityKey: 'someKey',
      signedPreKey: {
        keyId: 1,
        publicKey: 'spk',
        signature: 'sig',
        createdAt: '',
        expiresAt: '',
      },
      oneTimePreKey: null,
      keyVersion: 1,
      deviceStatus: 'REVOKED',
    });

    await expect(
      aliceSessionManager.encryptMessage(
        bobUserId,
        bobDeviceId,
        'Hello to revoked device',
        aliceUserId,
      ),
    ).rejects.toThrow(/Recipient device is REVOKED/);
  });
});
