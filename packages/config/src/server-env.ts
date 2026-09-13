import { z } from 'zod';
import { ENVIRONMENTS, LOG_LEVELS, STORAGE_DRIVERS } from './constants.js';

// Raw environment variables schema
export const rawServerEnvSchema = z.object({
  // 1. Application
  NODE_ENV: z.enum(ENVIRONMENTS).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  API_PREFIX: z.string().startsWith('/').default('/api/v1'),
  APP_NAME: z.string().default('ChatLock'),
  CORS_ORIGIN: z.string().default('*'),

  // 2. MongoDB
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required')
    .default('mongodb://localhost:27017/chatlock'),
  MONGODB_DB_NAME: z.string().default('chatlock'),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().positive().default(50),
  MONGODB_MIN_POOL_SIZE: z.coerce.number().int().nonnegative().default(5),

  // 3. Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_URL: z.string().optional(),
  REDIS_KEY_PREFIX: z.string().default('chatlock:'),
  REDIS_TLS: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // 4. JWT & Authentication
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters')
    .default('dev_jwt_access_secret_min_32_characters_long_123456'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters')
    .default('dev_jwt_refresh_secret_min_32_characters_long_123456'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // 5. Socket.IO
  SOCKET_PORT: z.coerce.number().int().positive().default(5000),
  SOCKET_PATH: z.string().default('/socket.io'),
  SOCKET_PING_TIMEOUT: z.coerce.number().int().positive().default(20000),
  SOCKET_PING_INTERVAL: z.coerce.number().int().positive().default(25000),
  SOCKET_CORS_ORIGIN: z.string().default('*'),

  // 6. Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000), // 15 mins
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  // 7. Storage
  STORAGE_DRIVER: z.enum(STORAGE_DRIVERS).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./uploads'),
  S3_BUCKET: z.string().optional().default(''),
  S3_REGION: z.string().optional().default(''),
  S3_ACCESS_KEY: z.string().optional().default(''),
  S3_SECRET_KEY: z.string().optional().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),

  // 8. Push Notifications (Optional when inactive)
  FCM_SERVER_KEY: z.string().optional().default(''),
  APNS_KEY_ID: z.string().optional().default(''),
  APNS_TEAM_ID: z.string().optional().default(''),

  // 9. Observability & Monitoring
  SENTRY_DSN: z.string().optional().default(''),
  ENABLE_TELEMETRY: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  METRICS_PORT: z.coerce.number().int().positive().default(9090),

  // 10. Security
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(14).default(10),
  SESSION_SECRET: z.string().default('dev_session_secret_min_32_chars_long_chatlock'),
  HELMET_ENABLED: z
    .string()
    .transform((val) => val !== 'false')
    .default('true'),

  // 11. Logging
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  LOG_PRETTY: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  // 12. Background Jobs
  BULL_REDIS_URL: z.string().optional().default('redis://localhost:6379/1'),
  JOB_CONCURRENCY: z.coerce.number().int().positive().default(5),

  // 13. Feature Flags
  ENABLE_VOICE_CALLS: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  ENABLE_END_TO_END_ENCRYPTION: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  ENABLE_MESSAGE_REACTIONS: z
    .string()
    .transform((val) => val !== 'false')
    .default('true'),
});

export type RawServerEnv = z.infer<typeof rawServerEnvSchema>;

export interface ServerConfig {
  app: {
    env: (typeof ENVIRONMENTS)[number];
    port: number;
    apiPrefix: string;
    appName: string;
    corsOrigins: string[];
    isDevelopment: boolean;
    isProduction: boolean;
    isTest: boolean;
    isStaging: boolean;
  };
  mongo: {
    uri: string;
    dbName: string;
    maxPoolSize: number;
    minPoolSize: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    url: string;
    keyPrefix: string;
    tls: boolean;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  socket: {
    port: number;
    path: string;
    pingTimeout: number;
    pingInterval: number;
    corsOrigins: string[];
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  storage: {
    driver: (typeof STORAGE_DRIVERS)[number];
    localPath: string;
    s3?: {
      bucket: string;
      region: string;
      accessKey: string;
      secretKey: string;
    };
    cloudinary?: {
      cloudName: string;
      apiKey: string;
      apiSecret: string;
    };
  };
  push: {
    fcmServerKey?: string;
    apnsKeyId?: string;
    apnsTeamId?: string;
  };
  observability: {
    sentryDsn?: string;
    enableTelemetry: boolean;
    metricsPort: number;
  };
  security: {
    bcryptSaltRounds: number;
    sessionSecret: string;
    helmetEnabled: boolean;
  };
  logging: {
    level: (typeof LOG_LEVELS)[number];
    pretty: boolean;
  };
  jobs: {
    redisUrl: string;
    concurrency: number;
  };
  features: {
    voiceCalls: boolean;
    endToEndEncryption: boolean;
    messageReactions: boolean;
  };
}

let cachedServerConfig: ServerConfig | null = null;

export function parseAndValidateServerEnv(
  sourceEnv: Record<string, string | undefined> = process.env,
): ServerConfig {
  const result = rawServerEnvSchema.safeParse(sourceEnv);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`[Config Error] Invalid Server Environment Configuration:\n${errorDetails}`);
  }

  const raw = result.data;
  const parseCors = (cors: string): string[] => {
    if (cors === '*') return ['*'];
    return cors
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  };

  const redisUrl =
    raw.REDIS_URL ||
    `redis://${raw.REDIS_PASSWORD ? `:${encodeURIComponent(raw.REDIS_PASSWORD)}@` : ''}${raw.REDIS_HOST}:${raw.REDIS_PORT}/0`;

  return {
    app: {
      env: raw.NODE_ENV,
      port: raw.PORT,
      apiPrefix: raw.API_PREFIX,
      appName: raw.APP_NAME,
      corsOrigins: parseCors(raw.CORS_ORIGIN),
      isDevelopment: raw.NODE_ENV === 'development',
      isProduction: raw.NODE_ENV === 'production',
      isTest: raw.NODE_ENV === 'test',
      isStaging: raw.NODE_ENV === 'staging',
    },
    mongo: {
      uri: raw.MONGODB_URI,
      dbName: raw.MONGODB_DB_NAME,
      maxPoolSize: raw.MONGODB_MAX_POOL_SIZE,
      minPoolSize: raw.MONGODB_MIN_POOL_SIZE,
    },
    redis: {
      host: raw.REDIS_HOST,
      port: raw.REDIS_PORT,
      password: raw.REDIS_PASSWORD || undefined,
      url: redisUrl,
      keyPrefix: raw.REDIS_KEY_PREFIX,
      tls: raw.REDIS_TLS,
    },
    jwt: {
      accessSecret: raw.JWT_ACCESS_SECRET,
      refreshSecret: raw.JWT_REFRESH_SECRET,
      accessExpiresIn: raw.JWT_ACCESS_EXPIRES_IN,
      refreshExpiresIn: raw.JWT_REFRESH_EXPIRES_IN,
    },
    socket: {
      port: raw.SOCKET_PORT,
      path: raw.SOCKET_PATH,
      pingTimeout: raw.SOCKET_PING_TIMEOUT,
      pingInterval: raw.SOCKET_PING_INTERVAL,
      corsOrigins: parseCors(raw.SOCKET_CORS_ORIGIN),
    },
    rateLimit: {
      windowMs: raw.RATE_LIMIT_WINDOW_MS,
      maxRequests: raw.RATE_LIMIT_MAX_REQUESTS,
    },
    storage: {
      driver: raw.STORAGE_DRIVER,
      localPath: raw.STORAGE_LOCAL_PATH,
      s3:
        raw.S3_BUCKET && raw.S3_REGION
          ? {
              bucket: raw.S3_BUCKET,
              region: raw.S3_REGION,
              accessKey: raw.S3_ACCESS_KEY || '',
              secretKey: raw.S3_SECRET_KEY || '',
            }
          : undefined,
      cloudinary:
        raw.CLOUDINARY_CLOUD_NAME || raw.CLOUDINARY_API_KEY || raw.CLOUDINARY_API_SECRET
          ? {
              cloudName: raw.CLOUDINARY_CLOUD_NAME || '',
              apiKey: raw.CLOUDINARY_API_KEY || '',
              apiSecret: raw.CLOUDINARY_API_SECRET || '',
            }
          : undefined,
    },
    push: {
      fcmServerKey: raw.FCM_SERVER_KEY || undefined,
      apnsKeyId: raw.APNS_KEY_ID || undefined,
      apnsTeamId: raw.APNS_TEAM_ID || undefined,
    },
    observability: {
      sentryDsn: raw.SENTRY_DSN || undefined,
      enableTelemetry: raw.ENABLE_TELEMETRY,
      metricsPort: raw.METRICS_PORT,
    },
    security: {
      bcryptSaltRounds: raw.BCRYPT_SALT_ROUNDS,
      sessionSecret: raw.SESSION_SECRET,
      helmetEnabled: raw.HELMET_ENABLED,
    },
    logging: {
      level: raw.LOG_LEVEL,
      pretty: raw.LOG_PRETTY,
    },
    jobs: {
      redisUrl: raw.BULL_REDIS_URL || redisUrl,
      concurrency: raw.JOB_CONCURRENCY,
    },
    features: {
      voiceCalls: raw.ENABLE_VOICE_CALLS,
      endToEndEncryption: raw.ENABLE_END_TO_END_ENCRYPTION,
      messageReactions: raw.ENABLE_MESSAGE_REACTIONS,
    },
  };
}

export function loadServerConfig(
  envSource: Record<string, string | undefined> = process.env,
): ServerConfig {
  if (cachedServerConfig) {
    return cachedServerConfig;
  }

  cachedServerConfig = parseAndValidateServerEnv(envSource);
  return cachedServerConfig;
}

export function resetServerConfigCache(): void {
  cachedServerConfig = null;
}
