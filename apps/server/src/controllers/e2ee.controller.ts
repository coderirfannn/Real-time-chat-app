import type { Request, Response } from 'express';
import type {
  ApiResponse,
  DeviceKeyStatusResponse,
  PublicDeviceKeyBundle,
  UserDeviceSummary,
} from '@chatlock/shared-types';
import {
  registerKeyBundleSchema,
  replenishPreKeysSchema,
  rotateSignedPreKeySchema,
} from '@chatlock/validation';
import { e2eeService, type E2EEService } from '../services/e2ee.service.js';
import { UnauthorizedError, BadRequestError } from '../errors/app-error.js';

export class E2EEController {
  constructor(private readonly service: E2EEService = e2eeService) {}

  public registerKeys = async (
    req: Request,
    res: Response<ApiResponse<PublicDeviceKeyBundle>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const validated = registerKeyBundleSchema.parse(req.body);
    const bundle = await this.service.registerDeviceKeys(req.user.id, validated);

    res.status(201).json({
      success: true,
      message: 'Cryptographic key bundle registered successfully',
      data: bundle,
      timestamp: new Date().toISOString(),
    });
  };

  public getPeerBundle = async (
    req: Request<{ userId: string }, unknown, unknown, { deviceId?: string }>,
    res: Response<ApiResponse<PublicDeviceKeyBundle>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { userId } = req.params;
    if (!userId) {
      throw new BadRequestError('Target user ID is required');
    }

    const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId : undefined;
    const bundle = await this.service.getPeerDeviceKeyBundle(req.user.id, userId, deviceId);

    res.status(200).json({
      success: true,
      message: 'Retrieved peer cryptographic key bundle',
      data: bundle,
      timestamp: new Date().toISOString(),
    });
  };

  public replenishPreKeys = async (
    req: Request,
    res: Response<ApiResponse<{ replenished: number; totalUnconsumed: number }>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const validated = replenishPreKeysSchema.parse(req.body);
    const result = await this.service.replenishPreKeys(req.user.id, validated);

    res.status(200).json({
      success: true,
      message: 'Pre-key pool replenished successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  };

  public rotateSignedPreKey = async (
    req: Request,
    res: Response<ApiResponse<{ rotated: boolean }>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const validated = rotateSignedPreKeySchema.parse(req.body);
    await this.service.rotateSignedPreKey(req.user.id, validated);

    res.status(200).json({
      success: true,
      message: 'Signed pre-key rotated successfully',
      data: { rotated: true },
      timestamp: new Date().toISOString(),
    });
  };

  public getMyDeviceStatus = async (
    req: Request<unknown, unknown, unknown, { deviceId?: string }>,
    res: Response<ApiResponse<DeviceKeyStatusResponse>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const deviceId = req.query.deviceId;
    if (!deviceId || typeof deviceId !== 'string') {
      throw new BadRequestError('deviceId query parameter is required');
    }

    const status = await this.service.getDeviceKeyStatus(req.user.id, deviceId);

    res.status(200).json({
      success: true,
      message: 'Retrieved device key status',
      data: status,
      timestamp: new Date().toISOString(),
    });
  };

  public getUserDevices = async (
    req: Request<{ userId: string }>,
    res: Response<ApiResponse<UserDeviceSummary[]>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { userId } = req.params;
    const devices = await this.service.getUserDevices(userId);

    res.status(200).json({
      success: true,
      message: 'Retrieved user cryptographic devices',
      data: devices,
      timestamp: new Date().toISOString(),
    });
  };

  public revokeDevice = async (
    req: Request<{ deviceId: string }>,
    res: Response<ApiResponse<{ revoked: boolean }>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { deviceId } = req.params;
    if (!deviceId) {
      throw new BadRequestError('deviceId parameter is required');
    }

    await this.service.revokeDevice(req.user.id, deviceId);

    res.status(200).json({
      success: true,
      message: 'Device revoked successfully',
      data: { revoked: true },
      timestamp: new Date().toISOString(),
    });
  };
}

export const e2eeController = new E2EEController();
