import { create } from 'zustand';
import type { UserProfile, AuthResponse } from '@chatlock/shared-types';
import { secureStorage } from '../services/storage/secure-storage.service.js';
import { authApi } from '../services/api/auth.api.js';

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

      set({
        user: parsedUser,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });

      // Background validation of session
      try {
        const currentUser = await authApi.getMe();
        if (currentUser && currentUser.id) {
          set({ user: currentUser });
          await secureStorage.setItem('user_data', JSON.stringify(currentUser));
        }
      } catch {
        // If getMe fails and cannot be refreshed, let the interceptor handle logout
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
