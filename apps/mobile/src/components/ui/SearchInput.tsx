/**
 * ChatLock UI Kit — SearchInput Component
 * Full pill search bar matching Figma E-Chat conversation filter specifications
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { brandColors } from '../../theme/colors';
import { Icon } from './Icon';

export interface SearchInputProps extends Omit<TextInputProps, 'onChange'> {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export function SearchInput({
  value,
  onChangeText,
  onClear,
  placeholder = 'Search...',
  containerStyle,
  ...rest
}: SearchInputProps): React.JSX.Element {
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  return (
    <View style={[styles.container, isFocused && styles.containerFocused, containerStyle]}>
      <Icon name="search" size={16} color="#757B8C" style={styles.searchIcon} />

      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#757B8C"
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        {...rest}
      />

      {Boolean(value) && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClear}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Clear search input"
        >
          <View style={styles.clearCircle}>
            <Icon name="close" size={10} color="#A0A5B5" strokeWidth={2.5} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F222A',
    borderRadius: 9999,
    paddingHorizontal: 16,
    height: 44,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  containerFocused: {
    borderColor: brandColors.primary,
    backgroundColor: '#262A34',
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 10,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
    marginLeft: 6,
  },
  clearCircle: {
    width: 18,
    height: 18,
    borderRadius: 9999,
    backgroundColor: '#35383F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearText: {
    color: '#A0A5B5',
    fontSize: 10,
    fontWeight: '700',
  },
});
