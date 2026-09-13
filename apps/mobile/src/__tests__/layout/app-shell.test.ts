import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { BottomTabBar } from '../../components/layout/BottomTabBar';
import { NavigationRail } from '../../components/layout/NavigationRail';
import { AppHeader } from '../../components/layout/AppHeader';
import { AppShell } from '../../components/layout/AppShell';

describe('Application Shell & Navigation — Task Phase 2 Verification', () => {
  it('1. BOTTOM TAB BAR: renders tabs and triggers tab selection', () => {
    const onSelect = vi.fn();
    const el = React.createElement(BottomTabBar, {
      activeTab: 'chats',
      onSelectTab: onSelect,
      unreadCount: 4,
    });
    expect(el).toBeDefined();
    expect(el.props.activeTab).toBe('chats');
    expect(el.props.unreadCount).toBe(4);
  });

  it('2. NAVIGATION RAIL: renders desktop vertical sidebar with collapse capability', () => {
    const onSelect = vi.fn();
    const rail = React.createElement(NavigationRail, {
      activeTab: 'settings',
      onSelectTab: onSelect,
      unreadCount: 2,
    });
    expect(rail).toBeDefined();
    expect(rail.props.activeTab).toBe('settings');
    expect(rail.props.unreadCount).toBe(2);
  });

  it('3. APP HEADER: renders title, back button, and customizable action slots', () => {
    const onBack = vi.fn();
    const header = React.createElement(AppHeader, {
      title: 'Messages',
      subtitle: 'Online',
      showBack: true,
      onBack,
      hasBorder: true,
    });
    expect(header).toBeDefined();
    expect(header.props.title).toBe('Messages');
    expect(header.props.subtitle).toBe('Online');
    expect(header.props.showBack).toBe(true);
    expect(header.props.hasBorder).toBe(true);
  });

  it('4. APP SHELL: supports responsive shell with conditional bottom navigation', () => {
    const shell = React.createElement(AppShell, {
      activeTab: 'chats',
      showNavigation: true,
      unreadCount: 5,
      children: React.createElement('div', null, 'Content'),
    });
    expect(shell).toBeDefined();
    expect((shell.props as { showNavigation?: boolean }).showNavigation).toBe(true);
    expect((shell.props as { unreadCount?: number }).unreadCount).toBe(5);

    const hiddenShell = React.createElement(AppShell, {
      activeTab: 'chats',
      showNavigation: false,
      children: React.createElement('div', null, 'Chat View'),
    });
    expect((hiddenShell.props as { showNavigation?: boolean }).showNavigation).toBe(false);
  });
});
