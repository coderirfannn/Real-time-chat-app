import { z } from 'zod';
import { ENVIRONMENTS } from './constants.js';

export const rawMobileEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z
    .string()
    .url('EXPO_PUBLIC_API_URL must be a valid URL')
    .default('http://localhost:5000/api/v1'),
  EXPO_PUBLIC_SOCKET_URL: z
    .string()
    .url('EXPO_PUBLIC_SOCKET_URL must be a valid URL')
    .default('http://localhost:5000'),
  EXPO_PUBLIC_APP_ENV: z.enum(ENVIRONMENTS).default('development'),
  EXPO_PUBLIC_SENTRY_DSN: z.string().optional().default(''),
});

export type RawMobileEnv = z.infer<typeof rawMobileEnvSchema>;

export interface MobileConfig {
  apiUrl: string;
  socketUrl: string;
  env: (typeof ENVIRONMENTS)[number];
  isDevelopment: boolean;
  isProduction: boolean;
  isStaging: boolean;
  sentryDsn?: string;
}

export function parseAndValidateMobileEnv(
  sourceEnv: Record<string, string | undefined> = process.env,
): MobileConfig {
  // Guard against backend secret leaks
  const dangerousKeys = [
    'MONGODB_URI',
    'REDIS_PASSWORD',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'SESSION_SECRET',
    'S3_SECRET_KEY',
    'FCM_SERVER_KEY',
  ];

  const leakedKeys = dangerousKeys.filter((key) => Boolean(sourceEnv[key]));
  if (leakedKeys.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[SECURITY WARNING] The following backend secret keys are present in mobile environment source and will NOT be exposed to client: ${leakedKeys.join(', ')}`,
    );
  }

  const result = rawMobileEnvSchema.safeParse(sourceEnv);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`[Config Error] Invalid Mobile Environment Configuration:\n${errorDetails}`);
  }

  const raw = result.data;

  return {
    apiUrl: raw.EXPO_PUBLIC_API_URL,
    socketUrl: raw.EXPO_PUBLIC_SOCKET_URL,
    env: raw.EXPO_PUBLIC_APP_ENV,
    isDevelopment: raw.EXPO_PUBLIC_APP_ENV === 'development',
    isProduction: raw.EXPO_PUBLIC_APP_ENV === 'production',
    isStaging: raw.EXPO_PUBLIC_APP_ENV === 'staging',
    sentryDsn: raw.EXPO_PUBLIC_SENTRY_DSN || undefined,
  };
}
