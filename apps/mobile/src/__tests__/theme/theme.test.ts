import { describe, it, expect } from 'vitest';
import {
  brandColors,
  semanticColors,
  darkColors,
  lightColors,
  avatarPalette,
  typography,
  fontSizes,
  fontWeights,
  spacing,
  radius,
  shadows,
  getTheme,
} from '../../theme';

describe('Design System Theme & Tokens — Task Phase 1 Verification', () => {
  it('1. BRAND COLORS: defines electric cobalt blue primary and semantic status colors', () => {
    expect(brandColors.primary).toBe('#246BFD');
    expect(semanticColors.success).toBe('#12D18E');
    expect(semanticColors.error).toBe('#F75555');
    expect(avatarPalette.length).toBeGreaterThanOrEqual(6);
    expect(avatarPalette).toContain('#246BFD');
  });

  it('2. THEME MODES: darkColors matches Figma E-Chat dark canvas hierarchy', () => {
    expect(darkColors.background).toBe('#181A20');
    expect(darkColors.surface).toBe('#1F222A');
    expect(darkColors.surfaceSecondary).toBe('#262A34');
    expect(darkColors.textPrimary).toBe('#FFFFFF');
    expect(darkColors.bubbleOutbound).toBe('#246BFD');
    expect(darkColors.bubbleInbound).toBe('#1F222A');
  });

  it('3. THEME MODES: lightColors provides high-contrast clean surface tokens', () => {
    expect(lightColors.background).toBe('#FAFAFA');
    expect(lightColors.surface).toBe('#FFFFFF');
    expect(lightColors.textPrimary).toBe('#181A20');
    expect(lightColors.bubbleOutbound).toBe('#246BFD');
  });

  it('4. TYPOGRAPHY: provides structured font sizes, weights, and line heights', () => {
    expect(fontSizes.caption).toBe(10);
    expect(fontSizes.sm).toBe(14);
    expect(fontSizes.md).toBe(16);
    expect(fontSizes.xxl).toBe(24);
    expect(fontWeights.bold).toBe('700');
    expect(typography.h1.fontSize).toBe(24);
    expect(typography.body.fontSize).toBe(14);
  });

  it('5. SPACING & RADIUS: follows 4px grid and curved geometry scale', () => {
    expect(spacing.xs).toBe(4);
    expect(spacing.sm).toBe(8);
    expect(spacing.md).toBe(12);
    expect(spacing.lg).toBe(16);
    expect(spacing.xl).toBe(20);

    expect(radius.sm).toBe(8);
    expect(radius.md).toBe(12);
    expect(radius.lg).toBe(16);
    expect(radius.pill).toBe(30);
    expect(radius.full).toBe(9999);
    expect(shadows.sm).toBeDefined();
    expect(shadows.md).toBeDefined();
  });

  it('6. THEME HELPER: getTheme returns complete themed structure for dark and light', () => {
    const darkTheme = getTheme('dark');
    expect(darkTheme.isDark).toBe(true);
    expect(darkTheme.colors.background).toBe('#181A20');
    expect(darkTheme.radius.full).toBe(9999);

    const lightTheme = getTheme('light');
    expect(lightTheme.isDark).toBe(false);
    expect(lightTheme.colors.background).toBe('#FAFAFA');
    expect(lightTheme.colors.textPrimary).toBe('#181A20');
  });

  it('7. CONTRAST & ACCESSIBILITY: light and dark themes have distinct high-contrast surface colors', () => {
    const dark = getTheme('dark');
    const light = getTheme('light');

    expect(dark.colors.background).not.toBe(light.colors.background);
    expect(dark.colors.textPrimary).not.toBe(light.colors.textPrimary);
    expect(dark.colors.composerBg).toBe('#1F222A');
    expect(light.colors.composerBg).toBe('#FFFFFF');
  });
});
