import { ed25519 } from '@noble/curves/ed25519.js';
import {
  deviceKeyRepository,
  type DeviceKeyRepository,
} from '../repositories/device-key.repository.js';
import { BadRequestError, NotFoundError } from '../errors/app-error.js';
import { logger } from '../utils/logger.js';
import type {
  DeviceKeyStatusResponse,
  DeviceKeyUploadPayload,
  PublicDeviceKeyBundle,
  ReplenishPreKeysPayload,
  RotateSignedPreKeyPayload,
  UserDeviceSummary,
} from '@chatlock/shared-types';

const e2eeLogger = logger.child('E2EEService');

export class E2EEService {
  constructor(private readonly keyRepo: DeviceKeyRepository = deviceKeyRepository) {}

  /**
   * Cryptographically verifies an Ed25519 signature over a signed pre-key public key.
   */
  public verifySignedPreKeySignature(
    identityKeyBase64: string,
    signedPreKeyPublicKeyBase64: string,
    signatureBase64: string,
  ): boolean {
    try {
      const identityKeyBytes = Buffer.from(identityKeyBase64, 'base64');
      const signedPreKeyBytes = Buffer.from(signedPreKeyPublicKeyBase64, 'base64');
      const signatureBytes = Buffer.from(signatureBase64, 'base64');

      if (identityKeyBytes.length !== 32) return false;
      if (signedPreKeyBytes.length !== 32) return false;
      if (signatureBytes.length !== 64) return false;

      return ed25519.verify(signatureBytes, signedPreKeyBytes, identityKeyBytes);
    } catch (err) {
      e2eeLogger.warn('Cryptographic signature verification failed with error', {
        error: (err as Error).message,
      });
      return false;
    }
  }

  /**
   * Registers or updates a device's public cryptographic identity and pre-key pool.
   * Derives user identity strictly from authenticated context.
   */
  public async registerDeviceKeys(
    userId: string,
    payload: DeviceKeyUploadPayload,
  ): Promise<PublicDeviceKeyBundle> {
    const isValidSignature = this.verifySignedPreKeySignature(
      payload.identityKey,
      payload.signedPreKey.publicKey,
      payload.signedPreKey.signature,
    );

    if (!isValidSignature) {
      throw new BadRequestError('Invalid signed pre-key signature');
    }

    const expiresAt = new Date(payload.signedPreKey.expiresAt);
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new BadRequestError('Signed pre-key expiration must be a valid future timestamp');
    }

    const bundle = await this.keyRepo.upsertKeyBundle(userId, payload);

    e2eeLogger.info('Registered cryptographic key bundle for device', {
      userId,
      deviceId: payload.deviceId,
      keyVersion: bundle.keyVersion,
      opkCount: payload.oneTimePreKeys.length,
    });

