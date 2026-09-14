import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { createApp } from '../../app.js';
import { deviceKeyRepository } from '../../repositories/device-key.repository.js';
import { signAccessToken } from '../../utils/token.js';
import type { IDeviceKeyBundleDoc } from '../../models/device-key.model.js';

describe('E2EE Server Key Registry & Security Tests (/api/v1/e2ee/*)', () => {
  const app = createApp();

  const userAliceId = '507f1f77bcf86cd799439011';
  const userBobId = '507f1f77bcf86cd799439022';
  const deviceAlice = 'dev_alice_hardware_1';

  const { token: aliceToken } = signAccessToken({
    sub: userAliceId,
    email: 'alice@chatlock.dev',
    username: 'alice',
    role: 'USER',
  });

  const { token: bobToken } = signAccessToken({
    sub: userBobId,
    email: 'bob@chatlock.dev',
    username: 'bob',
    role: 'USER',
  });

  // Generate authentic cryptographic material for test suite
  const aliceIdPriv = ed25519.utils.randomSecretKey();
  const aliceIdPub = ed25519.getPublicKey(aliceIdPriv);
  const aliceIdPubB64 = Buffer.from(aliceIdPub).toString('base64');

  const aliceSpkPriv = x25519.utils.randomSecretKey();
  const aliceSpkPub = x25519.getPublicKey(aliceSpkPriv);
  const aliceSpkPubB64 = Buffer.from(aliceSpkPub).toString('base64');
  const aliceSpkSig = ed25519.sign(aliceSpkPub, aliceIdPriv);
  const aliceSpkSigB64 = Buffer.from(aliceSpkSig).toString('base64');

  const opk1Pub = Buffer.from(x25519.getPublicKey(x25519.utils.randomSecretKey())).toString(
    'base64',
  );
  const opk2Pub = Buffer.from(x25519.getPublicKey(x25519.utils.randomSecretKey())).toString(
    'base64',
  );

  let inMemoryOpks: { keyId: number; publicKey: string; consumed: boolean }[];
  let isRevoked = false;

  beforeEach(() => {
    vi.restoreAllMocks();
    isRevoked = false;
    inMemoryOpks = [
      { keyId: 1, publicKey: opk1Pub, consumed: false },
      { keyId: 2, publicKey: opk2Pub, consumed: false },
    ];
  });

  describe('POST /api/v1/e2ee/keys/register', () => {
    it('successfully registers valid key bundle with verified cryptographic signature', async () => {
      const mockBundleDoc: Partial<IDeviceKeyBundleDoc> = {
        deviceId: deviceAlice,
        identityKey: aliceIdPubB64,
        signedPreKey: {
          keyId: 1,
          publicKey: aliceSpkPubB64,
          signature: aliceSpkSigB64,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 86400000),
        },
        oneTimePreKeys: inMemoryOpks,
        keyVersion: 1,
        status: 'ACTIVE',
      };

      vi.spyOn(deviceKeyRepository, 'upsertKeyBundle').mockResolvedValue(
        mockBundleDoc as IDeviceKeyBundleDoc,
      );

      const res = await request(app)
        .post('/api/v1/e2ee/keys/register')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          deviceId: deviceAlice,
          identityKey: aliceIdPubB64,
          signedPreKey: {
            keyId: 1,
            publicKey: aliceSpkPubB64,
            signature: aliceSpkSigB64,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          },
          oneTimePreKeys: [
            { keyId: 1, publicKey: opk1Pub },
            { keyId: 2, publicKey: opk2Pub },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deviceId).toBe(deviceAlice);
      expect(res.body.data.identityKey).toBe(aliceIdPubB64);
      expect(res.body.data.signedPreKey.publicKey).toBe(aliceSpkPubB64);

      // Verify zero leakage of private keys in API response
      expect(JSON.stringify(res.body)).not.toContain('privateKey');
    });

    it('rejects unauthenticated key registration request with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/e2ee/keys/register')
        .send({
          deviceId: deviceAlice,
          identityKey: aliceIdPubB64,
          signedPreKey: {
            keyId: 1,
            publicKey: aliceSpkPubB64,
            signature: aliceSpkSigB64,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          },
          oneTimePreKeys: [{ keyId: 1, publicKey: opk1Pub }],
        });

      expect(res.status).toBe(401);
    });

    it('rejects registration when signature is forged or invalid with 400 Bad Request', async () => {
      // Fake signature of 64 zero bytes
      const forgedSig = Buffer.alloc(64, 0).toString('base64');

      const res = await request(app)
        .post('/api/v1/e2ee/keys/register')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          deviceId: deviceAlice,
          identityKey: aliceIdPubB64,
          signedPreKey: {
            keyId: 1,
            publicKey: aliceSpkPubB64,
            signature: forgedSig,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          },
          oneTimePreKeys: [{ keyId: 1, publicKey: opk1Pub }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid signed pre-key signature');
    });

    it('rejects registration when signed pre-key expiration is in the past', async () => {
      const res = await request(app)
        .post('/api/v1/e2ee/keys/register')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          deviceId: deviceAlice,
          identityKey: aliceIdPubB64,
          signedPreKey: {
            keyId: 1,
            publicKey: aliceSpkPubB64,
            signature: aliceSpkSigB64,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() - 10000).toISOString(), // expired
          },
          oneTimePreKeys: [{ keyId: 1, publicKey: opk1Pub }],
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/e2ee/keys/:userId (Peer Bundle Retrieval & Atomic OPK Claim)', () => {
    it('returns peer public bundle and atomically claims exactly one OPK', async () => {
      const mockBundleDoc: Partial<IDeviceKeyBundleDoc> = {
        deviceId: deviceAlice,
        identityKey: aliceIdPubB64,
        signedPreKey: {
          keyId: 1,
          publicKey: aliceSpkPubB64,
          signature: aliceSpkSigB64,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 86400000),
        },
        oneTimePreKeys: inMemoryOpks,
        keyVersion: 1,
        status: 'ACTIVE',
      };

      vi.spyOn(deviceKeyRepository, 'findActiveDevicesForUser').mockResolvedValue([
        mockBundleDoc as IDeviceKeyBundleDoc,
      ]);
      vi.spyOn(deviceKeyRepository, 'findActiveByUserAndDevice').mockResolvedValue(
        mockBundleDoc as IDeviceKeyBundleDoc,
      );

      vi.spyOn(deviceKeyRepository, 'claimOneTimePreKey').mockImplementation(async () => {
        const unconsumed = inMemoryOpks.find((k) => !k.consumed);
        if (!unconsumed) return null;
        unconsumed.consumed = true;
        return {
          keyId: unconsumed.keyId,
          publicKey: unconsumed.publicKey,
          consumed: true,
        };
      });

      // Request 1: Claims OPK 1
      const res1 = await request(app)
        .get(`/api/v1/e2ee/keys/${userAliceId}`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res1.status).toBe(200);
      expect(res1.body.data.oneTimePreKey?.keyId).toBe(1);

      // Request 2: Claims OPK 2 (atomic no double-spending)
      const res2 = await request(app)
        .get(`/api/v1/e2ee/keys/${userAliceId}`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.data.oneTimePreKey?.keyId).toBe(2);

      // Request 3: Pool depleted -> gracefully returns null oneTimePreKey
      const res3 = await request(app)
        .get(`/api/v1/e2ee/keys/${userAliceId}`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res3.status).toBe(200);
      expect(res3.body.data.oneTimePreKey).toBeNull();
      expect(res3.body.data.signedPreKey.publicKey).toBe(aliceSpkPubB64);
    });

    it('returns 404 when target user has no active cryptographic devices', async () => {
      vi.spyOn(deviceKeyRepository, 'findActiveDevicesForUser').mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/v1/e2ee/keys/${userAliceId}`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/e2ee/prekeys/replenish', () => {
    it('replenishes pool of one-time pre-keys for user device', async () => {
      const mockBundleDoc: Partial<IDeviceKeyBundleDoc> = {
        deviceId: deviceAlice,
        status: 'ACTIVE',
      };

      vi.spyOn(deviceKeyRepository, 'findActiveByUserAndDevice').mockResolvedValue(
        mockBundleDoc as IDeviceKeyBundleDoc,
      );
      vi.spyOn(deviceKeyRepository, 'replenishPreKeys').mockResolvedValue(25);

      const newOpk = Buffer.from(x25519.getPublicKey(x25519.utils.randomSecretKey())).toString(
        'base64',
      );

      const res = await request(app)
        .post('/api/v1/e2ee/prekeys/replenish')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          deviceId: deviceAlice,
          oneTimePreKeys: [{ keyId: 10, publicKey: newOpk }],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.replenished).toBe(1);
      expect(res.body.data.totalUnconsumed).toBe(25);
    });
  });

  describe('POST /api/v1/e2ee/signed-prekey/rotate', () => {
    it('rotates signed pre-key when signature verifies against existing identity key', async () => {
      const mockBundleDoc: Partial<IDeviceKeyBundleDoc> = {
        deviceId: deviceAlice,
        identityKey: aliceIdPubB64,
        status: 'ACTIVE',
      };

      vi.spyOn(deviceKeyRepository, 'findActiveByUserAndDevice').mockResolvedValue(
        mockBundleDoc as IDeviceKeyBundleDoc,
      );
      vi.spyOn(deviceKeyRepository, 'rotateSignedPreKey').mockResolvedValue(
        mockBundleDoc as IDeviceKeyBundleDoc,
      );

      const nextSpkPriv = x25519.utils.randomSecretKey();
      const nextSpkPub = x25519.getPublicKey(nextSpkPriv);
      const nextSpkPubB64 = Buffer.from(nextSpkPub).toString('base64');
      const nextSig = ed25519.sign(nextSpkPub, aliceIdPriv);
      const nextSigB64 = Buffer.from(nextSig).toString('base64');

      const res = await request(app)
        .post('/api/v1/e2ee/signed-prekey/rotate')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          deviceId: deviceAlice,
          signedPreKey: {
            keyId: 2,
            publicKey: nextSpkPubB64,
            signature: nextSigB64,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.rotated).toBe(true);
    });

    it('rejects signed pre-key rotation if signature fails verification', async () => {
      const mockBundleDoc: Partial<IDeviceKeyBundleDoc> = {
        deviceId: deviceAlice,
        identityKey: aliceIdPubB64,
        status: 'ACTIVE',
      };

      vi.spyOn(deviceKeyRepository, 'findActiveByUserAndDevice').mockResolvedValue(
        mockBundleDoc as IDeviceKeyBundleDoc,
      );

      const forgedSig = Buffer.alloc(64, 0).toString('base64');

      const res = await request(app)
        .post('/api/v1/e2ee/signed-prekey/rotate')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          deviceId: deviceAlice,
          signedPreKey: {
            keyId: 2,
            publicKey: aliceSpkPubB64,
            signature: forgedSig,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid signed pre-key signature');
    });
  });

  describe('PATCH /api/v1/e2ee/devices/:deviceId/revoke & GET /devices/me', () => {
    it('revokes a device and marks status REVOKED', async () => {
      vi.spyOn(deviceKeyRepository, 'revokeDevice').mockImplementation(async () => {
        isRevoked = true;
        return true;
      });

      const res = await request(app)
        .patch(`/api/v1/e2ee/devices/${deviceAlice}/revoke`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.revoked).toBe(true);
      expect(isRevoked).toBe(true);
    });

    it('returns device cryptographic status', async () => {
      const mockBundleDoc: Partial<IDeviceKeyBundleDoc> = {
        deviceId: deviceAlice,
        identityKey: aliceIdPubB64,
        signedPreKey: {
          keyId: 1,
          publicKey: aliceSpkPubB64,
          signature: aliceSpkSigB64,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 86400000),
        },
        oneTimePreKeys: inMemoryOpks,
        keyVersion: 1,
        status: 'ACTIVE',
      };

      vi.spyOn(deviceKeyRepository, 'findByUserAndDevice').mockResolvedValue(
        mockBundleDoc as IDeviceKeyBundleDoc,
      );

      const res = await request(app)
        .get(`/api/v1/e2ee/devices/me?deviceId=${deviceAlice}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.hasKeys).toBe(true);
      expect(res.body.data.unconsumedPreKeyCount).toBe(2);
      expect(res.body.data.deviceStatus).toBe('ACTIVE');
    });
  });
});
