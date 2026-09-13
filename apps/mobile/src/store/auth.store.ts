import { create } from 'zustand';
import type { UserProfile, AuthResponse } from '@chatlock/shared-types';
import { secureStorage } from '../services/storage/secure-storage.service';
import { authApi } from '../services/api/auth.api';
import { apiClient } from '../services/api/client';

export interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  hydrateAuth: () => Promise<void>;
  setSession: (response: AuthResponse) => Promise<void>;
  setUser: (user: UserProfile) => void;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false; // If non-JWT format (e.g. mock test tokens), do not assume expired
    }
    const payloadPart = parts[1];
    if (!payloadPart) {
      return false;
    }
    let base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonPayload =
      typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
    const payload = JSON.parse(jsonPayload);
    if (typeof payload.exp === 'number') {
      // Buffer of 10 seconds before expiration
      return Date.now() >= payload.exp * 1000 - 10000;
    }
  } catch {
    return false;
  }
  return false;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  hydrateAuth: async () => {
    set({ isLoading: true });
    try {
      const accessToken = await secureStorage.getItem('access_token');
      const refreshToken = await secureStorage.getItem('refresh_token');
      const userJson = await secureStorage.getItem('user_data');

      if (!accessToken || !refreshToken) {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return;
      }

      let parsedUser: UserProfile | null = null;
      if (userJson) {
        try {
          parsedUser = JSON.parse(userJson);
        } catch {
          // ignore corrupted json
        }
      }

      let validAccessToken = accessToken;
      let validRefreshToken = refreshToken;

      // If the access token has expired while app was closed or idle, proactively refresh
      if (isTokenExpired(accessToken)) {
        const freshAccessToken = await apiClient.handleTokenRefresh();
        if (freshAccessToken) {
          validAccessToken = freshAccessToken;
          validRefreshToken = (await secureStorage.getItem('refresh_token')) || refreshToken;
        } else {
          // Refresh token expired or revoked - clear session cleanly
          await get().logout();
          return;
        }
      }

      set({
        user: parsedUser,
        accessToken: validAccessToken,
        refreshToken: validRefreshToken,
        isAuthenticated: true,
        isLoading: false,
      });

      // Background validation of session to ensure freshness
      try {
        const currentUser = await authApi.getMe();
        if (currentUser && currentUser.id) {
          set({ user: currentUser });
          await secureStorage.setItem('user_data', JSON.stringify(currentUser));
        }
      } catch {
        // If getMe fails and cannot be refreshed, the interceptor handles logout
      }
    } catch {
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  setSession: async (response: AuthResponse) => {
    const { user, tokens } = response;
    await secureStorage.setItem('access_token', tokens.accessToken);
    await secureStorage.setItem('refresh_token', tokens.refreshToken);
    await secureStorage.setItem('user_data', JSON.stringify(user));

    set({
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  setUser: (user: UserProfile) => {
    set({ user });
    secureStorage.setItem('user_data', JSON.stringify(user)).catch(() => {});
  },

  setTokens: async (accessToken: string, refreshToken: string) => {
    await secureStorage.setItem('access_token', accessToken);
    await secureStorage.setItem('refresh_token', refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },

  logout: async () => {
    const { refreshToken } = get();
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Best effort server logout
      }
    }

    await secureStorage.removeItem('access_token');
    await secureStorage.removeItem('refresh_token');
    await secureStorage.removeItem('user_data');

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));

// Bidirectional synchronization between ApiClient token rotation and useAuthStore
apiClient.setTokenUpdateHandler((accessToken, refreshToken) => {
  useAuthStore.getState().setTokens(accessToken, refreshToken);
});

apiClient.setAuthFailureHandler(() => {
  useAuthStore.getState().logout();
});
