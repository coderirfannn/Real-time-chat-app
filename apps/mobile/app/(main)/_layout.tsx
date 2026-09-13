import React, { useMemo, useCallback } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { AppShell, type MainTabKey } from '../../src/components/layout';
import { useConversations } from '../../src/features/chat/hooks/useConversations';

export default function MainLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const { conversations } = useConversations();

  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }, [conversations]);

  const activeTab: MainTabKey = useMemo(() => {
    if (pathname && pathname.includes('/settings')) return 'settings';
    return 'chats';
  }, [pathname]);

  const isChatRoom = Boolean(pathname && pathname.includes('/chat/'));
  const showNavigation = !isChatRoom;

  const handleSelectTab = useCallback(
    (tab: MainTabKey) => {
      if (tab === 'chats') {
        router.push('/(main)' as never);
      } else if (tab === 'settings') {
        router.push('/(main)/settings' as never);
      }
    },
    [router],
  );

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={handleSelectTab}
      showNavigation={showNavigation}
      unreadCount={totalUnreadCount}
    >
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: '#1F222A' },
          headerTintColor: '#FFFFFF',
          contentStyle: { backgroundColor: '#181A20' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
      </Stack>
    </AppShell>
  );
}