    return {
      userId,
      deviceId: bundle.deviceId,
      identityKey: bundle.identityKey,
      signedPreKey: {
        keyId: bundle.signedPreKey.keyId,
        publicKey: bundle.signedPreKey.publicKey,
        signature: bundle.signedPreKey.signature,
        createdAt: bundle.signedPreKey.createdAt.toISOString(),
        expiresAt: bundle.signedPreKey.expiresAt.toISOString(),
      },
      oneTimePreKey: null,
      keyVersion: bundle.keyVersion,
      deviceStatus: bundle.status,
    };
  }

  /**
   * Retrieves a target user's public key bundle and atomically claims one OPK.
   * If OPK pool is depleted, gracefully returns bundle with oneTimePreKey: null.
   */
  public async getPeerDeviceKeyBundle(
    requesterUserId: string,
    targetUserId: string,
    targetDeviceId?: string,
  ): Promise<PublicDeviceKeyBundle> {
    let targetDevice = null;

    if (targetDeviceId) {
      targetDevice = await this.keyRepo.findActiveByUserAndDevice(targetUserId, targetDeviceId);
    } else {
      const activeDevices = await this.keyRepo.findActiveDevicesForUser(targetUserId);
      const firstDevice = activeDevices[0];
      if (firstDevice) {
        targetDevice = await this.keyRepo.findActiveByUserAndDevice(
          targetUserId,
          firstDevice.deviceId,
        );
      }
    }

    if (!targetDevice) {
      throw new NotFoundError('No active cryptographic device found for recipient');
    }

    // Atomically claim exactly 1 unconsumed one-time pre-key
    const claimedOpk = await this.keyRepo.claimOneTimePreKey(
      targetUserId,
      targetDevice.deviceId,
      requesterUserId,
    );

    return {
      userId: targetUserId,
      deviceId: targetDevice.deviceId,
      identityKey: targetDevice.identityKey,
      signedPreKey: {
        keyId: targetDevice.signedPreKey.keyId,
        publicKey: targetDevice.signedPreKey.publicKey,
        signature: targetDevice.signedPreKey.signature,
        createdAt: targetDevice.signedPreKey.createdAt.toISOString(),
        expiresAt: targetDevice.signedPreKey.expiresAt.toISOString(),
      },
      oneTimePreKey: claimedOpk
        ? {
            keyId: claimedOpk.keyId,
            publicKey: claimedOpk.publicKey,
          }
        : null,
      keyVersion: targetDevice.keyVersion,
      deviceStatus: targetDevice.status,
    };
  }

  /**
   * Replenishes the pool of one-time pre-keys for an authenticated device.
   */
  public async replenishPreKeys(
    userId: string,
    payload: ReplenishPreKeysPayload,
  ): Promise<{ replenished: number; totalUnconsumed: number }> {
    const existing = await this.keyRepo.findActiveByUserAndDevice(userId, payload.deviceId);
    if (!existing) {
      throw new NotFoundError('Active device key bundle not found');
    }

    const totalUnconsumed = await this.keyRepo.replenishPreKeys(
      userId,
      payload.deviceId,
      payload.oneTimePreKeys,
    );

    e2eeLogger.info('Replenished pre-keys for device', {
      userId,
      deviceId: payload.deviceId,
      replenishedCount: payload.oneTimePreKeys.length,
      totalUnconsumed,
    });

    return {
      replenished: payload.oneTimePreKeys.length,
      totalUnconsumed,
    };
  }

  /**
   * Rotates the signed pre-key after verifying its signature against the device's existing identity key.
   */
  public async rotateSignedPreKey(
    userId: string,
    payload: RotateSignedPreKeyPayload,
  ): Promise<void> {
    const existing = await this.keyRepo.findActiveByUserAndDevice(userId, payload.deviceId);
    if (!existing) {
      throw new NotFoundError('Active device key bundle not found');
    }

    const isValidSignature = this.verifySignedPreKeySignature(
      existing.identityKey,
      payload.signedPreKey.publicKey,
      payload.signedPreKey.signature,
    );

    if (!isValidSignature) {
      throw new BadRequestError('Invalid signed pre-key signature for current identity key');
    }

    const expiresAt = new Date(payload.signedPreKey.expiresAt);
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new BadRequestError('Signed pre-key expiration must be a valid future timestamp');
    }

    await this.keyRepo.rotateSignedPreKey(userId, payload.deviceId, payload.signedPreKey);

    e2eeLogger.info('Rotated signed pre-key for device', {
      userId,
      deviceId: payload.deviceId,
      newKeyId: payload.signedPreKey.keyId,
    });
  }

  /**
   * Returns cryptographic key status for a device.
   */
  public async getDeviceKeyStatus(
    userId: string,
    deviceId: string,
  ): Promise<DeviceKeyStatusResponse> {
    const bundle = await this.keyRepo.findByUserAndDevice(userId, deviceId);
    if (!bundle) {
      return {
        deviceId,
        hasKeys: false,
        keyVersion: 0,
        identityKey: null,
        signedPreKeyExpiresAt: null,
        unconsumedPreKeyCount: 0,
        deviceStatus: 'REVOKED',
      };
    }

    const unconsumedCount = bundle.oneTimePreKeys.filter((k) => !k.consumed).length;

    return {
      deviceId,
      hasKeys: true,
      keyVersion: bundle.keyVersion,
      identityKey: bundle.identityKey,
      signedPreKeyExpiresAt: bundle.signedPreKey.expiresAt.toISOString(),
      unconsumedPreKeyCount: unconsumedCount,
      deviceStatus: bundle.status,
    };
  }

  /**
   * Returns list of active devices for a user.
   */
  public async getUserDevices(userId: string): Promise<UserDeviceSummary[]> {
    const devices = await this.keyRepo.findActiveDevicesForUser(userId);
    return devices.map((d) => ({
      deviceId: d.deviceId,
      keyVersion: d.keyVersion,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
      lastRotatedAt: d.lastRotatedAt?.toISOString(),
    }));
  }

  /**
   * Revokes a device's cryptographic key bundle.
   */
  public async revokeDevice(userId: string, deviceId: string): Promise<void> {
    const revoked = await this.keyRepo.revokeDevice(userId, deviceId);
    if (!revoked) {
      throw new NotFoundError('Device key bundle not found');
    }

    e2eeLogger.info('Revoked cryptographic device bundle', {
      userId,
      deviceId,
    });
  }
}

export const e2eeService = new E2EEService();
