import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type BadgeVariant = 'primary' | 'muted' | 'success' | 'error';

export interface BadgeProps {
  count: number;
  max?: number;
  variant?: BadgeVariant;
  accessibilityRole?: 'text' | 'none';
  accessibilityLabel?: string;
}

export function Badge({
  count,
  max = 99,
  variant = 'primary',
  accessibilityRole = 'text',
  accessibilityLabel,
}: BadgeProps): React.JSX.Element | null {
  if (!count || count <= 0) return null;

  const displayCount = count > max ? `${max}+` : `${count}`;

  const variantStyle =
    variant === 'muted'
      ? styles.badgeMuted
      : variant === 'success'
        ? styles.badgeSuccess
        : variant === 'error'
          ? styles.badgeError
          : styles.badgePrimary;

  return (
    <View
      style={[styles.badge, variantStyle]}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel || `${count} unread messages`}
    >
      <Text style={styles.text}>{displayCount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    minWidth: 22,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgePrimary: {
    backgroundColor: '#246BFD',
  },
  badgeMuted: {
    backgroundColor: '#35383F',
  },
  badgeSuccess: {
    backgroundColor: '#12D18E',
  },
  badgeError: {
    backgroundColor: '#F75555',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
