import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
  type ListRenderItemInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useConversations } from '../../src/features/chat/hooks/useConversations';
import { ConversationItem } from '../../src/features/chat/components/ConversationItem';
import { ConnectionBanner } from '../../src/components/ConnectionBanner';
import { EmptyState } from '../../src/components/EmptyState';
import { LoadingSpinner } from '../../src/components/LoadingSpinner';
import type { ConversationItemData } from '../../src/types/chat.types';

export default function ConversationListScreen(): React.JSX.Element {
  const router = useRouter();
  const { conversations, isLoading, isRefetching, refetch } = useConversations();

  const handleOpenConversation = useCallback(
    (conversationId: string) => {
      router.push(`/(main)/chat/${conversationId}` as never);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ConversationItemData>) => (
      <ConversationItem item={item} onPress={handleOpenConversation} />
    ),
    [handleOpenConversation],
  );

  const keyExtractor = useCallback((item: ConversationItemData) => item.id, []);

  if (isLoading && !isRefetching && conversations.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ConnectionBanner />
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ConnectionBanner />

      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <EmptyState
            title="No Conversations Yet"
            description="Start a new chat to begin real-time encrypted messaging with your contacts."
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#0284C7"
            colors={['#0284C7']}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  emptyContainer: {
    flex: 1,
  },
});
