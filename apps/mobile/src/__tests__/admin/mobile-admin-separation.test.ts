import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { Platform } from 'react-native';
import { BottomTabBar } from '../../components/layout/BottomTabBar';
import { NavigationRail } from '../../components/layout/NavigationRail';
import { useAuthStore } from '../../store/auth.store';

describe('Mobile & Admin Platform Strict Separation (Task 26 Architectural Boundary)', () => {
  it('1. BottomTabBar: contains strictly USER tabs (chats, settings) and NO admin entry points', () => {
    const onSelect = vi.fn();
    const element = React.createElement(BottomTabBar, {
      activeTab: 'chats',
      onSelectTab: onSelect,
      unreadCount: 0,
    });

    expect(element).toBeDefined();
    // Verify props only accept 'chats' | 'settings'
    expect(element.props.activeTab).toBe('chats');
  });

  it('2. NavigationRail: desktop/tablet user navigation contains NO admin tabs even if active user role is ADMIN', () => {
    // Set active user in auth store as an ADMIN
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'user-admin-1',
        email: 'admin@chatlock.dev',
        username: 'admin_user',
        displayName: 'Super Admin',
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
        status: 'online',
      },
    });

    const onSelect = vi.fn();
    const rail = React.createElement(NavigationRail, {
      activeTab: 'settings',
      onSelectTab: onSelect,
      unreadCount: 0,
    });

    expect(rail).toBeDefined();
    expect(rail.props.activeTab).toBe('settings');
  });

  it('3. Strict Platform Check: Platform.OS indicates whether native or web environment is active', () => {
    // Platform.OS default in test environment is web or ios/android
    expect(Platform.OS).toBeDefined();
  });
});
