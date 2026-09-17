import React, { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/auth.store';
import { socketManager } from '../src/services/socket/socket.manager';
import { useAppLifecycle } from '../src/hooks/useAppLifecycle';
import { AppLockModal } from '../src/components/security/AppLockModal';
import { biometricsService } from '../src/services/security/biometrics.service';
import { useNotificationListener } from '../src/hooks/useNotificationListener';

import { AnimatedSplashScreen } from '../src/components/splash/AnimatedSplashScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthLifecycleManager({ children }: { children: React.ReactNode }) {
  const { accessToken, isAuthenticated, isLoading, hydrateAuth, user } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [isLocked, setIsLocked] = React.useState(false);
  const lastBackgroundTimeRef = React.useRef<number | null>(null);

  const lifecycleOptions = React.useMemo(
    () => ({
      onResume: async () => {
        if (isAuthenticated) {
          const shouldLock = await biometricsService.shouldLockOnResume(
            lastBackgroundTimeRef.current,
          );
          if (shouldLock) {
            setIsLocked(true);
          }
        }
      },
      onBackground: () => {
        lastBackgroundTimeRef.current = Date.now();
      },
    }),
    [isAuthenticated],
  );

  useAppLifecycle(lifecycleOptions);
  useNotificationListener();

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    if (isLoading) return;

    if (segments[0] === 'download') return;

    // Strict boundary: Native mobile platform must NEVER enter admin routes
    if (Platform.OS !== 'web' && segments[0] === 'admin') {
      router.replace('/(main)' as never);
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login' as never);
    } else if (isAuthenticated && inAuthGroup) {
      if (Platform.OS === 'web' && user?.role === 'ADMIN') {
        router.replace('/admin/dashboard' as never);
      } else {
        router.replace('/(main)' as never);
      }
    }
  }, [isAuthenticated, isLoading, segments, router, user]);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      socketManager.connect(accessToken);
    } else {
      socketManager.disconnect();
      queryClient.clear();
    }
  }, [isAuthenticated, accessToken]);

  return (
    <View style={{ flex: 1, backgroundColor: '#181A20' }}>
      {children}
      <AnimatedSplashScreen isReady={!isLoading} />
      {isAuthenticated && isLocked && (
        <AppLockModal isVisible={isLocked} onUnlocked={() => setIsLocked(false)} />
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthLifecycleManager>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#181A20' },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(main)" options={{ headerShown: false }} />
            <Stack.Screen name="download" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
          </Stack>
        </AuthLifecycleManager>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
