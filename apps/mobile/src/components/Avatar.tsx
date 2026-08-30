import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  name: string;
  avatarUrl?: string;
  size?: AvatarSize;
  isOnline?: boolean;
}

const AVATAR_COLORS = [
  '#0284C7', // Sky
  '#0D9488', // Teal
  '#16A34A', // Green
  '#D97706', // Amber
  '#DC2626', // Red
  '#7C3AED', // Violet
  '#DB2777', // Pink
  '#4F46E5', // Indigo
];

function getAvatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0] ?? '#0284C7';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index] ?? '#0284C7';
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

export function Avatar({
  name,
  avatarUrl,
  size = 'md',
  isOnline = false,
}: AvatarProps): React.JSX.Element {
  const initials = useMemo(() => getInitials(name), [name]);
  const backgroundColor = useMemo(() => getAvatarColor(name), [name]);

  const sizeStyle = size === 'sm' ? styles.sizeSm : size === 'lg' ? styles.sizeLg : styles.sizeMd;
  const textSizeStyle =
    size === 'sm' ? styles.textSm : size === 'lg' ? styles.textLg : styles.textMd;
  const dotSizeStyle = size === 'sm' ? styles.dotSm : size === 'lg' ? styles.dotLg : styles.dotMd;

  return (
    <View style={[styles.wrapper, sizeStyle]}>
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
  fallback: {
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    borderRadius: 999,
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sizeSm: {
    width: 32,
    height: 32,
  },
  sizeMd: {
    width: 44,
    height: 44,
  },
  sizeLg: {
    width: 56,
    height: 56,
  },
  textSm: {
    fontSize: 12,
  },
  textMd: {
    fontSize: 16,
  },
  textLg: {
    fontSize: 22,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#0F172A',
    borderRadius: 999,
  },
  dotSm: {
    width: 10,
    height: 10,
  },
  dotMd: {
    width: 12,
    height: 12,
  },
  dotLg: {
    width: 14,
    height: 14,
  },
});
