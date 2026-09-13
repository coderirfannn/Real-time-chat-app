/**
 * ChatLock UI Kit — AppShell Component
 * Responsive application shell providing adaptive layout between mobile bottom bar and desktop sidebar rail
 */

import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

import { BottomTabBar, type MainTabKey } from './BottomTabBar';
import { NavigationRail } from './NavigationRail';

export interface AppShellProps {
  children?: React.ReactNode;
  activeTab?: MainTabKey;
  onSelectTab?: (tab: MainTabKey) => void;
  showNavigation?: boolean;
  unreadCount?: number;
}

export function AppShell({
  children,
  activeTab = 'chats',
  onSelectTab = () => {},
  showNavigation = true,
  unreadCount = 0,
}: AppShellProps): React.JSX.Element {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  if (isDesktop) {
    return (
      <View style={styles.desktopRoot}>
        <NavigationRail activeTab={activeTab} onSelectTab={onSelectTab} unreadCount={unreadCount} />

        <View style={styles.desktopMainContent}>
          <View style={styles.desktopConstrainedContainer}>{children}</View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mobileRoot}>
      <View style={styles.mobileContent}>{children}</View>

      {showNavigation && (
        <BottomTabBar activeTab={activeTab} onSelectTab={onSelectTab} unreadCount={unreadCount} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mobileRoot: {
    flex: 1,
    backgroundColor: '#181A20',
    justifyContent: 'space-between',
  },
  mobileContent: {
    flex: 1,
  },
  desktopRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#181A20',
    height: '100%',
    overflow: 'hidden',
  },
  desktopMainContent: {
    flex: 1,
    height: '100%',
    backgroundColor: '#181A20',
  },
  desktopConstrainedContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#181A20',
  },
});
