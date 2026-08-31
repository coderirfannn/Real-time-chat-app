import React, { useCallback, memo } from 'react';
import { FlatList, View, StyleSheet, type ListRenderItemInfo } from 'react-native';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from '../../../components/DateSeparator';
import { TypingIndicator } from './TypingIndicator';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import type { ChatFeedItem } from '../../../types/chat.types';

export interface MessageListProps {
  items: ChatFeedItem[];
  isTyping?: boolean;
  isLoadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onRetryMessage?: (clientMessageId: string) => void;
}

export const MessageList = memo(function MessageList({
  items,
  isTyping = false,
  isLoadingMore = false,
  refreshing = false,
  onRefresh,
  onLoadMore,
  onRetryMessage,
}: MessageListProps): React.JSX.Element {
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ChatFeedItem>) => {
      if (item.itemType === 'date_separator') {
        return <DateSeparator label={item.label} />;
      }

      return (
        <MessageBubble
          message={item.message}
          isOutbound={item.isOutbound}
          showTime={item.showTime}
          isConsecutive={item.isConsecutive}
          onRetry={onRetryMessage}
        />
      );
    },
    [onRetryMessage],
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

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      inverted
      contentContainerStyle={styles.content}
      ListHeaderComponent={renderBottomHeader}
      ListFooterComponent={renderTopFooter}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.3}
      refreshing={refreshing}
      onRefresh={onRefresh}
      showsVerticalScrollIndicator={false}
      initialNumToRender={20}
      maxToRenderPerBatch={15}
      windowSize={11}
      removeClippedSubviews={true}
    />
  );
});

const styles = StyleSheet.create({
  content: {
    paddingVertical: 12,
  },
  loadingMore: {
    paddingVertical: 12,
    alignItems: 'center',
  },
});
