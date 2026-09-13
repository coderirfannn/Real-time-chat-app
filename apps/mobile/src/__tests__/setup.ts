import { vi } from 'vitest';

(globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    Vibration: {
      vibrate: vi.fn(),
      cancel: vi.fn(),
    },
  };
});

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
  SafeAreaView: ({ children }: { children: unknown }) => children,
}));

vi.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: vi.fn().mockResolvedValue({ canceled: true }),
}));

vi.mock('expo-constants', () => {
  const mockConstants = {
    expoConfig: {
      extra: {
        apiUrl: 'http://localhost:5000/api/v1',
        socketUrl: 'http://localhost:5000',
        appEnv: 'development',
      },
    },
  };
  return {
    ...mockConstants,
    default: mockConstants,
  };
});

vi.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  const mockStore = {
    isAvailableAsync: vi.fn().mockResolvedValue(true),
    getItemAsync: vi
      .fn()
      .mockImplementation((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: vi.fn().mockImplementation((key: string, val: string) => {
      store.set(key, val);
      return Promise.resolve();
    }),
    deleteItemAsync: vi.fn().mockImplementation((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
  return {
    ...mockStore,
    default: mockStore,
  };
});

vi.mock('expo-haptics', () => ({
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  impactAsync: vi.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn().mockResolvedValue(undefined),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: vi.fn().mockResolvedValue('notification-id-123'),
  addNotificationResponseReceivedListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
  AndroidImportance: {
    MAX: 5,
    HIGH: 4,
    DEFAULT: 3,
    LOW: 2,
    MIN: 1,
  },
}));

