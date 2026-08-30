import type { Request, Response } from 'express';
import {
  healthService,
  type LivenessStatus,
  type ReadinessStatus,
} from '../services/health.service.js';
import { ServiceUnavailableError } from '../errors/app-error.js';
import type { ApiResponse, HealthStatus } from '@chatlock/shared-types';

export class HealthController {
  public getHealth = async (
    _req: Request,
    res: Response<ApiResponse<HealthStatus>>,
  ): Promise<void> => {
    const summary = await healthService.getHealthSummary();
    res.status(200).json({
      success: true,
      message: 'System health status retrieved',
      data: summary,
      timestamp: new Date().toISOString(),
    });
  };

  public getLiveness = (_req: Request, res: Response<ApiResponse<LivenessStatus>>): void => {
    const liveness = healthService.getLiveness();
    res.status(200).json({
      success: true,
      message: 'Service is alive',
      data: liveness,
      timestamp: new Date().toISOString(),
    });
  };

  public getReadiness = async (
    _req: Request,
    res: Response<ApiResponse<ReadinessStatus>>,
  ): Promise<void> => {
    const readiness = await healthService.getReadiness();

    if (!readiness.ready) {
      throw new ServiceUnavailableError(
        'Service is not ready to accept traffic. Core dependencies unavailable.',
        readiness.dependencies,
      );
    }

    res.status(200).json({
      success: true,
      message: 'Service is ready to handle traffic',
      data: readiness,
      timestamp: new Date().toISOString(),
    });
  };
}

export const healthController = new HealthController();
