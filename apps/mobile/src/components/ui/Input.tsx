/**
 * ChatLock UI Kit — Input Component
 * Production-grade form text input with focus states, icons, and error handling
 */

import React, { useState, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { brandColors, semanticColors } from '../../theme/colors';
import { Icon } from './Icon';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, iconLeft, iconRight, containerStyle, inputStyle, onFocus, onBlur, ...rest },
  ref,
): React.JSX.Element {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const hasError = Boolean(error);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          hasError && styles.inputError,
        ]}
      >
        {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}

        <TextInput
          ref={ref}
          style={[styles.input, inputStyle]}
          placeholderTextColor="#757B8C"
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...rest}
        />

        {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
      </View>

      {hasError ? (
        <View style={styles.errorRow}>
          <Icon name="alert-circle" size={12} color={semanticColors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F222A',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#2A2D36',
    paddingHorizontal: 16,
    height: 52,
  },
  inputFocused: {
    borderColor: brandColors.primary,
    backgroundColor: '#262A34',
  },
  inputError: {
    borderColor: semanticColors.error,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#FFFFFF',
    fontSize: 15,
  },
  iconLeft: {
    marginRight: 12,
  },
  iconRight: {
    marginLeft: 12,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    marginLeft: 4,
  },
  errorText: {
    color: semanticColors.error,
    fontSize: 12,
    fontWeight: '500',
  },
  hintText: {
    color: '#757B8C',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});
