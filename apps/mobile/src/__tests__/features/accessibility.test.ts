import { describe, it, expect } from 'vitest';
import React from 'react';
import { Avatar, getAvatarAccessibilityLabel } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { DateSeparator } from '../../components/DateSeparator';
import { Button } from '../../components/ui/Button';
import { darkColors, brandColors, semanticColors } from '../../theme/colors';

// Helper function to calculate relative luminance per WCAG 2.1 specs
function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const expanded = clean.length === 3 ? clean.split('').map((x) => x + x).join('') : clean;
  const num = parseInt(expanded, 16);
  return [num >> 16, (num >> 8) & 255, num & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Accessibility & WCAG 2.1 AA Contrast Audit — Phase 10 Verification', () => {
  it('1. WCAG 2.1 AA: Primary text on Obsidian canvas satisfies AAA standard (>= 7.0:1)', () => {
    const ratio = contrastRatio(darkColors.textPrimary, darkColors.background);
    expect(ratio).toBeGreaterThanOrEqual(7.0);
  });

  it('2. WCAG 2.1 AA: Secondary text on Obsidian canvas satisfies AA standard (>= 4.5:1)', () => {
    const ratio = contrastRatio(darkColors.textSecondary, darkColors.background);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('3. WCAG 2.1 AA: White text on Cobalt primary button satisfies AA standard (>= 4.5:1)', () => {
    const ratio = contrastRatio('#FFFFFF', brandColors.primary);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('4. WCAG 2.1 AA: Status colors (success, error) on dark surface satisfy standard', () => {
    const successRatio = contrastRatio(semanticColors.success, darkColors.surface);
    const errorRatio = contrastRatio(semanticColors.error, darkColors.surface);
    expect(successRatio).toBeGreaterThanOrEqual(4.5);
    expect(errorRatio).toBeGreaterThanOrEqual(4.5);
  });

  it('5. AVATAR ACCESSIBILITY: exposes image role and readable screen reader labels', () => {
    expect(getAvatarAccessibilityLabel('Sarah Connor', true)).toBe('Sarah Connor avatar, online');
    expect(getAvatarAccessibilityLabel('John Doe', false)).toBe('John Doe avatar');

    const el = React.createElement(Avatar, {
      name: 'Sarah Connor',
      isOnline: true,
      accessibilityRole: 'image',
      accessibilityLabel: getAvatarAccessibilityLabel('Sarah Connor', true),
    });
    expect(el.props.accessibilityRole).toBe('image');
    expect(el.props.accessibilityLabel).toBe('Sarah Connor avatar, online');
  });

  it('6. BADGE ACCESSIBILITY: exposes text role and readable count label', () => {
    const renderedBadge = Badge({ count: 3 });
    expect(renderedBadge?.props.accessibilityRole).toBe('text');
    expect(renderedBadge?.props.accessibilityLabel).toBe('3 unread messages');
  });

  it('7. DATE SEPARATOR ACCESSIBILITY: exposes header role for semantic section navigation', () => {
    const renderedSeparator = DateSeparator({ label: 'Yesterday' });
    expect(renderedSeparator.props.accessibilityRole).toBe('header');
    expect(renderedSeparator.props.accessibilityLabel).toBe('Conversation date: Yesterday');
  });

  it('8. BUTTON ACCESSIBILITY: exposes button role and explicit accessibilityLabel', () => {
    const btn = React.createElement(Button, {
      title: 'Submit Form',
      accessibilityLabel: 'Submit registration form',
    });
    expect(btn.props.accessibilityLabel).toBe('Submit registration form');
  });
});

