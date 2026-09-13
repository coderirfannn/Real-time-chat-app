/**
 * ChatLock Design System — Color Tokens
 * Derived faithfully from Figma E-Chat UI Kit Reference
 */

export const brandColors = {
  primary: '#246BFD',
  primaryHover: '#1E58D4',
  primaryActive: '#1650C7',
  primaryLight: '#E9F0FF',
  primaryDarkTint: 'rgba(36, 107, 253, 0.15)',
  secondary: '#335EF7',
  accent: '#FF4D4F',
} as const;

export const semanticColors = {
  success: '#12D18E',
  warning: '#FFB800',
  error: '#F75555',
  info: '#246BFD',
  online: '#12D18E',
  offline: '#757B8C',
  typing: '#246BFD',
} as const;

export const avatarPalette = [
  '#246BFD', // Royal Cobalt
  '#12D18E', // Emerald
  '#FF7A00', // Warm Amber
  '#FF4565', // Rose Red
  '#9B51E0', // Purple
  '#00B8D9', // Cyan
  '#F75555', // Coral
  '#6366F1', // Indigo
] as const;

export interface ThemeColors {
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryTint: string;
  background: string;
  surface: string;
  surfaceSecondary: string;
  surfaceElevated: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textPlaceholder: string;
  textInverse: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  online: string;
  offline: string;
  bubbleOutbound: string;
  bubbleInbound: string;
  bubbleOutboundText: string;
  bubbleInboundText: string;
  // Navigation active states
  navActive: string;
  navActiveTint: string;
  // Composer / input
  composerBg: string;
  inputBg: string;
}

export const darkColors: ThemeColors = {
  primary: brandColors.primary,
  primaryHover: brandColors.primaryHover,
  primaryActive: brandColors.primaryActive,
  primaryTint: brandColors.primaryDarkTint,
  background: '#181A20',
  surface: '#1F222A',
  surfaceSecondary: '#262A34',
  surfaceElevated: '#35383F',
  border: '#2A2D36',
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A5B5',
  textMuted: '#757B8C',
  textPlaceholder: '#616675',
  textInverse: '#181A20',
  success: semanticColors.success,
  warning: semanticColors.warning,
  error: semanticColors.error,
  info: semanticColors.info,
  online: semanticColors.online,
  offline: semanticColors.offline,
  bubbleOutbound: brandColors.primary,
  bubbleInbound: '#1F222A',
  bubbleOutboundText: '#FFFFFF',
  bubbleInboundText: '#FFFFFF',
  navActive: '#262A34',
  navActiveTint: 'rgba(36, 107, 253, 0.12)',
  composerBg: '#1F222A',
  inputBg: '#1F222A',
};

export const lightColors: ThemeColors = {
  primary: brandColors.primary,
  primaryHover: brandColors.primaryHover,
  primaryActive: brandColors.primaryActive,
  primaryTint: brandColors.primaryLight,
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceSecondary: '#F5F6F8',
  surfaceElevated: '#FFFFFF',
  border: '#E5E7EB',
  borderSubtle: 'rgba(0, 0, 0, 0.06)',
  textPrimary: '#181A20',
  textSecondary: '#616161',
  textMuted: '#9E9E9E',
  textPlaceholder: '#BDBDBD',
  textInverse: '#FFFFFF',
  success: semanticColors.success,
  warning: semanticColors.warning,
  error: semanticColors.error,
  info: semanticColors.info,
  online: semanticColors.online,
  offline: semanticColors.offline,
  bubbleOutbound: brandColors.primary,
  bubbleInbound: '#F0F2F6',
  bubbleOutboundText: '#FFFFFF',
  bubbleInboundText: '#181A20',
  navActive: '#EFF2FF',
  navActiveTint: 'rgba(36, 107, 253, 0.08)',
  composerBg: '#FFFFFF',
  inputBg: '#F5F6F8',
};
