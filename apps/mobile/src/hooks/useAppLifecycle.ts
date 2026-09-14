import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuthStore } from '../store/auth.store';
import { socketManager } from '../services/socket/socket.manager';
import { outboxSyncManager } from '../services/outbox/outbox-sync.manager';
import { networkService } from '../services/network/network.service';
import { notificationService } from '../services/notifications/notification.service';
import { keyBundleService } from '../services/crypto/key-bundle.service';

export interface AppLifecycleOptions {
  onResume?: () => void;
  onBackground?: () => void;
}

export function useAppLifecycle(options: AppLifecycleOptions = {}): void {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Initialize network listener
    networkService.initialize();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const isComingToForeground =
        /inactive|background/.test(appState.current) && nextAppState === 'active';

      appState.current = nextAppState;

      if (isComingToForeground) {
        handleAppResume();
        options.onResume?.();
      } else if (nextAppState === 'background') {
        handleAppBackground();
        options.onBackground?.();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [options]);
}

function handleAppResume(): void {
  const accessToken = useAuthStore.getState().accessToken;

  // 1. Restore socket connection if disconnected
  if (accessToken && !socketManager.isConnected()) {
    socketManager.connect(accessToken);
  }

  // 2. Drain pending outbox messages
  outboxSyncManager.processQueue().catch(() => {});

  // 3. Proactively ensure device push token is fresh and registered with backend
  if (accessToken) {
    notificationService.registerForPushNotifications().catch(() => {});
    keyBundleService.initializeDeviceKeys().catch(() => {});
  }
}

function handleAppBackground(): void {
  // Clear any scheduled retry timeouts while app is sleeping
  outboxSyncManager.clearAllTimeouts();
}
