import { Types } from 'mongoose';
import { BaseRepository } from './base.repository.js';
import { DeviceModel, type IDeviceDoc } from '../models/device.model.js';
import type { DevicePlatform } from '@chatlock/shared-types';

export class DeviceRepository extends BaseRepository<IDeviceDoc> {
  constructor() {
    super(DeviceModel);
  }

  public async upsertDevice(data: {
    userId: string | Types.ObjectId;
    deviceId: string;
    platform: DevicePlatform;
    appVersion: string;
    pushToken?: string;
  }): Promise<IDeviceDoc | null> {
    const userObj = new Types.ObjectId(data.userId);
    const cleanDeviceId = data.deviceId.trim();

    return this.model
      .findOneAndUpdate(
        { userId: userObj, deviceId: cleanDeviceId },
        {
          $set: {
            platform: data.platform,
            appVersion: data.appVersion.trim(),
            pushToken: data.pushToken?.trim(),
            lastActiveAt: new Date(),
            isActive: true,
          },
          $setOnInsert: {
            userId: userObj,
            deviceId: cleanDeviceId,
          },
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  public async findActiveDevicesByUser(userId: string | Types.ObjectId): Promise<IDeviceDoc[]> {
    return this.find({
      userId: new Types.ObjectId(userId),
      isActive: true,
    });
  }

  public async deactivateDevice(
    userId: string | Types.ObjectId,
    deviceId: string,
  ): Promise<IDeviceDoc | null> {
    return this.updateOne(
      {
        userId: new Types.ObjectId(userId),
        deviceId: deviceId.trim(),
      },
      { isActive: false },
    );
  }
}

export const deviceRepository = new DeviceRepository();
