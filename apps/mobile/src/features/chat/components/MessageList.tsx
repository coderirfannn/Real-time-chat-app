import React, { useCallback, forwardRef, memo } from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  type ListRenderItemInfo,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from '../../../components/DateSeparator';
import { TypingIndicator } from './TypingIndicator';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { Icon } from '../../../components/ui/Icon';
import type { ChatFeedItem, LocalMessage } from '../../../types/chat.types';

export interface MessageListProps {
  items: ChatFeedItem[];
  isTyping?: boolean;
  isLoadingMore?: boolean;
  refreshing?: boolean;
  currentUserId?: string;
  parentMessagesMap?: Record<string, LocalMessage>;
  recipientName?: string;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onRetryMessage?: (clientMessageId: string) => void;
  onReplyMessage?: (message: LocalMessage) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onPressReplyPreview?: (targetMessageId: string) => void;
  onScrollStateChange?: (isScrolledUp: boolean) => void;
  onQuickIcebreaker?: (text: string) => void;
}

export const MessageList = memo(
  forwardRef<FlatList<ChatFeedItem>, MessageListProps>(function MessageList(
    {
      items,
      isTyping = false,
      isLoadingMore = false,
      refreshing = false,
      currentUserId,
      parentMessagesMap,
      recipientName = 'User',
      onRefresh,
      onLoadMore,
      onRetryMessage,
      onReplyMessage,
      onReaction,
      onPressReplyPreview,
      onScrollStateChange,
      onQuickIcebreaker,
    },
    ref,
  ): React.JSX.Element {
    const handleScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        // In inverted FlatList, offset > 120 means scrolled into previous history
        onScrollStateChange?.(offsetY > 120);
      },
      [onScrollStateChange],
    );

    const renderItem = useCallback(
      ({ item }: ListRenderItemInfo<ChatFeedItem>) => {
        if (item.itemType === 'date_separator') {
          return <DateSeparator label={item.label} />;
        }

        const parentMsg = item.message.replyToMessageId
          ? parentMessagesMap?.[item.message.replyToMessageId]
          : undefined;

        return (
          <MessageBubble
            message={item.message}
            isOutbound={item.isOutbound}
            showTime={item.showTime}
            isConsecutive={item.isConsecutive}
            parentMessage={parentMsg}
            currentUserId={currentUserId}
            onRetry={onRetryMessage}
            onReply={onReplyMessage}
            onReaction={onReaction}
            onPressReplyPreview={onPressReplyPreview}
          />
        );
      },
      [
        parentMessagesMap,
        currentUserId,
        onRetryMessage,
        onReplyMessage,
        onReaction,
        onPressReplyPreview,
      ],
    );

    const keyExtractor = useCallback((item: ChatFeedItem) => item.id, []);

    // Header in inverted FlatList is rendered at the BOTTOM of the screen (latest)
    const renderBottomHeader = useCallback(() => {
      if (!isTyping) return null;
      return <TypingIndicator />;
    }, [isTyping]);

    // Footer in inverted FlatList is rendered at the TOP of the screen (oldest)
    const renderTopFooter = useCallback(() => {
      if (!isLoadingMore) return null;
      return (
        <View style={styles.loadingMore}>
          <LoadingSpinner size="small" />
        </View>
      );
    }, [isLoadingMore]);

    if (items.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.lockBadge}>
            <Icon name="shield" size={14} color="#246BFD" />
            <Text style={styles.lockTitle}>End-to-End Encrypted</Text>
          </View>
          <Text style={styles.emptySubtitle}>
            Messages and calls with {recipientName} are secured with end-to-end encryption. No one
            outside of this chat can read them.
          </Text>

          <View style={styles.icebreakerRow}>
            {['👋 Say Hello', 'Hey there! 😊', 'What’s up?'].map((chip) => (
              <TouchableOpacity
                key={chip}
                style={styles.icebreakerChip}
                onPress={() => onQuickIcebreaker?.(chip)}
                activeOpacity={0.7}
                accessibilityLabel={`Send icebreaker: ${chip}`}
              >
                <Text style={styles.icebreakerText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    return (
      <FlatList
        ref={ref}
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        inverted
        contentContainerStyle={styles.content}
        ListHeaderComponent={renderBottomHeader}
        ListFooterComponent={renderTopFooter}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        onScroll={handleScroll}
        scrollEventThrottle={60}
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={20}
        maxToRenderPerBatch={15}
        windowSize={11}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS !== 'web'}
      />
    );
  }),
);

const styles = StyleSheet.create({
  content: {
    paddingVertical: 12,
  },
  loadingMore: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(36, 107, 253, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(36, 107, 253, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  lockTitle: {
    color: '#246BFD',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  emptySubtitle: {
    color: '#A0A5B5',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
    marginBottom: 20,
  },
  icebreakerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  icebreakerChip: {
    backgroundColor: '#1F222A',
    borderWidth: 1,
    borderColor: '#2A2D36',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 24,
  },
  icebreakerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
