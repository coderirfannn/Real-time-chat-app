import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  type ListRenderItemInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { CONVERSATIONS_QUERY_KEY } from '../../src/features/chat/hooks/useConversations';
import { ConversationListPane } from '../../src/features/chat/components/ConversationListPane';
import { ConnectionBanner } from '../../src/components/ConnectionBanner';
import { EmptyState } from '../../src/components/EmptyState';
import { Avatar } from '../../src/components/Avatar';
import { SearchInput, IconButton, Icon } from '../../src/components/ui';
import { userApi } from '../../src/services/api/user.api';
import { conversationApi } from '../../src/services/api/conversation.api';
import { brandColors, semanticColors } from '../../src/theme/colors';
import type { UserProfile } from '@chatlock/shared-types';

export default function ConversationListScreen(): React.JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  // New Chat Modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleOpenConversation = useCallback(
    (conversationId: string) => {
      // Optimistically zero out unread count immediately upon opening
      queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, (oldData: unknown) => {
        if (!oldData) return oldData;
        const list = Array.isArray(oldData)
          ? oldData
          : (oldData as { docs?: Record<string, unknown>[] }).docs || [];
        const updated = list.map((item) => {
          const itemId = item['id'] || item['_id'];
          if (itemId === conversationId) {
            return { ...item, unreadCount: 0 };
          }
          return item;
        });
        return Array.isArray(oldData) ? updated : { ...(oldData as object), docs: updated };
      });
      router.push(`/(main)/chat/${conversationId}` as never);
    },
    [router, queryClient],
  );

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
        const resObj = result as {
          id?: string;
          _id?: string;
          conversation?: { id?: string; _id?: string };
        };
        const convId =
          resObj.conversation?.id || resObj.conversation?._id || resObj.id || resObj._id;
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
        <Icon name="chevron-right" size={16} color="#757B8C" />
      </TouchableOpacity>
    ),
    [handleSelectUser, isCreatingChat],
  );

  const renderNewChatModal = () => (
    <Modal
      visible={isModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCloseNewChatModal}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Drag pill handle — Figma bottom-sheet pattern */}
          <View style={styles.modalDragHandle} />

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Conversation</Text>
            <IconButton
              name="close"
              size="sm"
              variant="secondary"
              accessibilityLabel="Close new conversation modal"
              onPress={handleCloseNewChatModal}
            />
          </View>

          {/* Search Input */}
          <View style={styles.modalSearchWrapper}>
            <SearchInput
              placeholder="Search by name or @username..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {isSearching && (
              <View style={styles.searchingSpinner}>
                <ActivityIndicator size="small" color={brandColors.primary} />
              </View>
            )}
          </View>

          {searchError && (
            <View style={styles.modalError}>
              <Icon
                name="alert-circle"
                size={16}
                color={semanticColors.error}
                style={styles.modalErrorIcon}
              />
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
                      ? 'No users found matching your query.'
                      : 'Type to search for contacts.'}
                  </Text>
                </View>
              ) : null
            }
          />
        </View>
      </View>
    </Modal>
  );

  if (isDesktop) {
    return (
      <View style={styles.desktopLayout}>
        <View style={styles.desktopListPane}>
          <ConversationListPane
            selectedId={undefined}
            onSelectConversation={handleOpenConversation}
            onOpenNewChat={handleOpenNewChatModal}
          />
        </View>

        <View style={styles.desktopChatPane}>
          <EmptyState
            title="Select a Conversation"
            description="Choose a chat from the left panel or start a new conversation."
            actionLabel="+ Start New Chat"
            onAction={handleOpenNewChatModal}
          />
        </View>

        {renderNewChatModal()}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ConnectionBanner />
      <ConversationListPane
        onSelectConversation={handleOpenConversation}
        onOpenNewChat={handleOpenNewChatModal}
      />
      {renderNewChatModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181A20',
  },
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#181A20',
    height: '100%',
  },
  desktopListPane: {
    width: 380,
    borderRightWidth: 1,
    borderRightColor: '#2A2D36',
    height: '100%',
  },
  desktopChatPane: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#181A20',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
    ...Platform.select({
      web: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      },
    }),
  },
  modalCard: {
    backgroundColor: '#1F222A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    minHeight: '60%',
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#2A2D36',
    ...Platform.select({
      web: {
        width: '100%',
        maxWidth: 520,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#2A2D36',
        minHeight: 440,
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.7)',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  // Drag pill handle at top of bottom-sheet modal (Figma pattern)
  modalDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#35383F',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSearchWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  searchingSpinner: {
    position: 'absolute',
    right: 44,
    top: 14,
  },
  modalError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(247, 85, 85, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(247, 85, 85, 0.35)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  modalErrorIcon: {
    marginRight: 8,
  },
  modalErrorText: {
    color: semanticColors.error,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  searchResultsList: {
    flex: 1,
  },
  searchUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D36',
  },
  searchUserInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchUserDisplayName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  searchUserHandle: {
    fontSize: 12,
    color: '#757B8C',
    marginTop: 2,
  },
  noResultsContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    color: '#757B8C',
    fontSize: 14,
    textAlign: 'center',
  },
});
