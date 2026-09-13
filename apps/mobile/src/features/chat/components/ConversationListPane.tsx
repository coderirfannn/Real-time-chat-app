import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Platform,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConversations } from '../hooks/useConversations';
import { ConversationItem } from './ConversationItem';
import { SearchInput, IconButton } from '../../../components/ui';
import { EmptyState } from '../../../components/EmptyState';
import { ConversationListSkeleton } from '../../../components/ConversationListSkeleton';
import { brandColors } from '../../../theme/colors';
import type { ConversationItemData } from '../../../types/chat.types';

export interface ConversationListPaneProps {
  selectedId?: string;
  onSelectConversation: (id: string) => void;
  onOpenNewChat: () => void;
  showHeaderAction?: boolean;
}

export function ConversationListPane({
  selectedId,
  onSelectConversation,
  onOpenNewChat,
  showHeaderAction = true,
}: ConversationListPaneProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { conversations, isLoading, isRefetching, refetch } = useConversations();
  const [filterQuery, setFilterQuery] = useState('');

  const filteredConversations = useMemo(() => {
    if (!filterQuery.trim()) return conversations;
    const clean = filterQuery.toLowerCase().trim();
    return conversations.filter(
      (c) =>
        c.recipient.displayName?.toLowerCase().includes(clean) ||
        c.recipient.username?.toLowerCase().includes(clean) ||
        c.lastMessage?.content?.toLowerCase().includes(clean),
    );
  }, [conversations, filterQuery]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ConversationItemData>) => (
      <ConversationItem
        item={item}
        onPress={onSelectConversation}
        isSelected={selectedId === item.id}
      />
    ),
    [onSelectConversation, selectedId],
  );

  const keyExtractor = useCallback((item: ConversationItemData) => item.id, []);

  // Safe area top padding — only apply on mobile native, not desktop
  const topInset = Platform.OS !== 'web' ? Math.max(insets.top, 8) : 0;

  return (
    <View style={styles.container}>
      {/* Header — with proper safe-area top padding */}
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <Text style={styles.headerTitle}>Chats</Text>
        {showHeaderAction && (
          <IconButton
            name="plus"
            size="sm"
            variant="secondary"
            accessibilityLabel="Start new conversation"
            onPress={onOpenNewChat}
          />
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <SearchInput
          placeholder="Search conversations..."
          value={filterQuery}
          onChangeText={setFilterQuery}
        />
      </View>

      {/* Thin separator before list */}
      <View style={styles.listDivider} />

      {/* Conversation List Feed */}
      {isLoading && !isRefetching && conversations.length === 0 ? (
        <ConversationListSkeleton count={7} />
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={
            filteredConversations.length === 0 ? styles.emptyContainer : styles.listContent
          }
          ListEmptyComponent={
            <EmptyState
              title={filterQuery.trim() ? 'No Matching Chats' : 'No Chats Yet'}
              description={
                filterQuery.trim()
                  ? `No conversations match "${filterQuery}".`
                  : 'Start a conversation to see your messages here.'
              }
              actionLabel={filterQuery.trim() ? 'Clear Search' : '+ Start New Chat'}
              onAction={filterQuery.trim() ? () => setFilterQuery('') : onOpenNewChat}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={brandColors.primary}
              colors={[brandColors.primary]}
            />
          }
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181A20',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  // Thin hairline separator before the list — after search bar
  listDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#2A2D36',
    marginHorizontal: 0,
    ...Platform.select({
      web: { height: 1 },
    }),
  },
  listContent: {
    paddingVertical: 4,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
