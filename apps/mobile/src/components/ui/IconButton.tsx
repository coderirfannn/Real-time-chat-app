import React, { useRef, useCallback } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Icon, type IconName } from './Icon';
import { brandColors } from '../../theme/colors';

export type IconButtonVariant = 'ghost' | 'filled' | 'secondary' | 'primary' | 'danger';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps {
  name: IconName;
  onPress?: () => void;
  onPressIn?: () => void;
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  color?: string;
  iconSize?: number;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function IconButton({
  name,
  onPress,
  onPressIn,
  accessibilityLabel,
  variant = 'ghost',
  size = 'md',
  color,
  iconSize,
  disabled = false,
  loading = false,
  style,
  testID,
}: IconButtonProps): React.JSX.Element {
  const isInteractive = !disabled && !loading;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    onPressIn?.();
    if (!isInteractive) return;
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      speed: 40,
      bounciness: 4,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isInteractive, onPressIn, scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      speed: 30,
      bounciness: 6,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [scaleAnim]);

  const buttonDimensions =
    size === 'sm' ? styles.sizeSm : size === 'lg' ? styles.sizeLg : styles.sizeMd;

  const resolvedIconSize =
    iconSize || (size === 'sm' ? 16 : size === 'lg' ? 24 : 20);

  const defaultColor =
    variant === 'primary'
      ? '#FFFFFF'
      : variant === 'danger'
        ? '#FFFFFF'
        : variant === 'secondary'
          ? '#FFFFFF'
          : color || '#A0A5B5';

  const resolvedColor = color || defaultColor;

  const variantContainerStyle =
    variant === 'primary'
      ? styles.containerPrimary
      : variant === 'secondary'
        ? styles.containerSecondary
        : variant === 'filled'
          ? styles.containerFilled
          : variant === 'danger'
            ? styles.containerDanger
            : styles.containerGhost;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.base,
          buttonDimensions,
          variantContainerStyle,
          disabled && styles.disabled,
          style,
        ]}
        onPress={isInteractive ? onPress : undefined}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!isInteractive}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {loading ? (
          <ActivityIndicator size="small" color={resolvedColor} />
        ) : (
          <Icon name={name} size={resolvedIconSize} color={resolvedColor} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
  },
  sizeSm: {
    width: 36,
    height: 36,
  },
  sizeMd: {
    width: 44,
    height: 44,
  },
  sizeLg: {
    width: 48,
    height: 48,
  },
  containerGhost: {
    backgroundColor: 'transparent',
  },
  containerFilled: {
    backgroundColor: '#1F222A',
  },
  containerSecondary: {
    backgroundColor: '#262A34',
  },
  containerPrimary: {
    backgroundColor: brandColors.primary,
  },
  containerDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  disabled: {
    opacity: 0.4,
  },
});
