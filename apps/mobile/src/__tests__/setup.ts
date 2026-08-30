import { vi } from 'vitest';

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
