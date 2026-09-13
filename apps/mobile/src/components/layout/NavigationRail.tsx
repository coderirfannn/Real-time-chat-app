/**
 * ChatLock UI Kit — NavigationRail Component
 * Desktop/tablet sidebar navigation.
 * Active state: full rounded-rect pill row background (Figma E-Chat pattern),
 * not a left-border stripe.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { brandColors } from '../../theme/colors';
import { Avatar } from '../Avatar';
import { Badge } from '../Badge';
import { Icon, type IconName } from '../ui/Icon';
import { useAuthStore } from '../../store/auth.store';
import type { MainTabKey } from './BottomTabBar';

export interface NavigationRailProps {
  activeTab: MainTabKey;
  onSelectTab: (tab: MainTabKey) => void;
  unreadCount?: number;
}

export function NavigationRail({
  activeTab,
  onSelectTab,
  unreadCount = 0,
}: NavigationRailProps): React.JSX.Element {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const currentUser = useAuthStore((state) => state.user);

  const tabs: Array<{ key: MainTabKey; label: string; icon: IconName; badgeCount?: number }> = [
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
    <View
      style={[
        styles.container,
        isCollapsed ? styles.containerCollapsed : styles.containerExpanded,
      ]}
    >
      {/* Brand Header */}
      <View style={styles.brandRow}>
        <View style={styles.logoBadge}>
          <Icon name="shield" size={18} color="#FFFFFF" />
        </View>

        {!isCollapsed && (
          <View style={styles.brandTitleWrapper}>
            <Text style={styles.brandTitle}>ChatLock</Text>
            <Text style={styles.brandSubtitle}>Secure Messaging</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.collapseToggle}
          onPress={() => setIsCollapsed(!isCollapsed)}
          activeOpacity={0.7}
          accessibilityLabel={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon
            name={isCollapsed ? 'chevron-right' : 'chevron-left'}
            size={13}
            color="#757B8C"
          />
        </TouchableOpacity>
      </View>

      {/* Nav Tabs */}
      <View style={styles.tabsList}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.navItem,
                isActive && styles.navItemActive,
                isCollapsed && styles.navItemCollapsed,
              ]}
              onPress={() => onSelectTab(tab.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label} navigation tab`}
            >
              {/* Icon with optional dot badge in collapsed mode */}
              <View style={styles.navIconContainer}>
                <Icon
                  name={tab.icon}
                  size={20}
                  color={isActive ? brandColors.primary : '#A0A5B5'}
                />
                {Boolean(tab.badgeCount && tab.badgeCount > 0) && isCollapsed && (
                  <View style={styles.dotBadge} />
                )}
              </View>

              {/* Label + badge count in expanded mode */}
              {!isCollapsed && (
                <View style={styles.navLabelRow}>
                  <Text
                    style={[
                      styles.navLabel,
                      isActive && styles.navLabelActive,
                    ]}
                  >
                    {tab.label}
                  </Text>

                  {Boolean(tab.badgeCount && tab.badgeCount > 0) && (
                    <Badge count={tab.badgeCount ?? 0} />
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* User Profile Footer */}
      <View style={styles.footer}>
        <Avatar
          name={currentUser?.displayName || currentUser?.username || 'User'}
          avatarUrl={currentUser?.avatarUrl}
          size={isCollapsed ? 'xs' : 'sm'}
          isOnline={true}
        />

        {!isCollapsed && (
          <View style={styles.userInfo}>
            <Text style={styles.userDisplayName} numberOfLines={1}>
              {currentUser?.displayName || currentUser?.username || 'Me'}
            </Text>
            <Text style={styles.userHandle} numberOfLines={1}>
              @{currentUser?.username || 'user'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#181A20',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#2A2D36',
    height: '100%',
    paddingVertical: 20,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        transition: 'width 0.2s ease',
        borderRightWidth: 1,
      },
    }),
  },
  containerExpanded: {
    width: 200,
  },
  containerCollapsed: {
    width: 68,
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: brandColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  brandTitleWrapper: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  brandSubtitle: {
    fontSize: 10,
    color: '#757B8C',
    letterSpacing: 0.1,
  },
  collapseToggle: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#262A34',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  tabsList: {
    flex: 1,
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'transparent',
    minHeight: 44,
  },
  // Full row pill background — Figma active state (no left border)
  navItemActive: {
    backgroundColor: '#262A34',
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    width: 48,
    alignSelf: 'center',
  },
  navIconContainer: {
    position: 'relative',
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotBadge: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 9999,
    backgroundColor: brandColors.primary,
  },
  navLabelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 10,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#A0A5B5',
  },
  navLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2D36',
    ...Platform.select({
      web: { borderTopWidth: 1 },
    }),
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userDisplayName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userHandle: {
    fontSize: 11,
    color: '#757B8C',
    marginTop: 1,
  },
});
