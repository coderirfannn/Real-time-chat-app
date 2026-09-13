/**
 * ChatLock UI Kit — Button Component
 * Standardized primary, secondary, outline, ghost, and danger variants matching Figma E-Chat
 */

import React, { useRef, useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  Animated,
  Platform,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { brandColors, semanticColors } from '../../theme/colors';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export function Button({
  title,
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  style,
  textStyle,
  accessibilityLabel,
}: ButtonProps): React.JSX.Element {
  const isInteractive = !disabled && !loading;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (!isInteractive) return;
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      speed: 40,
      bounciness: 4,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isInteractive, scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      speed: 30,
      bounciness: 6,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [scaleAnim]);

  const sizeContainerStyle =
    size === 'sm' ? styles.containerSm : size === 'lg' ? styles.containerLg : styles.containerMd;

  const sizeTextStyle =
    size === 'sm' ? styles.textSm : size === 'lg' ? styles.textLg : styles.textMd;

  const variantContainerStyle =
    variant === 'secondary'
      ? styles.containerSecondary
      : variant === 'outline'
        ? styles.containerOutline
        : variant === 'ghost'
          ? styles.containerGhost
          : variant === 'danger'
            ? styles.containerDanger
            : styles.containerPrimary;

  const variantTextStyle =
    variant === 'outline' || variant === 'ghost' ? styles.textAccent : styles.textWhite;

  const spinnerColor =
    variant === 'outline' || variant === 'ghost' ? brandColors.primary : '#FFFFFF';

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, fullWidth && styles.fullWidth]}>
      <TouchableOpacity
        style={[
          styles.baseContainer,
          sizeContainerStyle,
          variantContainerStyle,
          fullWidth && styles.fullWidth,
          disabled && styles.disabled,
          style,
        ]}
        onPress={isInteractive ? onPress : undefined}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.85}
        disabled={!isInteractive}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
      >
        {loading ? (
          <ActivityIndicator size="small" color={spinnerColor} />
        ) : (
          <View style={styles.contentRow}>
            {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}
            {title ? (
              <Text style={[styles.baseText, sizeTextStyle, variantTextStyle, textStyle]}>
                {title}
              </Text>
            ) : (
              children
            )}
            {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  baseContainer: {
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  containerSm: {
    height: 36,
    paddingHorizontal: 16,
  },
  containerMd: {
    height: 48,
    paddingHorizontal: 22,
  },
  containerLg: {
    height: 56,
    paddingHorizontal: 28,
  },
  containerPrimary: {
    backgroundColor: brandColors.primary,
  },
  containerSecondary: {
    backgroundColor: '#262A34',
  },
  containerOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: brandColors.primary,
  },
  containerGhost: {
    backgroundColor: 'transparent',
  },
  containerDanger: {
    backgroundColor: semanticColors.error,
  },
  disabled: {
    opacity: 0.45,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  baseText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  textSm: {
    fontSize: 13,
  },
  textMd: {
    fontSize: 15,
  },
  textLg: {
    fontSize: 16,
  },
  textWhite: {
    color: '#FFFFFF',
  },
  textAccent: {
    color: brandColors.primary,
  },
});
