import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
  Keyboard,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useChat } from '../../../src/features/chat/hooks/useChat';
import { MessageList } from '../../../src/features/chat/components/MessageList';
import { MessageComposer } from '../../../src/features/chat/components/MessageComposer';
import { ConversationListPane } from '../../../src/features/chat/components/ConversationListPane';
import { Avatar } from '../../../src/components/Avatar';
import { ConnectionBanner } from '../../../src/components/ConnectionBanner';
import { MessageFeedSkeleton } from '../../../src/components/MessageFeedSkeleton';
import { Icon } from '../../../src/components/ui';
import { formatLastSeenTime } from '../../../src/utils/date-formatter';
import { brandColors } from '../../../src/theme/colors';
import type { ChatFeedItem } from '../../../src/types/chat.types';
import type { MessageAttachment } from '@chatlock/shared-types';

export default function ChatScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < 768;
  const isNarrow = windowWidth < 380;

  const conversationId = id || '';
  const {
    feedItems,
    recipient,
    isLoading,
    isFetchingNextPage,
    isRefreshing,
    isPeerTyping,
    sendMessage,
    retryMessage,
    startTyping,
    stopTyping,
    loadMoreMessages,
    refresh,
    replyingTo,
    setReplyingTo,
    toggleReaction,
    parentMessagesMap,
    currentUserId,
  } = useChat(conversationId);

  const listRef = useRef<FlatList<ChatFeedItem>>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleScrollToBottom = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setIsScrolledUp(false);
  }, []);

  const fabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fabAnim, {
      toValue: isScrolledUp ? 1 : 0,
      friction: 6,
      tension: 70,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isScrolledUp, fabAnim]);

  const [viewportHeight, setViewportHeight] = useState<number | undefined>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.visualViewport?.height || window.innerHeight;
    }
    return undefined;
  });

  // Dynamic mobile viewport tracking (Soft Keyboard on Mobile Web / Browsers)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleResize = () => {
      const vv = window.visualViewport;
      const height = vv ? vv.height : window.innerHeight;
      setViewportHeight(Math.round(height));

      // Reset any browser auto-scroll so header stays pinned at top
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    };

    handleResize();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  // Native keyboard listener (iOS / Android)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const onKeyboardShow = () => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
    };

    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      onKeyboardShow,
    );

    return () => {
      showSub.remove();
    };
  }, []);

  const handleComposerFocus = useCallback(() => {
    requestAnimationFrame(() => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.scrollTo(0, 0);
      }
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  }, []);

  const handleSendMessage = useCallback(
    async (content: string, attachments?: MessageAttachment[], replyToId?: string) => {
      await sendMessage(content, attachments, replyToId);
      // Dynamically auto-scroll feed to latest message
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
        setIsScrolledUp(false);
      });
    },
    [sendMessage],
  );

  const displayName = recipient.displayName || recipient.username || 'Direct Message';
  const isOnline = recipient.status === 'online';

  const subtitleText = isPeerTyping
    ? 'typing...'
    : isOnline
      ? 'Online'
      : formatLastSeenTime(recipient.lastSeenAt);

  const renderChatContent = () => (
    <View style={[styles.container, isMobile ? styles.mobileContainer : styles.desktopChatMain]}>
      <ConnectionBanner />

      {/* Custom Header with Safe Area Inset Handling */}
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 10) },
          isNarrow ? styles.headerNarrow : null,
        ]}
      >
        {/* Back button — clean touch target, no border ring */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
          accessibilityLabel="Back to chats"
        >
          <Icon name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Recipient Profile & Presence */}
        <TouchableOpacity
          style={styles.headerProfileTouch}
          onPress={() => setShowOptionsMenu(true)}
          activeOpacity={0.8}
          accessibilityLabel="View chat details"
        >
          <View style={styles.avatarWrapper}>
            <Avatar
              name={displayName}
              avatarUrl={recipient.avatarUrl}
              size="sm"
              isOnline={isOnline}
            />
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {displayName}
            </Text>
            <View style={styles.subtitleRow}>
              {isOnline && !isPeerTyping && <View style={styles.onlineDot} />}
              <Text
                style={[
                  styles.headerSubtitle,
                  isPeerTyping
                    ? styles.headerSubtitleTyping
                    : isOnline
                      ? styles.headerSubtitleOnline
                      : undefined,
                ]}
                numberOfLines={1}
              >
                {subtitleText}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* More options button — clean touch target */}
        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => setShowOptionsMenu(true)}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 10 }}
          accessibilityLabel="Conversation details and options"
        >
          <Icon name="more-vertical" size={20} color="#A0A5B5" />
        </TouchableOpacity>
      </View>

      {/* Main Virtualized Message Feed */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={
          Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined
        }
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 48 : 0}
      >
        {isLoading && feedItems.length === 0 ? (
          <MessageFeedSkeleton />
        ) : (
          <View style={styles.feedWrapper}>
            <MessageList
              ref={listRef}
              items={feedItems}
              isTyping={isPeerTyping}
              isLoadingMore={isFetchingNextPage}
              refreshing={isRefreshing}
              currentUserId={currentUserId}
              parentMessagesMap={parentMessagesMap}
              recipientName={displayName}
              onRefresh={refresh}
              onLoadMore={loadMoreMessages}
              onRetryMessage={retryMessage}
              onReplyMessage={setReplyingTo}
              onReaction={toggleReaction}
              onScrollStateChange={setIsScrolledUp}
              onQuickIcebreaker={(text) => sendMessage(text)}
            />

            {/* Floating Action Button (Scroll to Bottom) with Spring Motion */}
            <Animated.View
              style={[
                styles.fabScrollBottom,
                isNarrow ? styles.fabScrollBottomNarrow : null,
                {
                  pointerEvents: isScrolledUp ? 'auto' : 'none',
                  opacity: fabAnim,
                  transform: [
                    {
                      scale: fabAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.5, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.fabInnerTouch}
                onPress={handleScrollToBottom}
                activeOpacity={0.8}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Scroll to bottom"
              >
                <Icon
                  name="chevron-right"
                  size={16}
                  color="#FFFFFF"
                  style={{ transform: [{ rotate: '90deg' }] }}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {/* Dynamic Responsive Message Composer */}
        <MessageComposer
          conversationId={conversationId}
          onSendMessage={handleSendMessage}
          onTypingStart={startTyping}
          onTypingStop={stopTyping}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          onFocus={handleComposerFocus}
        />
      </KeyboardAvoidingView>

      {/* Conversation Options Modal */}
      <Modal
        visible={showOptionsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View
            style={[styles.modalCard, isMobile ? styles.modalCardMobile : null]}
            // @ts-expect-error prevent backdrop click propagation
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Avatar
                name={displayName}
                avatarUrl={recipient.avatarUrl}
                size="md"
                isOnline={isOnline}
              />
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>{displayName}</Text>
                <Text style={styles.modalSubtitle}>
                  {recipient.username ? `@${recipient.username}` : 'ChatLock User'}
                </Text>
              </View>
            </View>

            <View style={styles.encryptionCard}>
              <Icon name="shield" size={20} color={brandColors.primary} />
              <View style={styles.encryptionDetails}>
                <Text style={styles.encryptionTitle}>End-to-End Encrypted</Text>
                <Text style={styles.encryptionSub}>
                  Messages and calls are secured with end-to-end encryption. No third party can read
                  them.
                </Text>
              </View>
            </View>

            <View style={styles.modalDivider} />

            <TouchableOpacity
              style={styles.modalActionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                refresh();
              }}
              activeOpacity={0.7}
            >
              <Icon name="check-check" size={18} color="#A0A5B5" />
              <Text style={styles.modalActionLabel}>Sync & Refresh Messages</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalActionItem, styles.modalCloseBtn]}
              onPress={() => setShowOptionsMenu(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );

  if (!isMobile) {
    return (
      <View
        style={[
          styles.webOuter,
          Platform.OS === 'web' && viewportHeight
            ? { height: viewportHeight, maxHeight: viewportHeight, bottom: 'auto' }
            : null,
        ]}
      >
        <View style={styles.desktopSplitLayout}>
          <View style={styles.desktopSidebar}>
            <ConversationListPane
              selectedId={conversationId}
              onSelectConversation={(nextId) => {
                if (nextId !== conversationId) {
                  router.replace(`/(main)/chat/${nextId}` as never);
                }
              }}
              onOpenNewChat={() => {
                router.push('/(main)' as never);
              }}
            />
          </View>
          <View style={styles.desktopChatContainer}>{renderChatContent()}</View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.webOuter,
        styles.mobileOuter,
        Platform.OS === 'web' && viewportHeight
          ? { height: viewportHeight, maxHeight: viewportHeight, bottom: 'auto' }
          : null,
      ]}
    >
      {renderChatContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  webOuter: {
    flex: 1,
    backgroundColor: '#181A20',
    width: '100%',
    ...Platform.select({
      web: {
        height: '100dvh',
        maxHeight: '100dvh',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      },
      default: {
        height: '100%',
      },
    }),
  },
  mobileOuter: {
    backgroundColor: '#181A20',
  },
  desktopSplitLayout: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    backgroundColor: '#181A20',
  },
  desktopSidebar: {
    width: 380,
    borderRightWidth: 1,
    borderRightColor: '#2A2D36',
    height: '100%',
  },
  desktopChatContainer: {
    flex: 1,
    height: '100%',
  },
  desktopChatMain: {
    flex: 1,
    height: '100%',
    maxWidth: '100%',
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  container: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#181A20',
    overflow: 'hidden',
  },
  desktopContainer: {
    maxWidth: 960,
    alignSelf: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#2A2D36',
    ...Platform.select({
      web: {
        boxShadow: '0 0 40px rgba(0, 0, 0, 0.5)',
      },
    }),
  },
  mobileContainer: {
    maxWidth: '100%',
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#181A20',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2D36',
    gap: 10,
  },
  headerNarrow: {
    paddingHorizontal: 10,
    gap: 6,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    // No border ring — clean Figma-style back button
    borderRadius: 22,
  },
  backText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 20,
  },
  headerProfileTouch: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 4,
  },
  avatarWrapper: {
    position: 'relative',
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#12D18E',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#A0A5B5',
  },
  headerSubtitleTyping: {
    color: '#246BFD',
    fontWeight: '700',
  },
  headerSubtitleOnline: {
    color: '#12D18E',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  headerActionBtn: {
    width: 44,
    height: 44,
    // No border ring — clean Figma-style action button
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  headerActionIcon: {
    fontSize: 16,
  },
  headerActionIconDots: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  callToast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#246BFD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    gap: 8,
  },
  callToastIcon: {
    fontSize: 14,
  },
  callToastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  chatArea: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#181A20',
    overflow: 'hidden',
  },
  feedWrapper: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  fabScrollBottom: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#246BFD',
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(36, 107, 253, 0.4)',
      },
      default: {
        shadowColor: '#246BFD',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
        elevation: 7,
      },
    }),
  },
  fabScrollBottomNarrow: {
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  fabInnerTouch: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1F222A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2A2D36',
    padding: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
      },
    }),
  },
  modalCardMobile: {
    width: '94%',
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#A0A5B5',
    marginTop: 2,
  },
  encryptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(36, 107, 253, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(36, 107, 253, 0.25)',
    borderRadius: 16,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  encryptionIcon: {
    fontSize: 20,
  },
  encryptionDetails: {
    flex: 1,
  },
  encryptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#246BFD',
  },
  encryptionSub: {
    fontSize: 12,
    color: '#A0A5B5',
    marginTop: 2,
    lineHeight: 16,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#2A2D36',
    marginVertical: 10,
  },
  modalActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  modalActionIcon: {
    fontSize: 18,
  },
  modalActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalCloseBtn: {
    justifyContent: 'center',
    backgroundColor: '#262A34',
    borderRadius: 20,
    marginTop: 12,
    paddingVertical: 12,
  },
  modalCloseText: {
    color: '#246BFD',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
});
