import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Slot, useRouter, usePathname, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';
import { Icon, type IconName } from '../../src/components/ui/Icon';
import { brandColors } from '../../src/theme/colors';

interface AdminNavItem {
  name: string;
  href: string;
  icon: IconName;
  badge?: string;
}

export default function AdminLayout(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // STRICT RULE: Mobile Native Application must NEVER expose admin interface
  if (Platform.OS !== 'web') {
    return <Redirect href="/(main)" />;
  }

  const navItems: AdminNavItem[] = useMemo(
    () => [
      { name: 'Dashboard', href: '/admin/dashboard', icon: 'chat' },
      { name: 'User Management', href: '/admin/users', icon: 'user' },
      { name: 'Reports', href: '/admin/reports', icon: 'shield', badge: 'New' },
      { name: 'Group Chats', href: '/admin/groups', icon: 'chat' },
      { name: 'Media Moderation', href: '/admin/media', icon: 'image' },
      { name: 'Audit Logs', href: '/admin/audit-logs', icon: 'file-text' },
      { name: 'Settings', href: '/admin/settings', icon: 'settings' },
    ],
    [],
  );

  const handleNavigate = (href: string) => {
    setIsMobileMenuOpen(false);
    router.push(href as never);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login' as never);
  };

  const handleReturnToApp = () => {
    router.replace('/(main)' as never);
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={brandColors.primary} />
        <Text style={styles.loadingText}>Verifying administrative session...</Text>
      </View>
    );
  }

  // 2. Unauthenticated State
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // 3. Authenticated normal user: Forbidden (403 Access Denied)
  if (user?.role !== 'ADMIN') {
    return (
      <View style={styles.deniedContainer}>
        <View style={styles.deniedCard}>
          <View style={styles.deniedIconContainer}>
            <Icon name="lock" size={48} color="#FF4D4F" />
          </View>
          <Text style={styles.deniedTitle}>Access Denied (HTTP 403)</Text>
          <Text style={styles.deniedSubtitle}>
            Administrative privileges are required to access the ChatLock Control Center.
          </Text>
          <View style={styles.userInfoBox}>
            <Text style={styles.userInfoText}>
              Signed in as:{' '}
              <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
                {user?.username || 'Unknown'}
              </Text>
            </Text>
            <Text style={styles.userInfoText}>
              Current Role:{' '}
              <Text style={{ color: '#FF4D4F', fontWeight: 'bold' }}>{user?.role || 'USER'}</Text>
            </Text>
          </View>
          <Text style={styles.deniedNotice}>
            Normal users can only access the standard messaging application. If you believe this is
            an error, please contact a system administrator.
          </Text>
          <TouchableOpacity
            style={styles.returnButton}
            onPress={handleReturnToApp}
            accessibilityRole="button"
          >
            <Icon name="arrow-left" size={18} color="#FFF" />
            <Text style={styles.returnButtonText}>Return to ChatLock App</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 4. Authenticated ADMIN: Render Web Admin Shell
  return (
    <View style={styles.container}>
      {/* Top Header for Mobile Browsers */}
      <View style={styles.mobileHeader}>
        <TouchableOpacity
          onPress={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          style={styles.hamburgerButton}
          accessibilityLabel="Toggle Admin Menu"
        >
          <Icon name={isMobileMenuOpen ? 'close' : 'more-vertical'} size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.mobileBrand}>
          <View style={styles.logoBadge}>
            <Icon name="shield" size={16} color="#FFF" />
          </View>
          <Text style={styles.brandTitle}>ChatLock Admin</Text>
        </View>
        <View style={styles.statusPill}>
          <View style={styles.liveDot} />
          <Text style={styles.statusText}>LIVE</Text>
        </View>
      </View>

      {/* Mobile Drawer Dropdown */}
      {isMobileMenuOpen && (
        <View style={styles.mobileDrawer}>
          <ScrollView>
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <TouchableOpacity
                  key={item.href}
                  style={[styles.mobileNavItem, isActive && styles.mobileNavItemActive]}
                  onPress={() => handleNavigate(item.href)}
                >
                  <Icon name={item.icon} size={20} color={isActive ? '#246BFD' : '#9E9E9E'} />
                  <Text style={[styles.mobileNavText, isActive && styles.mobileNavTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={styles.drawerDivider} />
            <TouchableOpacity style={styles.mobileNavItem} onPress={handleReturnToApp}>
              <Icon name="arrow-left" size={20} color="#9E9E9E" />
              <Text style={styles.mobileNavText}>Return to App</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mobileNavItem} onPress={handleLogout}>
              <Icon name="logout" size={20} color="#FF4D4F" />
              <Text style={[styles.mobileNavText, { color: '#FF4D4F' }]}>Sign Out</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      <View style={styles.bodyWrapper}>
        {/* Desktop / Tablet Persistent Sidebar */}
        <View style={styles.sidebar}>
          {/* Logo & Brand */}
          <View style={styles.sidebarHeader}>
            <View style={styles.logoBadge}>
              <Icon name="shield" size={20} color="#FFF" />
            </View>
            <View>
              <Text style={styles.brandTitle}>ChatLock Admin</Text>
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>CONTROL CENTER</Text>
              </View>
            </View>
          </View>

          {/* Navigation Links */}
          <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionHeader}>MANAGEMENT</Text>
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <TouchableOpacity
                  key={item.href}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  onPress={() => handleNavigate(item.href)}
                  accessibilityRole="button"
                >
                  <View style={styles.navItemInner}>
                    <Icon name={item.icon} size={18} color={isActive ? '#246BFD' : '#8A8D9F'} />
                    <Text style={[styles.navItemText, isActive && styles.navItemTextActive]}>
                      {item.name}
                    </Text>
                  </View>
                  {item.badge && (
                    <View style={styles.pillBadge}>
                      <Text style={styles.pillBadgeText}>{item.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Sidebar Footer */}
          <View style={styles.sidebarFooter}>
            {/* Live System Indicator */}
            <View style={styles.healthBanner}>
              <View style={styles.liveDot} />
              <Text style={styles.healthText}>SYSTEM ONLINE</Text>
            </View>

            {/* Admin User Info */}
            <View style={styles.adminProfileCard}>
              <View style={styles.adminAvatar}>
                <Text style={styles.adminAvatarText}>
                  {user.displayName?.charAt(0).toUpperCase() || 'A'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminName} numberOfLines={1}>
                  {user.displayName || user.username}
                </Text>
                <Text style={styles.adminRole}>ADMINISTRATOR</Text>
              </View>
            </View>

            {/* Utility Actions */}
            <View style={styles.footerActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleReturnToApp}
                accessibilityRole="button"
              >
                <Icon name="arrow-left" size={16} color="#8A8D9F" />
                <Text style={styles.actionButtonText}>User App</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.logoutButton]}
                onPress={handleLogout}
                accessibilityRole="button"
              >
                <Icon name="logout" size={16} color="#FF4D4F" />
                <Text style={[styles.actionButtonText, { color: '#FF4D4F' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Content Area */}
        <View style={styles.mainContent}>
          <Slot />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121418',
    height: '100%',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#121418',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#9E9E9E',
    marginTop: 16,
    fontSize: 14,
  },
  deniedContainer: {
    flex: 1,
    backgroundColor: '#121418',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deniedCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 20,
    padding: 36,
    maxWidth: 480,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 79, 0.2)',
  },
  deniedIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 77, 79, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  deniedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  deniedSubtitle: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  userInfoBox: {
    width: '100%',
    backgroundColor: '#121418',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  userInfoText: {
    fontSize: 13,
    color: '#8A8D9F',
    marginVertical: 2,
  },
  deniedNotice: {
    fontSize: 12,
    color: '#6C7080',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#246BFD',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  returnButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  mobileHeader: {
    height: 60,
    backgroundColor: '#1A1D24',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    display:
      Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth < 1024
        ? 'flex'
        : 'none',
  },
  hamburgerButton: {
    padding: 8,
  },
  mobileBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mobileDrawer: {
    backgroundColor: '#1A1D24',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    maxHeight: 300,
    zIndex: 1000,
  },
  mobileNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 12,
  },
  mobileNavItemActive: {
    backgroundColor: 'rgba(36, 107, 253, 0.12)',
  },
  mobileNavText: {
    fontSize: 14,
    color: '#8A8D9F',
    fontWeight: '500',
  },
  mobileNavTextActive: {
    color: '#246BFD',
    fontWeight: '600',
  },
  drawerDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 8,
  },
  bodyWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 260,
    backgroundColor: '#16181E',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.07)',
    display:
      Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth < 1024
        ? 'none'
        : 'flex',
  },
  sidebarHeader: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#246BFD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  badgeContainer: {
    backgroundColor: 'rgba(36, 107, 253, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#246BFD',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#525666',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  navList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 2,
  },
  navItemActive: {
    backgroundColor: 'rgba(36, 107, 253, 0.14)',
  },
  navItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8A8D9F',
  },
  navItemTextActive: {
    color: '#246BFD',
    fontWeight: '600',
  },
  pillBadge: {
    backgroundColor: 'rgba(36, 107, 253, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#246BFD',
  },
  sidebarFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#14161B',
  },
  healthBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#12D18E',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 209, 142, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#12D18E',
  },
  healthText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#12D18E',
    letterSpacing: 0.5,
  },
  adminProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1A1D24',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  adminAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#246BFD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminAvatarText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  adminName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  adminRole: {
    fontSize: 10,
    fontWeight: '700',
    color: '#246BFD',
    letterSpacing: 0.4,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 77, 79, 0.08)',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8A8D9F',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#121418',
  },
});
