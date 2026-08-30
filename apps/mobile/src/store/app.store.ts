import { create } from 'zustand';
import { appStorage } from '../services/storage/app-storage.service.js';

export type AppTheme = 'light' | 'dark' | 'system';

export interface AppState {
  theme: AppTheme;
  isOnline: boolean;

  setTheme: (theme: AppTheme) => Promise<void>;
  setIsOnline: (isOnline: boolean) => void;
  hydrateAppSettings: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'system',
  isOnline: true,

  setTheme: async (theme: AppTheme) => {
    await appStorage.setItem('app_theme', theme);
    set({ theme });
  },

  setIsOnline: (isOnline: boolean) => set({ isOnline }),

  hydrateAppSettings: async () => {
    const savedTheme = (await appStorage.getItem('app_theme')) as AppTheme | null;
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      set({ theme: savedTheme });
    }
  },
}));
