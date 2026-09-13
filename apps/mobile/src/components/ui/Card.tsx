/**
 * ChatLock UI Kit — Card Component
 * Standard elevated card container with subtle borders and curved corners
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

export interface CardProps {
  children?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  activeOpacity?: number;
}

export function Card({
  children,
  onPress,
  style,
  padding = 'md',
  activeOpacity = 0.8,
}: CardProps): React.JSX.Element {
  const paddingStyle =
    padding === 'none'
      ? styles.paddingNone
      : padding === 'sm'
        ? styles.paddingSm
        : padding === 'lg'
          ? styles.paddingLg
          : styles.paddingMd;

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.baseCard, paddingStyle, style]}
        onPress={onPress}
        activeOpacity={activeOpacity}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.baseCard, paddingStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  baseCard: {
    backgroundColor: '#1F222A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  paddingNone: {
    padding: 0,
  },
  paddingSm: {
    padding: 12,
  },
  paddingMd: {
    padding: 16,
  },
  paddingLg: {
    padding: 22,
  },
});
