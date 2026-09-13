import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = process.env.APP_ENV || process.env.NODE_ENV || 'development';

  const isProd = env === 'production';
  const isStaging = env === 'staging';

  const appName = isProd ? 'ChatLock' : isStaging ? 'ChatLock (Staging)' : 'ChatLock (Dev)';
  const bundleId = isProd
    ? 'com.chatlock.app'
    : isStaging
      ? 'com.chatlock.app.staging'
      : 'com.chatlock.app.dev';

  return {
    ...config,
    name: appName,
    slug: 'chatlock',
    scheme: 'chatlock',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    plugins: ['expo-router', 'expo-secure-store'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: bundleId,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0F172A',
      },
      package: bundleId,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
      socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:5000',
      appEnv: env,
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || undefined,
    },
  };
};
