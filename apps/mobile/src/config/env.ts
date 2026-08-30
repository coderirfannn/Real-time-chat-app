import { parseAndValidateMobileEnv, type MobileConfig } from '@chatlock/config';
import Constants from 'expo-constants';

const expoExtra = (Constants.expoConfig?.extra || {}) as Record<string, string | undefined>;

export const mobileConfig: MobileConfig = parseAndValidateMobileEnv({
  EXPO_PUBLIC_API_URL: expoExtra.apiUrl || process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_SOCKET_URL: expoExtra.socketUrl || process.env.EXPO_PUBLIC_SOCKET_URL,
  EXPO_PUBLIC_APP_ENV: (expoExtra['appEnv'] ||
    process.env['EXPO_PUBLIC_APP_ENV'] ||
    'development') as 'development' | 'test' | 'staging' | 'production',
  EXPO_PUBLIC_SENTRY_DSN: expoExtra['sentryDsn'] || process.env['EXPO_PUBLIC_SENTRY_DSN'],
});

export default mobileConfig;
