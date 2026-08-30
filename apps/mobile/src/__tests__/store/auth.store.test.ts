import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { AuthResponse, UserProfile } from '@chatlock/shared-types';
import { useAuthStore } from '../../store/auth.store';
import { secureStorage } from '../../services/storage/secure-storage.service';

describe('useAuthStore Unit Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    global.fetch = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ success: true, data: {} })),
      } as unknown as Response);

    await secureStorage.clear();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('updates state and secure storage upon setSession', async () => {
    const mockAuthResponse: AuthResponse = {
      user: {
        id: 'user-123',
        email: 'user@example.com',
        username: 'testuser',
        displayName: 'Test User',
        status: 'online',
      },
      tokens: {
        accessToken: 'access-jwt-123',
        refreshToken: 'refresh-jwt-123',
        expiresIn: 900,
        tokenType: 'Bearer',
      },
    };

    await useAuthStore.getState().setSession(mockAuthResponse);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('access-jwt-123');
    expect(state.refreshToken).toBe('refresh-jwt-123');
    expect(state.user?.username).toBe('testuser');

    expect(await secureStorage.getItem('access_token')).toBe('access-jwt-123');
    expect(await secureStorage.getItem('refresh_token')).toBe('refresh-jwt-123');
  });

  it('clears state and storage upon logout', async () => {
    const mockAuthResponse: AuthResponse = {
      user: {
        id: 'user-123',
        email: 'user@example.com',
        username: 'testuser',
        displayName: 'Test User',
        status: 'online',
      },
      tokens: {
        accessToken: 'access-jwt',
        refreshToken: 'refresh-jwt',
        expiresIn: 900,
        tokenType: 'Bearer',
      },
    };

    await useAuthStore.getState().setSession(mockAuthResponse);

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();

    expect(await secureStorage.getItem('access_token')).toBeNull();
    expect(await secureStorage.getItem('refresh_token')).toBeNull();
  });

  it('hydrates authentication state from secure storage', async () => {
    const mockUser: UserProfile = {
      id: 'user-123',
      email: 'user@example.com',
      username: 'testuser',
      displayName: 'Test User',
      status: 'online',
    };

    await secureStorage.setItem('access_token', 'stored-access-token');
    await secureStorage.setItem('refresh_token', 'stored-refresh-token');
    await secureStorage.setItem('user_data', JSON.stringify(mockUser));

    await useAuthStore.getState().hydrateAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('stored-access-token');
    expect(state.user?.username).toBe('testuser');
  });
});
