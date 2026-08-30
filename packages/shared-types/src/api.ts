import type { PaginationMeta } from './common.js';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  timestamp: string;
}

export interface PaginatedResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T[];
  pagination: PaginationMeta;
  timestamp: string;
}

export interface ApiError {
  success: false;
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, unknown> | Array<unknown>;
  timestamp: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime: number;
  environment: string;
  services?: {
    mongodb?: 'connected' | 'disconnected' | 'connecting';
    redis?: 'connected' | 'disconnected' | 'connecting';
  };
}
