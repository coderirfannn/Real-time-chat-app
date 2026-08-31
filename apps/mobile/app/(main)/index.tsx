import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  type ListRenderItemInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useConversations } from '../../src/features/chat/hooks/useConversations';
import { ConversationItem } from '../../src/features/chat/components/ConversationItem';
import { ConnectionBanner } from '../../src/components/ConnectionBanner';
import { EmptyState } from '../../src/components/EmptyState';
import { LoadingSpinner } from '../../src/components/LoadingSpinner';
import { Avatar } from '../../src/components/Avatar';
import { useAuthStore } from '../../src/store/auth.store';
import { userApi } from '../../src/services/api/user.api';
import { conversationApi } from '../../src/services/api/conversation.api';
import type { ConversationItemData } from '../../src/types/chat.types';
import type { UserProfile } from '@chatlock/shared-types';

export default function ConversationListScreen(): React.JSX.Element {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);

  const { conversations, isLoading, isRefetching, refetch } = useConversations();

  // Local filter for active conversations
  const [filterQuery, setFilterQuery] = useState('');

  // New Chat Modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleOpenConversation = useCallback(
    (conversationId: string) => {
      router.push(`/(main)/chat/${conversationId}` as never);
    },
    [router],
  );

  const handleOpenSettings = useCallback(() => {
    router.push('/(main)/settings' as never);
  }, [router]);

  const handleOpenNewChatModal = useCallback(() => {
    setIsModalVisible(true);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
  }, []);

  const handleCloseNewChatModal = useCallback(() => {
    setIsModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  // Filter conversations locally
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

  // Search users effect with debouncing
  useEffect(() => {
    if (!isModalVisible) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const results = await userApi.searchUsers(searchQuery);
        setSearchResults(results);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to search users';
        setSearchError(msg);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, isModalVisible]);

  // Start or open direct conversation with selected user
  const handleSelectUser = useCallback(
    async (targetUser: UserProfile) => {
      setIsCreatingChat(true);
      try {
        const result = await conversationApi.createDirectConversation(targetUser.id);
        const convId =
          (result as { id?: string; _id?: string }).id || (result as { _id?: string })._id;
        handleCloseNewChatModal();
        if (convId) {
          router.push(`/(main)/chat/${convId}` as never);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create conversation';
        setSearchError(msg);
      } finally {
        setIsCreatingChat(false);
      }
    },
    [router, handleCloseNewChatModal],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ConversationItemData>) => (
      <ConversationItem item={item} onPress={handleOpenConversation} />
    ),
    [handleOpenConversation],
  );

  const renderSearchResultItem = useCallback(
    ({ item }: ListRenderItemInfo<UserProfile>) => (
      <TouchableOpacity
        style={styles.searchUserItem}
        onPress={() => handleSelectUser(item)}
        activeOpacity={0.7}
        disabled={isCreatingChat}
      >
        <Avatar
          name={item.displayName || item.username}
          avatarUrl={item.avatarUrl}
          size="md"
          isOnline={item.status === 'online'}
        />
        <View style={styles.searchUserInfo}>
          <Text style={styles.searchUserDisplayName}>{item.displayName || item.username}</Text>
          <Text style={styles.searchUserHandle}>@{item.username}</Text>
        </View>
        <Text style={styles.startChatAction}>Chat →</Text>
      </TouchableOpacity>
    ),
    [handleSelectUser, isCreatingChat],
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

      {/* Top Profile & Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.userProfileInfo}
          onPress={handleOpenSettings}
          activeOpacity={0.7}
        >
          <Avatar
            name={currentUser?.displayName || currentUser?.username || 'Me'}
            avatarUrl={currentUser?.avatarUrl}
            size="sm"
            isOnline={true}
          />
          <View style={styles.userTextWrapper}>
            <Text style={styles.userDisplayName} numberOfLines={1}>
              {currentUser?.displayName || 'Messages'}
            </Text>
            <Text style={styles.userHandle}>@{currentUser?.username || 'user'}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.newChatButton}
            onPress={handleOpenNewChatModal}
            activeOpacity={0.8}
          >
            <Text style={styles.newChatButtonText}>+ New</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleOpenSettings}
            activeOpacity={0.7}
          >
            <Text style={styles.settingsButtonText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Local Search / Filter Bar */}
      {conversations.length > 0 && (
        <View style={styles.filterBar}>
          <Text style={styles.filterIcon}>🔍</Text>
          <TextInput
            style={styles.filterInput}
            placeholder="Filter chats by name or message..."
            placeholderTextColor="#64748B"
            value={filterQuery}
            onChangeText={setFilterQuery}
            autoCapitalize="none"
          />
          {Boolean(filterQuery) && (
            <TouchableOpacity onPress={() => setFilterQuery('')} style={styles.clearFilterTouch}>
              <Text style={styles.clearFilterText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Main Conversation Feed */}
      <FlatList
        data={filteredConversations}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={
          filteredConversations.length === 0 ? styles.emptyContainer : undefined
        }
        ListEmptyComponent={
          <EmptyState
            title={filterQuery.trim() ? 'No Matching Chats' : 'No Conversations Yet'}
            description={
              filterQuery.trim()
                ? 'No active chats match your filter.'
                : "Tap '+ New' to find contacts and start your first secure real-time chat."
            }
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

      {/* New Chat & User Search Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseNewChatModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Conversation</Text>
              <TouchableOpacity onPress={handleCloseNewChatModal} style={styles.closeModalTouch}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchBar}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or @username"
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                autoCapitalize="none"
              />
              {isSearching && <ActivityIndicator size="small" color="#38BDF8" />}
            </View>

            {searchError && (
              <View style={styles.modalError}>
                <Text style={styles.modalErrorText}>{searchError}</Text>
              </View>
            )}

            {/* User Results List */}
            <FlatList
              data={searchResults}
              renderItem={renderSearchResultItem}
              keyExtractor={(item) => item.id}
              style={styles.searchResultsList}
              ListEmptyComponent={
                !isSearching ? (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>
                      {searchQuery.trim()
                        ? 'No users found matching your search.'
                        : 'Type to search for contacts.'}
                    </Text>
                  </View>
                ) : null
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  userProfileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  userTextWrapper: {
    flex: 1,
  },
  userDisplayName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  userHandle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newChatButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  newChatButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  settingsButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  settingsButtonText: {
    fontSize: 16,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterIcon: {
    marginRight: 8,
    fontSize: 14,
  },
  filterInput: {
    flex: 1,
    height: 38,
    color: '#FFFFFF',
    fontSize: 14,
  },
  clearFilterTouch: {
    padding: 6,
  },
  clearFilterText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '55%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeModalTouch: {
    padding: 4,
  },
  closeModalText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: '#FFFFFF',
    fontSize: 15,
  },
  modalError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  modalErrorText: {
    color: '#F87171',
    fontSize: 13,
  },
  searchResultsList: {
    flex: 1,
  },
  searchUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchUserInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchUserDisplayName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  searchUserHandle: {
    color: '#38BDF8',
    fontSize: 13,
    marginTop: 2,
  },
  startChatAction: {
    color: '#0284C7',
    fontWeight: '700',
    fontSize: 14,
  },
  noResultsContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#64748B',
    fontSize: 14,
  },
});
