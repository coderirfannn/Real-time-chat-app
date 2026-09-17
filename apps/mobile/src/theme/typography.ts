import { Platform } from 'react-native';

/**
 * ChatLock Design System — Typography Tokens
 * Premium, ultra-crisp typography with native platform font stacks & letter spacing
 */

export const fontFamilies = {
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif',
    default: 'System',
  }),
  sansMedium: Platform.select({
    ios: 'System',
    android: 'sans-serif-medium',
    web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif',
    default: 'System',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    web: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    default: 'monospace',
  }),
};

export const letterSpacings = {
  tighter: -0.8,
  tight: -0.4,
  normal: 0,
  wide: 0.3,
  wider: 0.6,
  widest: 1.2,
} as const;

export const fontSizes = {
  caption: 10,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 28,
  hero: 32,
} as const;

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
};

export const lineHeights = {
  caption: 14,
  xs: 16,
  sm: 20,
  md: 24,
  lg: 26,
  xl: 28,
  xxl: 32,
  display: 36,
  hero: 40,
} as const;

export const typography = {
  hero: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.hero,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.hero,
    letterSpacing: letterSpacings.tight,
  },
  display: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display,
    letterSpacing: letterSpacings.tight,
  },
  h1: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.xxl,
    letterSpacing: letterSpacings.tight,
  },
  h2: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.xl,
    letterSpacing: letterSpacings.normal,
  },
  h3: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semiBold,
    lineHeight: lineHeights.lg,
    letterSpacing: letterSpacings.normal,
  },
  bodyLg: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.md,
    letterSpacing: letterSpacings.normal,
  },
  bodyLgMedium: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.md,
    letterSpacing: letterSpacings.normal,
  },
  bodyLgBold: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semiBold,
    lineHeight: lineHeights.md,
    letterSpacing: letterSpacings.normal,
  },
  body: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.sm,
    letterSpacing: letterSpacings.normal,
  },
  bodyMedium: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.sm,
    letterSpacing: letterSpacings.normal,
  },
  bodyBold: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semiBold,
    lineHeight: lineHeights.sm,
    letterSpacing: letterSpacings.normal,
  },
  caption: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.xs,
    letterSpacing: letterSpacings.wide,
  },
  micro: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.caption,
    letterSpacing: letterSpacings.wide,
  },
  code: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.xs,
  },
};
