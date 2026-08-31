import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useChat } from '../../../src/features/chat/hooks/useChat';
import { MessageList } from '../../../src/features/chat/components/MessageList';
import { MessageComposer } from '../../../src/features/chat/components/MessageComposer';
import { Avatar } from '../../../src/components/Avatar';
import { ConnectionBanner } from '../../../src/components/ConnectionBanner';
import { LoadingSpinner } from '../../../src/components/LoadingSpinner';

export default function ChatScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const conversationId = id || '';
  const {
    feedItems,
    recipient,
    isLoading,
    isSending,
    isFetchingNextPage,
    isRefreshing,
    sendMessage,
    retryMessage,
    loadMoreMessages,
    refresh,
  } = useChat(conversationId);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const displayName = recipient.displayName || recipient.username || 'Direct Message';
  const isOnline = recipient.status === 'online';

  return (
    <SafeAreaView style={styles.container}>
      <ConnectionBanner />

      {/* Custom Chat Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <Avatar name={displayName} avatarUrl={recipient.avatarUrl} size="sm" isOnline={isOnline} />

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.headerSubtitle}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
      </View>

      {/* Main Chat Body & Virtualized Feed */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {isLoading && feedItems.length === 0 ? (
          <LoadingSpinner />
        ) : (
          <MessageList
            items={feedItems}
            isLoadingMore={isFetchingNextPage}
            refreshing={isRefreshing}
            onRefresh={refresh}
            onLoadMore={loadMoreMessages}
            onRetryMessage={retryMessage}
          />
        )}

        <MessageComposer onSendMessage={sendMessage} disabled={isSending} />
      </KeyboardAvoidingView>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 10,
  },
  backButton: {
    padding: 6,
    marginRight: 2,
  },
  backText: {
    fontSize: 22,
    color: '#F8FAFC',
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
});
