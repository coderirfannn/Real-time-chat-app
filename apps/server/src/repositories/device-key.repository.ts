import { Types, type ProjectionType, type QueryOptions } from 'mongoose';
import { BaseRepository } from './base.repository.js';
import {
  DeviceKeyBundleModel,
  type IDeviceKeyBundleDoc,
  type IOneTimePreKeySubdoc,
  type ISignedPreKeySubdoc,
} from '../models/device-key.model.js';
import type {
  DeviceKeyUploadPayload,
  OneTimePreKeyDto,
  SignedPreKeyDto,
} from '@chatlock/shared-types';

export class DeviceKeyRepository extends BaseRepository<IDeviceKeyBundleDoc> {
  constructor() {
    super(DeviceKeyBundleModel);
  }

  /**
   * Registers or replaces an active device key bundle.
   */
  public async upsertKeyBundle(
    userId: string,
    payload: DeviceKeyUploadPayload,
  ): Promise<IDeviceKeyBundleDoc> {
    const userObjectId = new Types.ObjectId(userId);

    const signedPreKey: ISignedPreKeySubdoc = {
      keyId: payload.signedPreKey.keyId,
      publicKey: payload.signedPreKey.publicKey,
      signature: payload.signedPreKey.signature,
      createdAt: new Date(payload.signedPreKey.createdAt),
      expiresAt: new Date(payload.signedPreKey.expiresAt),
    };

    const oneTimePreKeys: IOneTimePreKeySubdoc[] = payload.oneTimePreKeys.map((k) => ({
      keyId: k.keyId,
      publicKey: k.publicKey,
      consumed: false,
    }));

    return (await this.model.findOneAndUpdate(
      {
        userId: userObjectId,
        deviceId: payload.deviceId,
      },
      {
        $set: {
          identityKey: payload.identityKey,
          signedPreKey,
          oneTimePreKeys,
          keyVersion: payload.keyVersion ?? 1,
          status: 'ACTIVE',
          revokedAt: null,
          lastRotatedAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    )) as IDeviceKeyBundleDoc;
  }

  /**
   * Finds an active key bundle by user ID and device ID.
   */
  public async findActiveByUserAndDevice(
    userId: string,
    deviceId: string,
    projection?: ProjectionType<IDeviceKeyBundleDoc>,
    options?: QueryOptions<IDeviceKeyBundleDoc>,
  ): Promise<IDeviceKeyBundleDoc | null> {
    return this.model
      .findOne(
        {
          userId: new Types.ObjectId(userId),
          deviceId,
          status: 'ACTIVE',
        },
        projection,
        options,
      )
      .exec();
  }

  /**
   * Finds any bundle by user ID and device ID regardless of status.
   */
  public async findByUserAndDevice(
    userId: string,
    deviceId: string,
  ): Promise<IDeviceKeyBundleDoc | null> {
    return this.model
      .findOne({
        userId: new Types.ObjectId(userId),
        deviceId,
      })
      .exec();
  }

  /**
   * Returns all active devices with registered key bundles for a user.
   */
  public async findActiveDevicesForUser(userId: string): Promise<IDeviceKeyBundleDoc[]> {
    return this.model
      .find({
        userId: new Types.ObjectId(userId),
        status: 'ACTIVE',
      })
      .select({
        userId: 1,
        deviceId: 1,
        identityKey: 1,
        keyVersion: 1,
        status: 1,
        createdAt: 1,
        lastRotatedAt: 1,
      })
      .exec();
  }

  /**
   * Atomically claims and marks exactly one unconsumed one-time pre-key.
   * Guarantees zero double-spending under high concurrency.
   */
  public async claimOneTimePreKey(
    userId: string,
    deviceId: string,
    requesterUserId: string,
  ): Promise<IOneTimePreKeySubdoc | null> {
    const result = await this.model.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        deviceId,
        status: 'ACTIVE',
        'oneTimePreKeys.consumed': false,
      },
      {
        $set: {
          'oneTimePreKeys.$.consumed': true,
          'oneTimePreKeys.$.consumedAt': new Date(),
          'oneTimePreKeys.$.consumedByUserId': new Types.ObjectId(requesterUserId),
        },
      },
      {
        new: false, // returns document state BEFORE the update
      },
    );

    if (!result) return null;

    // The first unconsumed key prior to update is the one that was transitioned
    const claimed = result.oneTimePreKeys.find((k) => !k.consumed);
    if (!claimed) return null;

    return {
      keyId: claimed.keyId,
      publicKey: claimed.publicKey,
      consumed: true,
      consumedAt: new Date(),
      consumedByUserId: new Types.ObjectId(requesterUserId),
    };
  }

