import { parseAndValidateMobileEnv, type MobileConfig } from '@chatlock/config';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const expoExtra = (Constants.expoConfig?.extra || {}) as Record<string, string | undefined>;

function resolveDevUrl(rawUrl: string | undefined, defaultPath: string): string {
  let url = rawUrl || defaultPath;
  const hostUri = Constants.expoConfig?.hostUri;

  if (
    hostUri &&
    Platform.OS !== 'web' &&
    (url.includes('localhost') || url.includes('127.0.0.1'))
  ) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp) {
      url = url.replace('localhost', hostIp).replace('127.0.0.1', hostIp);
    }
  }
  return url;
}

const rawApiUrl = expoExtra.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const rawSocketUrl = expoExtra.socketUrl || process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:5000';

export const mobileConfig: MobileConfig = parseAndValidateMobileEnv({
  EXPO_PUBLIC_API_URL: resolveDevUrl(rawApiUrl, 'http://localhost:5000/api/v1'),
  EXPO_PUBLIC_SOCKET_URL: resolveDevUrl(rawSocketUrl, 'http://localhost:5000'),
  EXPO_PUBLIC_APP_ENV: (expoExtra['appEnv'] ||
    process.env['EXPO_PUBLIC_APP_ENV'] ||
    'development') as 'development' | 'test' | 'staging' | 'production',
  EXPO_PUBLIC_SENTRY_DSN: expoExtra['sentryDsn'] || process.env['EXPO_PUBLIC_SENTRY_DSN'],
});

export default mobileConfig;
