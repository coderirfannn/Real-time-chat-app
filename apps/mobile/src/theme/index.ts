/**
 * ChatLock Design System — Theme Root & Hook
 * Unified Design Token System mapped to Figma E-Chat UI Kit
 */

import { useColorScheme } from 'react-native';
import { useAppStore } from '../store/app.store';
import { darkColors, lightColors, type ThemeColors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { radius } from './radius';
import { shadows } from './shadows';


export interface Theme {
  isDark: boolean;
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: typeof shadows;
}

export function getTheme(mode: 'light' | 'dark'): Theme {
  const isDark = mode === 'dark';
  return {
    isDark,
    colors: isDark ? darkColors : lightColors,
    typography,
    spacing,
    radius,
    shadows,
  };
}

export function useTheme(): Theme {
  const systemScheme = useColorScheme();
  const storeTheme = useAppStore((state) => state.theme);

  const effectiveMode =
    storeTheme === 'system' ? (systemScheme === 'dark' ? 'dark' : 'dark') : storeTheme; // Defaulting to dark as ChatLock canonical dark

  return getTheme(effectiveMode as 'light' | 'dark');
}

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './radius';
export * from './shadows';
