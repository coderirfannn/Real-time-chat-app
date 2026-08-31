import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/auth.store';
import { socketManager } from '../src/services/socket/socket.manager';
import { useAppLifecycle } from '../src/hooks/useAppLifecycle';

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
  const { accessToken, isAuthenticated, hydrateAuth } = useAuthStore();

  useAppLifecycle();

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      socketManager.connect(accessToken);
    } else {
      socketManager.disconnect();
    }
  }, [isAuthenticated, accessToken]);

  return <>{children}</>;
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
              contentStyle: { backgroundColor: '#0F172A' },
            }}
          >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(main)" options={{ headerShown: false }} />
          </Stack>
        </AuthLifecycleManager>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
