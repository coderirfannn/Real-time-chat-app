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
    owner: 'code_with_irfan',
    scheme: 'chatlock',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    plugins: [
      'expo-router',
      'expo-secure-store',
      [
        'expo-local-authentication',
        {
          faceIDPermission: 'Allow ChatLock to use biometric authentication for app lock.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow ChatLock to access photos to send media attachments.',
          cameraPermission: 'Allow ChatLock to access camera to take and send photos.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#2563EB',
        },
      ],
    ],
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
      versionCode: 1,
      permissions: ['android.permission.VIBRATE', 'android.permission.POST_NOTIFICATIONS'],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      eas: {
        projectId: 'd0d37a73-72a4-4fcb-902a-e3ded337236f',
      },
      apiUrl:
        process.env.EXPO_PUBLIC_API_URL ||
        (isProd ? 'https://chatlock-server.onrender.com/api/v1' : 'http://localhost:5000/api/v1'),
      socketUrl:
        process.env.EXPO_PUBLIC_SOCKET_URL ||
        (isProd ? 'https://chatlock-server.onrender.com' : 'http://localhost:5000'),
      appEnv: env,
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || undefined,
    },
  };
};
