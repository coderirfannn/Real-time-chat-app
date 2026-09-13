/**
 * ChatLock Design System — Shadows & Elevation Tokens
 * Subtle depth hierarchy for cards, modals, and floating controls.
 * Uses modern boxShadow on web to eliminate React Native Web deprecation warnings,
 * while maintaining native shadow/elevation on iOS and Android.
 */

import { Platform } from 'react-native';

export const shadows = {
  none: Platform.select({
    web: {
      boxShadow: 'none',
    },
    default: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  }),
  sm: Platform.select({
    web: {
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
    },
    default: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 2,
      elevation: 2,
    },
  }),
  md: Platform.select({
    web: {
      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.12)',
    },
    default: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
      elevation: 4,
    },
  }),
  lg: Platform.select({
    web: {
      boxShadow: '0 8px 20px rgba(0, 0, 0, 0.16)',
    },
    default: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.24,
      shadowRadius: 12,
      elevation: 8,
    },
  }),
} as const;