  /**
   * Appends new one-time pre-keys to the pool.
   */
  public async replenishPreKeys(
    userId: string,
    deviceId: string,
    newKeys: OneTimePreKeyDto[],
  ): Promise<number> {
    const formattedKeys: IOneTimePreKeySubdoc[] = newKeys.map((k) => ({
      keyId: k.keyId,
      publicKey: k.publicKey,
      consumed: false,
    }));

    const updated = await this.model.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        deviceId,
        status: 'ACTIVE',
      },
      {
        $push: {
          oneTimePreKeys: { $each: formattedKeys },
        },
      },
      { new: true },
    );

    if (!updated) return 0;
    return updated.oneTimePreKeys.filter((k) => !k.consumed).length;
  }

  /**
   * Rotates the signed pre-key, archiving the current one into history.
   */
  public async rotateSignedPreKey(
    userId: string,
    deviceId: string,
    newSignedPreKey: SignedPreKeyDto,
  ): Promise<IDeviceKeyBundleDoc | null> {
    const existing = await this.model.findOne({
      userId: new Types.ObjectId(userId),
      deviceId,
      status: 'ACTIVE',
    });

    if (!existing) return null;

    const previousSpk: ISignedPreKeySubdoc = {
      keyId: existing.signedPreKey.keyId,
      publicKey: existing.signedPreKey.publicKey,
      signature: existing.signedPreKey.signature,
      createdAt: existing.signedPreKey.createdAt,
      expiresAt: existing.signedPreKey.expiresAt,
      rotatedAt: new Date(),
    };

    const nextSpk: ISignedPreKeySubdoc = {
      keyId: newSignedPreKey.keyId,
      publicKey: newSignedPreKey.publicKey,
      signature: newSignedPreKey.signature,
      createdAt: new Date(newSignedPreKey.createdAt),
      expiresAt: new Date(newSignedPreKey.expiresAt),
    };

    return this.model.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        deviceId,
        status: 'ACTIVE',
      },
      {
        $set: {
          signedPreKey: nextSpk,
          lastRotatedAt: new Date(),
        },
        $push: {
          signedPreKeyHistory: previousSpk,
        },
      },
      { new: true },
    );
  }

  /**
   * Revokes a device key bundle.
   */
  public async revokeDevice(userId: string, deviceId: string): Promise<boolean> {
    const result = await this.model.updateOne(
      {
        userId: new Types.ObjectId(userId),
        deviceId,
      },
      {
        $set: {
          status: 'REVOKED',
          revokedAt: new Date(),
        },
      },
    );

    return result.modifiedCount > 0;
  }

  /**
   * Returns remaining unconsumed pre-key count.
   */
  public async countUnconsumedPreKeys(userId: string, deviceId: string): Promise<number> {
    const doc = await this.model.findOne(
      {
        userId: new Types.ObjectId(userId),
        deviceId,
        status: 'ACTIVE',
      },
      { oneTimePreKeys: 1 },
    );

    if (!doc) return 0;
    return doc.oneTimePreKeys.filter((k) => !k.consumed).length;
  }
}

export const deviceKeyRepository = new DeviceKeyRepository();
