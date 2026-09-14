import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManagerService } from '../../services/crypto/session-manager.service';
import { CryptoService } from '../../services/crypto/crypto.service';
import { DeviceKeyStore } from '../../services/crypto/device-key-store';
import { SessionStore } from '../../services/crypto/session-store';
import { E2EEApi } from '../../services/api/e2ee.api';
import { NotificationService } from '../../services/notifications/notification.service';
import type { PublicDeviceKeyBundle } from '@chatlock/shared-types';

describe('SessionManagerService End-to-End Handshake & Lifecycle', () => {
  let crypto: CryptoService;

  // Alice's subsystem
  let aliceKeyStore: DeviceKeyStore;
  let aliceSessionStore: SessionStore;
  let aliceApi: E2EEApi;
  let aliceSessionManager: SessionManagerService;

  // Bob's subsystem
  let bobKeyStore: DeviceKeyStore;
  let bobSessionStore: SessionStore;
  let bobSessionManager: SessionManagerService;

  const aliceUserId = 'user_alice_123';
  const aliceDeviceId = 'dev_alice_hardware_1';

  const bobUserId = 'user_bob_456';
  const bobDeviceId = 'dev_bob_hardware_2';

  beforeEach(async () => {
    vi.restoreAllMocks();

    crypto = new CryptoService();

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

    // Populate Alice's local keys
    const aliceIdentity = crypto.generateIdentityKeyPair();
    await aliceKeyStore.saveIdentityKeyPair(aliceIdentity);

    // Populate Bob's local keys
    const bobIdentity = crypto.generateIdentityKeyPair();
    const bobSpk = crypto.generateSignedPreKey(bobIdentity.privateKey, 1, 30);
    const bobOpks = crypto.generateOneTimePreKeys(1, 10);
    await bobKeyStore.saveIdentityKeyPair(bobIdentity);
    await bobKeyStore.saveSignedPreKey(bobSpk);
    await bobKeyStore.saveOneTimePreKeys(bobOpks);

    // Default mock deviceId
    vi.spyOn(NotificationService.getInstance(), 'getDeviceId').mockResolvedValue(aliceDeviceId);

    aliceSessionManager = new SessionManagerService(
      crypto,
      aliceKeyStore,
      aliceSessionStore,
      aliceApi,
    );

    bobSessionManager = new SessionManagerService(
      crypto,
      bobKeyStore,
      bobSessionStore,
      new E2EEApi(),
    );
  });

  it('completes full X3DH session handshake: Alice and Bob derive the EXACT same shared secret', async () => {
    const bobIdentity = (await bobKeyStore.getIdentityKeyPair())!;
    const bobSpk = (await bobKeyStore.getSignedPreKey())!;
    const bobOpk = (await bobKeyStore.getOneTimePreKey(1))!;

    // 1. Mock Server Key Registry returning Bob's public bundle
    const mockBobBundle: PublicDeviceKeyBundle = {
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

    vi.spyOn(aliceApi, 'getPeerBundle').mockResolvedValue(mockBobBundle);

    // 2. Alice establishes outbound session with Bob
    const { session: aliceSession, initHeader } =
      await aliceSessionManager.getOrEstablishOutboundSession(bobUserId, bobDeviceId, aliceUserId);

    expect(aliceSession).toBeDefined();
    expect(aliceSession.role).toBe('initiator');
    expect(aliceSession.status).toBe('ACTIVE');
    expect(initHeader.initiatorUserId).toBe(aliceUserId);
    expect(initHeader.spkKeyId).toBe(1);
    expect(initHeader.opkKeyId).toBe(1);

    // 3. Bob receives Alice's X3DH header and establishes inbound session
    const bobSession = await bobSessionManager.establishInboundSession(initHeader);

    expect(bobSession).toBeDefined();
    expect(bobSession.role).toBe('receiver');
    expect(bobSession.status).toBe('ACTIVE');

    // 4. CRITICAL: Alice and Bob have derived the EXACT same master shared secret!
    expect(aliceSession.sharedSecret).toBe(bobSession.sharedSecret);

    // 5. Bob has consumed OPK 1 (marked consumed locally)
    const consumedOpk = await bobKeyStore.getOneTimePreKey(1);
    expect(consumedOpk).toBeNull();
  });

  it('rejects session establishment if peer device is marked REVOKED', async () => {
    vi.spyOn(aliceApi, 'getPeerBundle').mockResolvedValue({
      userId: bobUserId,
      deviceId: bobDeviceId,
      identityKey: 'key',
      signedPreKey: {
        keyId: 1,
        publicKey: 'pub',
        signature: 'sig',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      },
      oneTimePreKey: null,
      keyVersion: 1,
      deviceStatus: 'REVOKED', // Revoked device
    });

    await expect(
      aliceSessionManager.getOrEstablishOutboundSession(bobUserId, bobDeviceId, aliceUserId),
    ).rejects.toThrow('Cannot establish E2EE session: Recipient device is REVOKED');
  });

  it('rejects session establishment if Signed Pre-Key signature is invalid', async () => {
    const bobIdentity = (await bobKeyStore.getIdentityKeyPair())!;
    const bobSpk = (await bobKeyStore.getSignedPreKey())!;

    vi.spyOn(aliceApi, 'getPeerBundle').mockResolvedValue({
      userId: bobUserId,
      deviceId: bobDeviceId,
      identityKey: bobIdentity.publicKey,
      signedPreKey: {
        keyId: bobSpk.keyId,
        publicKey: bobSpk.publicKey,
        signature: Buffer.alloc(64, 0).toString('base64'), // Forged signature
        createdAt: bobSpk.createdAt,
        expiresAt: bobSpk.expiresAt,
      },
      oneTimePreKey: null,
      keyVersion: 1,
      deviceStatus: 'ACTIVE',
    });

    await expect(
      aliceSessionManager.getOrEstablishOutboundSession(bobUserId, bobDeviceId, aliceUserId),
    ).rejects.toThrow('E2EE Security Alert: Invalid Signed Pre-Key signature from peer');
  });

  it('rejects inbound session establishment when One-Time Pre-Key was already consumed', async () => {
    const bobIdentity = (await bobKeyStore.getIdentityKeyPair())!;
    const bobSpk = (await bobKeyStore.getSignedPreKey())!;
    const bobOpk = (await bobKeyStore.getOneTimePreKey(1))!;

    const mockBobBundle: PublicDeviceKeyBundle = {
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

    vi.spyOn(aliceApi, 'getPeerBundle').mockResolvedValue(mockBobBundle);

    const { initHeader } = await aliceSessionManager.getOrEstablishOutboundSession(
      bobUserId,
      bobDeviceId,
      aliceUserId,
    );

    // Consume Bob's OPK 1 beforehand
    await bobKeyStore.markOneTimePreKeyUsed(1);

    // Bob attempts to establish session with already consumed OPK
    await expect(bobSessionManager.establishInboundSession(initHeader)).rejects.toThrow(
      'already consumed or expired',
    );
  });

  it('handles session invalidation and expiration check cleanly', async () => {
    const bobIdentity = (await bobKeyStore.getIdentityKeyPair())!;
    const bobSpk = (await bobKeyStore.getSignedPreKey())!;

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
      oneTimePreKey: null,
      keyVersion: 1,
      deviceStatus: 'ACTIVE',
    });

    const { session } = await aliceSessionManager.getOrEstablishOutboundSession(
      bobUserId,
      bobDeviceId,
      aliceUserId,
    );

    expect(aliceSessionManager.isSessionExpired(session)).toBe(false);

    // Invalidate session
    await aliceSessionManager.invalidateSession(bobUserId, bobDeviceId);

    const active = await aliceSessionStore.getActiveSession(bobUserId, bobDeviceId);
    expect(active).toBeNull();
  });
});
