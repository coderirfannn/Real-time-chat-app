import * as fs from 'fs';
import * as path from 'path';
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
    orientation: 'default',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    plugins: [
      'expo-router',
      'expo-secure-store',
      [
        'expo-local-authentication',
        {
          faceIDPermission: 'Allow ChatLock to use biometric authentication for app lock security.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow ChatLock to access photos and gallery to send media attachments.',
          cameraPermission: 'Allow ChatLock to access camera to take and send photos securely.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#246BFD',
        },
      ],
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: bundleId,
      userInterfaceStyle: 'dark',
      infoPlist: {
        NSCameraUsageDescription: 'Allow ChatLock to access camera to take and send encrypted photos.',
        NSPhotoLibraryUsageDescription: 'Allow ChatLock to access photo library to share media attachments.',
        NSPhotoLibraryAddUsageDescription: 'Allow ChatLock to save media attachments to your photo library.',
        NSFaceIDUsageDescription: 'Allow ChatLock to use Face ID for biometric app lock security.',
        UIRequiresFullScreen: false,
        UIViewControllerBasedStatusBarAppearance: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0E1015',
      },
      package: bundleId,
      versionCode: 1,
      allowBackup: false,
      softwareKeyboardLayoutMode: 'pan',
      permissions: [
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.VIBRATE',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.USE_BIOMETRIC',
        'android.permission.USE_FINGERPRINT',
      ],
      ...(fs.existsSync(path.resolve(__dirname, 'google-services.json'))
        ? { googleServicesFile: './google-services.json' }
        : process.env.GOOGLE_SERVICES_JSON
          ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
          : {}),
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
