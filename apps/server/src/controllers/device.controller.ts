import type { Request, Response } from 'express';
import type { ApiResponse, DevicePlatform } from '@chatlock/shared-types';
import { deviceRepository, type DeviceRepository } from '../repositories/device.repository.js';
import { UnauthorizedError, BadRequestError } from '../errors/app-error.js';
import { logger } from '../utils/logger.js';

const deviceLogger = logger.child('DeviceController');

export interface RegisterPushTokenBody {
  pushToken: string;
  deviceId?: string;
  platform?: DevicePlatform;
  appVersion?: string;
}

export class DeviceController {
  constructor(private readonly deviceRepo: DeviceRepository = deviceRepository) {}

  public registerPushToken = async (
    req: Request<unknown, unknown, RegisterPushTokenBody>,
    res: Response<ApiResponse<{ registered: boolean }>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { pushToken, deviceId, platform, appVersion } = req.body;
    if (!pushToken || typeof pushToken !== 'string' || pushToken.trim().length === 0) {
      throw new BadRequestError('pushToken is required');
    }

    const cleanPushToken = pushToken.trim();
    const cleanDeviceId = deviceId?.trim() || `device_${cleanPushToken.slice(-12)}`;
    const targetPlatform: DevicePlatform = platform || 'android';
    const targetVersion = appVersion?.trim() || '0.1.0';

    await this.deviceRepo.upsertDevice({
      userId: req.user.id,
      deviceId: cleanDeviceId,
      platform: targetPlatform,
      appVersion: targetVersion,
      pushToken: cleanPushToken,
    });

    deviceLogger.info('Registered push token for user device', {
      userId: req.user.id,
      deviceId: cleanDeviceId,
      platform: targetPlatform,
    });

    res.status(200).json({
      success: true,
      message: 'Push token registered successfully',
      data: { registered: true },
      timestamp: new Date().toISOString(),
    });
  };

  public deactivatePushToken = async (
    req: Request<unknown, unknown, { deviceId?: string; pushToken?: string }>,
    res: Response<ApiResponse<{ deactivated: boolean }>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { deviceId, pushToken } = req.body;
    if (deviceId) {
      await this.deviceRepo.deactivateDevice(req.user.id, deviceId);
    }
    if (pushToken) {
      await this.deviceRepo.deactivatePushTokens([pushToken]);
    }

    deviceLogger.info('Deactivated push token for user device', {
      userId: req.user.id,
      deviceId,
    });

    res.status(200).json({
      success: true,
      message: 'Push token deactivated successfully',
      data: { deactivated: true },
      timestamp: new Date().toISOString(),
    });
  };
}

export const deviceController = new DeviceController();
