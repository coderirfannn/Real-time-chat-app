import { cryptoService, type CryptoService } from './crypto.service';
import { deviceKeyStore, type DeviceKeyStore } from './device-key-store';
import { e2eeApi, type E2EEApi } from '../api/e2ee.api';
import { NotificationService } from '../notifications/notification.service';
import type { DeviceKeyUploadPayload } from '@chatlock/shared-types';

export class KeyBundleService {
  constructor(
    private readonly crypto: CryptoService = cryptoService,
    private readonly keyStore: DeviceKeyStore = deviceKeyStore,
    private readonly api: E2EEApi = e2eeApi,
  ) {}

  /**
   * Initializes device cryptographic identity if missing, generates keys, and registers with backend.
   */
  public async initializeDeviceKeys(forceReset = false): Promise<{
    initialized: boolean;
    registered: boolean;
    deviceId: string;
  }> {
    const deviceId = await NotificationService.getInstance().getDeviceId();

    const hasLocalKeys = await this.keyStore.hasKeys();
    if (hasLocalKeys && !forceReset) {
      try {
        const status = await this.api.getMyDeviceStatus(deviceId);
        if (status.hasKeys && status.deviceStatus === 'ACTIVE') {
          // Check if replenishment is needed asynchronously
          if (status.unconsumedPreKeyCount < 10) {
            void this.checkAndReplenishPreKeys(10, 25);
          }
          return { initialized: true, registered: true, deviceId };
        }
      } catch {
        // If network check fails, trust local keys and allow offline readiness
        return { initialized: true, registered: false, deviceId };
      }
    }

    // 1. Generate identity key pair (Ed25519)
    const identityKeyPair = this.crypto.generateIdentityKeyPair();

    // 2. Generate signed pre-key (X25519) signed by identity private key
    const signedPreKey = this.crypto.generateSignedPreKey(identityKeyPair.privateKey, 1, 30);

    // 3. Generate initial pool of 50 one-time pre-keys (X25519)
    const oneTimePreKeys = this.crypto.generateOneTimePreKeys(1, 50);

    // 4. Save private cryptographic material in platform-appropriate local secure storage
    await this.keyStore.saveIdentityKeyPair(identityKeyPair);
    await this.keyStore.saveSignedPreKey(signedPreKey);
    await this.keyStore.saveOneTimePreKeys(oneTimePreKeys);
    await this.keyStore.setKeyVersion(1);

    // 5. Upload public key bundle to zero-trust server registry
    const uploadPayload: DeviceKeyUploadPayload = {
      deviceId,
      identityKey: identityKeyPair.publicKey,
      signedPreKey: {
        keyId: signedPreKey.keyId,
        publicKey: signedPreKey.publicKey,
        signature: signedPreKey.signature,
        createdAt: signedPreKey.createdAt,
        expiresAt: signedPreKey.expiresAt,
      },
      oneTimePreKeys: oneTimePreKeys.map((k) => ({
        keyId: k.keyId,
        publicKey: k.publicKey,
      })),
      keyVersion: 1,
    };

    try {
      await this.api.registerKeyBundle(uploadPayload);
      return { initialized: true, registered: true, deviceId };
    } catch {
      // Local keys are preserved; registration will be retried on next online sync
      return { initialized: true, registered: false, deviceId };
    }
  }

  /**
   * Checks remaining unconsumed one-time pre-keys on server and replenishes if below threshold.
   */
  public async checkAndReplenishPreKeys(
    threshold = 10,
    batchSize = 25,
  ): Promise<{ replenished: boolean; count: number }> {
    const deviceId = await NotificationService.getInstance().getDeviceId();

    try {
      const status = await this.api.getMyDeviceStatus(deviceId);
      if (!status.hasKeys || status.unconsumedPreKeyCount >= threshold) {
        return { replenished: false, count: status.unconsumedPreKeyCount };
      }

      // Calculate next keyId
      const localKeys = await this.keyStore.getOneTimePreKeys();
      const maxId = localKeys.reduce((max, k) => Math.max(max, k.keyId), 0);
      const startKeyId = maxId + 1;

      // Generate new batch
      const newKeys = this.crypto.generateOneTimePreKeys(startKeyId, batchSize);

      // Save locally
      await this.keyStore.saveOneTimePreKeys(newKeys);

      // Upload public keys to server
      const result = await this.api.replenishPreKeys({
        deviceId,
        oneTimePreKeys: newKeys.map((k) => ({
          keyId: k.keyId,
          publicKey: k.publicKey,
        })),
      });

      return { replenished: true, count: result.totalUnconsumed };
    } catch {
      return { replenished: false, count: 0 };
    }
  }

  /**
   * Rotates the signed pre-key when expired or requested.
   */
  public async rotateSignedPreKey(validityDays = 30): Promise<boolean> {
    const deviceId = await NotificationService.getInstance().getDeviceId();
    const identityKeyPair = await this.keyStore.getIdentityKeyPair();
    const currentSpk = await this.keyStore.getSignedPreKey();

    if (!identityKeyPair) {
      throw new Error('Cannot rotate signed pre-key: Identity key pair missing');
    }

    const nextKeyId = (currentSpk?.keyId ?? 0) + 1;
    const newSpk = this.crypto.generateSignedPreKey(
      identityKeyPair.privateKey,
      nextKeyId,
      validityDays,
    );

    // Save locally
    await this.keyStore.saveSignedPreKey(newSpk);

    // Register with server
    await this.api.rotateSignedPreKey({
      deviceId,
      signedPreKey: {
        keyId: newSpk.keyId,
        publicKey: newSpk.publicKey,
        signature: newSpk.signature,
        createdAt: newSpk.createdAt,
        expiresAt: newSpk.expiresAt,
      },
    });

    return true;
  }
}

export const keyBundleService = new KeyBundleService();
