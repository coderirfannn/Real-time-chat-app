/**
 * ChatLock Design System — Border Radius Tokens
 * Curved geometry matching the modern Figma E-Chat UI Kit
 */

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 30,
  full: 9999,
} as const;

export type RadiusKey = keyof typeof radius;
