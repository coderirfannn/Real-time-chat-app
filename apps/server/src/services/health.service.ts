import { isMongoReady, getMongoStatus } from '../database/connection.js';
import { isRedisReady, getRedisStatus, pingRedis } from '../redis/client.js';
import { config } from '../config/index.js';
import type { HealthStatus } from '@chatlock/shared-types';

export interface LivenessStatus {
  status: 'ok';
  uptime: number;
  timestamp: string;
}

export interface ReadinessStatus {
  status: 'ok' | 'unhealthy';
  ready: boolean;
  timestamp: string;
  dependencies: {
    mongodb: {
      status: string;
      ready: boolean;
    };
    redis: {
      status: string;
      ready: boolean;
    };
  };
}

export class HealthService {
  public async getHealthSummary(): Promise<HealthStatus> {
    const mongoReady = isMongoReady();
    const redisReady = isRedisReady();

    let overallStatus: 'ok' | 'degraded' | 'unhealthy' = 'ok';
    if (!mongoReady && !redisReady) {
      overallStatus = 'unhealthy';
    } else if (!mongoReady || !redisReady) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.app.env,
      services: {
        mongodb: mongoReady ? 'connected' : 'disconnected',
        redis: redisReady ? 'connected' : 'disconnected',
      },
    };
  }

  public getLiveness(): LivenessStatus {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  public async getReadiness(): Promise<ReadinessStatus> {
    const mongoStatus = getMongoStatus();
    const mongoReady = isMongoReady();

    const redisStatus = getRedisStatus();
    const redisPingOk = await pingRedis();
    const redisReady = isRedisReady() && redisPingOk;

    // Both primary dependencies are expected for healthy readiness
    const allReady = mongoReady && redisReady;

    return {
      status: allReady ? 'ok' : 'unhealthy',
      ready: allReady,
      timestamp: new Date().toISOString(),
      dependencies: {
        mongodb: {
          status: mongoStatus,
          ready: mongoReady,
        },
        redis: {
          status: redisStatus,
          ready: redisReady,
        },
      },
    };
  }
}

export const healthService = new HealthService();
