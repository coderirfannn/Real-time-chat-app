/**
 * ChatLock UI Kit — BottomTabBar Component
 * Mobile bottom navigation bar matching Figma E-Chat specs:
 * active state = pill-shaped tinted background behind icon (not a dot indicator)
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brandColors } from '../../theme/colors';
import { Badge } from '../Badge';
import { Icon, type IconName } from '../ui/Icon';

export type MainTabKey = 'chats' | 'settings';

export interface TabItemConfig {
  key: MainTabKey;
  label: string;
  icon: IconName;
  badgeCount?: number;
}

export interface BottomTabBarProps {
  activeTab: MainTabKey;
  onSelectTab: (tab: MainTabKey) => void;
  unreadCount?: number;
}

export function BottomTabBar({
  activeTab,
  onSelectTab,
  unreadCount = 0,
}: BottomTabBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  const tabs: TabItemConfig[] = [
    {
      key: 'chats',
      label: 'Chats',
      icon: 'chat',
      badgeCount: unreadCount,
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: 'settings',
    },
  ];

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      <View style={styles.tabBarInner}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabButton}
              onPress={() => onSelectTab(tab.key)}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label} tab`}
            >
              {/* Pill-shaped tinted background — the Figma active indicator */}
              <View
                style={[
                  styles.iconPill,
                  isActive && styles.iconPillActive,
                ]}
              >
                <Icon
                  name={tab.icon}
                  size={22}
                  color={isActive ? brandColors.primary : '#757B8C'}
                />

                {Boolean(tab.badgeCount && tab.badgeCount > 0) && (
                  <View style={styles.badgeWrapper}>
                    <Badge count={tab.badgeCount ?? 0} />
                  </View>
                )}
              </View>

              <Text
                style={[
                  styles.tabLabel,
                  isActive ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#181A20',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2D36',
    paddingTop: 6,
    width: '100%',
    ...Platform.select({
      web: {
        borderTopWidth: 1,
      },
    }),
  },
  tabBarInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 56,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minHeight: 56,
  },
  // Pill shape behind the icon — visible only when active
  iconPill: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 30,
    borderRadius: 15,
    marginBottom: 3,
  },
  iconPillActive: {
    backgroundColor: 'rgba(36, 107, 253, 0.12)',
  },
  badgeWrapper: {
    position: 'absolute',
    top: -4,
    right: -2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: brandColors.primary,
    fontWeight: '700',
  },
  tabLabelInactive: {
    color: '#757B8C',
  },
});
