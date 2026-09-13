import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { avatarPalette } from '../theme/colors';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  name: string;
  avatarUrl?: string;
  size?: AvatarSize;
  isOnline?: boolean;
  hasRing?: boolean;
  accessibilityRole?: 'image' | 'button' | 'none';
  accessibilityLabel?: string;
}

function getAvatarColor(name: string): string {
  if (!name) return avatarPalette[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatarPalette.length;
  return avatarPalette[index] ?? avatarPalette[0];
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  if (parts.length === 1) {
    return first.substring(0, 2).toUpperCase();
  }
  const last = parts[parts.length - 1] ?? '';
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?';
}

export function getAvatarAccessibilityLabel(name: string, isOnline?: boolean): string {
  return `${name || 'User'} avatar${isOnline ? ', online' : ''}`;
}

export function Avatar({

  name,
  avatarUrl,
  size = 'md',
  isOnline = false,
  hasRing = false,
  accessibilityRole = 'image',
  accessibilityLabel,
}: AvatarProps): React.JSX.Element {
  const initials = useMemo(() => getInitials(name), [name]);
  const backgroundColor = useMemo(() => getAvatarColor(name), [name]);


  const sizeStyle =
    size === 'xs'
      ? styles.sizeXs
      : size === 'sm'
        ? styles.sizeSm
        : size === 'lg'
          ? styles.sizeLg
          : size === 'xl'
            ? styles.sizeXl
            : styles.sizeMd;

  const textSizeStyle =
    size === 'xs'
      ? styles.textXs
      : size === 'sm'
        ? styles.textSm
        : size === 'lg'
          ? styles.textLg
          : size === 'xl'
            ? styles.textXl
            : styles.textMd;

  const dotSizeStyle =
    size === 'xs'
      ? styles.dotXs
      : size === 'sm'
        ? styles.dotSm
        : size === 'lg'
          ? styles.dotLg
          : size === 'xl'
            ? styles.dotXl
            : styles.dotMd;

  return (
    <View
      style={[styles.wrapper, sizeStyle, hasRing ? styles.ringWrapper : null]}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={
        accessibilityLabel || getAvatarAccessibilityLabel(name, isOnline)
      }
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={[styles.image, sizeStyle]} />
      ) : (
        <View style={[styles.fallback, sizeStyle, { backgroundColor }]}>
          <Text style={[styles.initials, textSizeStyle]}>{initials}</Text>
        </View>
      )}
      {isOnline && <View style={[styles.onlineDot, dotSizeStyle]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringWrapper: {
    borderWidth: 2,
    borderColor: '#246BFD',
    borderRadius: 9999,
    padding: 2,
  },
  fallback: {
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    borderRadius: 9999,
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sizeXs: {
    width: 26,
    height: 26,
  },
  sizeSm: {
    width: 36,
    height: 36,
  },
  sizeMd: {
    width: 48,
    height: 48,
  },
  sizeLg: {
    width: 58,
    height: 58,
  },
  sizeXl: {
    width: 72,
    height: 72,
  },
  textXs: {
    fontSize: 10,
    fontWeight: '700',
  },
  textSm: {
    fontSize: 13,
    fontWeight: '700',
  },
  textMd: {
    fontSize: 17,
    fontWeight: '700',
  },
  textLg: {
    fontSize: 22,
    fontWeight: '700',
  },
  textXl: {
    fontSize: 28,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#12D18E',
    borderWidth: 2,
    borderColor: '#181A20',
    borderRadius: 9999,
  },
  dotXs: {
    width: 8,
    height: 8,
  },
  dotSm: {
    width: 10,
    height: 10,
  },
  dotMd: {
    width: 13,
    height: 13,
  },
  dotLg: {
    width: 15,
    height: 15,
  },
  dotXl: {
    width: 18,
    height: 18,
  },
});
