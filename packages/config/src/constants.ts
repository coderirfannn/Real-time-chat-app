export const ENVIRONMENTS = ['development', 'test', 'staging', 'production'] as const;

export const DEFAULT_PORTS = {
  SERVER: 5000,
  SOCKET: 5000,
  METRICS: 9090,
} as const;

export const DEFAULT_API_PREFIX = '/api/v1';

export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const;

export const STORAGE_DRIVERS = ['local', 's3'] as const;
