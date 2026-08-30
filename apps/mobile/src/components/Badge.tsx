import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface BadgeProps {
  count: number;
  max?: number;
}

export function Badge({ count, max = 99 }: BadgeProps): React.JSX.Element | null {
  if (!count || count <= 0) return null;

  const displayCount = count > max ? `${max}+` : `${count}`;

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{displayCount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#0284C7',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
