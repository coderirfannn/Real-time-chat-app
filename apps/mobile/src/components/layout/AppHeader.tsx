/**
 * ChatLock UI Kit — AppHeader Component
 * Unified top application header matching Figma E-Chat specs
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../ui/Icon';

export interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  leftAction?: React.ReactNode;
  rightActions?: React.ReactNode;
  hasBorder?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  leftAction,
  rightActions,
  hasBorder = false,
  style,
}: AppHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, 10);

  return (
    <View
      style={[
        styles.headerContainer,
        { paddingTop: topPadding },
        hasBorder && styles.borderBottom,
        style,
      ]}
    >
      <View style={styles.headerContent}>
        {/* Left Action / Back */}
        <View style={styles.leftContainer}>
          {showBack && onBack ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Navigate back"
            >
              <Icon name="arrow-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            leftAction
          )}
        </View>

        {/* Center Title */}
        <View style={styles.centerContainer}>
          {title && (
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text style={styles.subtitleText} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right Actions */}
        <View style={styles.rightContainer}>{rightActions}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#181A20',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D36',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 40,
    justifyContent: 'flex-start',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#262A34',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 12,
    color: '#757B8C',
    marginTop: 2,
    textAlign: 'center',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 40,
    justifyContent: 'flex-end',
    gap: 8,
  },
});
