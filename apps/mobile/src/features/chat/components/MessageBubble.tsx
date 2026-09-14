import React, { memo, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
  Linking,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { formatMessageTime } from '../../../utils/date-formatter';
import { resolveMediaUrl } from '../../../utils/media-url';
import { DeliveryReceipt } from './DeliveryReceipt';
import { ReactionPicker } from './ReactionPicker';
import { Icon } from '../../../components/ui/Icon';
import { MediaPreviewModal } from '../../../components/ui/MediaPreviewModal';
import type { LocalMessage } from '../../../types/chat.types';
import type { MessageAttachment } from '@chatlock/shared-types';

export interface MessageBubbleProps {
  message: LocalMessage;
  isOutbound: boolean;
  showTime?: boolean;
  isConsecutive?: boolean;
  parentMessage?: LocalMessage;
  currentUserId?: string;
  onRetry?: (clientMessageId: string) => void;
  onReply?: (message: LocalMessage) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onPressReplyPreview?: (targetMessageId: string) => void;
  onReport?: (message: LocalMessage) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isOutbound,
  showTime = true,
  isConsecutive = false,
  parentMessage,
  currentUserId,
  onRetry,
  onReply,
  onReaction,
  onPressReplyPreview,
  onReport,
}: MessageBubbleProps): React.JSX.Element {
  const [showPicker, setShowPicker] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<MessageAttachment | null>(null);

  const { width: windowWidth } = useWindowDimensions();
  const maxImageWidth = Math.min(Math.max(windowWidth * 0.65, 180), 280);
  const imageHeight = Math.round(maxImageWidth * 0.7);

  const timeText = formatMessageTime(message.createdAt);
  const isFailed = message.status === 'failed';
  const isEncrypted = message.isEncrypted || message.encryptionState === 'E2EE';
  const isDecryptionFailed = Boolean(message.content?.startsWith('🔒 Encrypted message'));
  const attachments = message.attachments || [];

  const handleOpenAttachment = useCallback((att: MessageAttachment) => {
    const isImg =
      att.mimeType?.startsWith('image/') ||
      Boolean(att.name && /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(att.name));

    if (isImg) {
      setPreviewAttachment(att);
    } else {
      const resolved = resolveMediaUrl(att.url);
      if (resolved) {
        Linking.openURL(resolved).catch(() => {});
      }
    }
  }, []);

  const handleCopyText = useCallback(() => {
    if (!message.content) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        const nav = navigator as unknown as {
          clipboard?: { writeText: (val: string) => Promise<void> };
        };
        nav.clipboard?.writeText(message.content);
      }
    } catch {
      // Ignore clipboard fallback
    }
    setCopiedToast(true);
    setShowPicker(false);
    setTimeout(() => {
      setCopiedToast(false);
    }, 2000);
  }, [message.content]);

  const handleSelectEmoji = useCallback(
    (emoji: string) => {
      setShowPicker(false);
      if (message.id) {
        onReaction?.(message.id, emoji);
      }
    },
    [message.id, onReaction],
  );

  const handleReplyPress = useCallback(() => {
    setShowPicker(false);
    onReply?.(message);
  }, [message, onReply]);

  // Aggregate reactions by emoji
  const reactionGroups = useMemo(() => {
    if (!message.reactions || message.reactions.length === 0) return [];

    const map = new Map<string, { emoji: string; count: number; userReacted: boolean }>();
    for (const r of message.reactions) {
      const existing = map.get(r.emoji);
      const isUser = Boolean(currentUserId && r.userId === currentUserId);
      if (existing) {
        existing.count += 1;
        if (isUser) existing.userReacted = true;
      } else {
        map.set(r.emoji, {
          emoji: r.emoji,
          count: 1,
          userReacted: isUser,
        });
      }
    }
    return Array.from(map.values());
  }, [message.reactions, currentUserId]);

  // Reply preview snippet
  const replySnippet = useMemo(() => {
    if (!parentMessage) return null;
    const authorName =
      parentMessage.sender?.displayName ||
      parentMessage.sender?.username ||
      (parentMessage.senderId === currentUserId ? 'You' : 'Peer');
    const snippet =
      parentMessage.content ||
      (parentMessage.attachments && parentMessage.attachments.length > 0
        ? `[Attachment: ${parentMessage.attachments[0]?.name || 'File'}]`
        : 'Message');

    return {
      id: parentMessage.id,
      authorName,
      snippet,
    };
  }, [parentMessage, currentUserId]);

  return (
    <View
      style={[
        styles.container,
        isOutbound ? styles.outboundContainer : styles.inboundContainer,
        isConsecutive ? styles.consecutivePadding : styles.normalPadding,
      ]}
      onPointerEnter={Platform.OS === 'web' ? () => setIsHovered(true) : undefined}
      onPointerLeave={Platform.OS === 'web' ? () => setIsHovered(false) : undefined}
    >
      {/* Interactive Reaction & Action Picker */}
      {showPicker && (
        <ReactionPicker
          onSelectEmoji={handleSelectEmoji}
          onReply={onReply ? handleReplyPress : undefined}
          onCopy={message.content ? handleCopyText : undefined}
          onReport={
            onReport
              ? () => {
                  setShowPicker(false);
                  onReport(message);
                }
              : undefined
          }
          onClose={() => setShowPicker(false)}
          isOutbound={isOutbound}
        />
      )}

      {/* Bubble Row with Quick Web Action Trigger */}
      <View
        style={[styles.bubbleRow, isOutbound ? styles.bubbleRowOutbound : styles.bubbleRowInbound]}
      >
        {/* Quick Action Trigger Button for Web / Touch */}
        {isOutbound && (isHovered || showPicker) && (
          <TouchableOpacity
            style={styles.quickActionTrigger}
            onPress={() => setShowPicker((prev) => !prev)}
            activeOpacity={0.7}
            accessibilityLabel="Message options"
          >
            <Icon name="more-vertical" size={16} color="#A0A5B5" />
          </TouchableOpacity>
        )}

        <Pressable
          onLongPress={() => setShowPicker((prev) => !prev)}
          delayLongPress={280}
          style={[
            styles.bubble,
            isOutbound ? styles.outboundBubble : styles.inboundBubble,
            isConsecutive
              ? isOutbound
                ? styles.consecutiveOutboundRadius
                : styles.consecutiveInboundRadius
              : null,
            isFailed ? styles.failedBubble : null,
          ]}
        >
          {/* Quoted Reply Box */}
          {replySnippet && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => replySnippet.id && onPressReplyPreview?.(replySnippet.id)}
              style={[
                styles.replyQuoteBox,
                isOutbound ? styles.replyQuoteOutbound : styles.replyQuoteInbound,
              ]}
            >
              <Text
                style={[
                  styles.replyAuthor,
                  isOutbound ? styles.replyAuthorOutbound : styles.replyAuthorInbound,
                ]}
                numberOfLines={1}
              >
                {replySnippet.authorName}
              </Text>
              <Text
                style={[
                  styles.replyTextSnippet,
                  isOutbound ? styles.replyTextOutbound : styles.replyTextInbound,
                ]}
                numberOfLines={1}
              >
                {replySnippet.snippet}
              </Text>
            </TouchableOpacity>
          )}

          {/* Attachments Section */}
          {attachments.length > 0 && (
            <View style={styles.attachmentsContainer}>
              {attachments.map((att, index) => {
                const isImage =
                  att.mimeType?.startsWith('image/') ||
                  Boolean(att.name && /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(att.name));
                const resolvedUrl = resolveMediaUrl(att.url);

                if (isImage) {
                  return (
                    <TouchableOpacity
                      key={att.id || `att_${index}`}
                      activeOpacity={0.85}
                      onPress={() => handleOpenAttachment(att)}
                      style={styles.imageWrapper}
                    >
                      <Image
                        source={{ uri: resolvedUrl }}
                        style={[
                          styles.attachmentImage,
                          { width: maxImageWidth, height: imageHeight },
                        ]}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  );
                }

                return (
                  <TouchableOpacity
                    key={att.id || `att_${index}`}
                    activeOpacity={0.7}
                    onPress={() => handleOpenAttachment(att)}
                    style={[
                      styles.fileCard,
                      isOutbound ? styles.fileCardOutbound : styles.fileCardInbound,
                    ]}
                  >
                    <Icon
                      name="file-text"
                      size={20}
                      color={isOutbound ? '#FFFFFF' : '#246BFD'}
                      style={styles.fileIcon}
                    />
                    <View style={styles.fileDetails}>
                      <Text
                        style={[
                          styles.fileName,
                          isOutbound ? styles.fileNameOutbound : styles.fileNameInbound,
                        ]}
                        numberOfLines={1}
                      >
                        {att.name}
                      </Text>
                      <Text style={styles.fileSize}>{formatFileSize(att.size || 0)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Text Content */}
          {Boolean(message.content) && (
            <Text
              style={[
                styles.text,
                isOutbound ? styles.outboundText : styles.inboundText,
                isDecryptionFailed ? styles.failedDecryptText : null,
              ]}
            >
              {message.content}
            </Text>
          )}

          {/* Timestamp & Status Metadata Row */}
          <View style={styles.metaRow}>
            {isEncrypted && (
              <View style={styles.lockBadge}>
                <Icon
                  name="lock"
                  size={10}
                  color={isOutbound ? 'rgba(255, 255, 255, 0.7)' : '#757B8C'}
                />
              </View>
            )}
            {showTime && (
              <Text
                style={[styles.timeText, isOutbound ? styles.outboundTime : styles.inboundTime]}
              >
                {timeText}
              </Text>
            )}
            {isOutbound && (
              <View style={styles.statusWrapper}>
                <DeliveryReceipt
                  status={message.status}
                  onRetry={() => onRetry?.(message.clientMessageId)}
                />
              </View>
            )}
          </View>
        </Pressable>

        {/* Quick Action Trigger Button for Inbound Messages */}
        {!isOutbound && (isHovered || showPicker) && (
          <TouchableOpacity
            style={styles.quickActionTrigger}
            onPress={() => setShowPicker((prev) => !prev)}
            activeOpacity={0.7}
            accessibilityLabel="Message options"
          >
            <Icon name="more-vertical" size={16} color="#A0A5B5" />
          </TouchableOpacity>
        )}
      </View>

      {/* Copied Toast Indicator */}
      {copiedToast && (
        <View
          style={[
            styles.copiedToast,
            isOutbound ? styles.copiedToastOutbound : styles.copiedToastInbound,
          ]}
        >
          <Icon name="check" size={12} color="#FFFFFF" />
          <Text style={styles.copiedToastText}>Copied</Text>
        </View>
      )}

      {/* Reaction Badges Pill Row */}
      {reactionGroups.length > 0 && (
        <View
          style={[
            styles.reactionsRow,
            isOutbound ? styles.reactionsRowOutbound : styles.reactionsRowInbound,
          ]}
        >
          {reactionGroups.map((rg) => (
            <TouchableOpacity
              key={rg.emoji}
              style={[
                styles.reactionPill,
                rg.userReacted ? styles.reactionPillActive : styles.reactionPillInactive,
              ]}
              onPress={() => message.id && onReaction?.(message.id, rg.emoji)}
              activeOpacity={0.7}
            >
              <Text style={styles.reactionEmoji}>{rg.emoji}</Text>
              {rg.count > 1 && (
                <Text
                  style={[
                    styles.reactionCount,
                    rg.userReacted ? styles.reactionCountActive : styles.reactionCountInactive,
                  ]}
                >
                  {rg.count}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* In-App Media Lightbox Modal */}
      <MediaPreviewModal
        visible={Boolean(previewAttachment)}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 12,
  },
  normalPadding: {
    marginVertical: 4,
  },
  consecutivePadding: {
    marginTop: 2,
    marginBottom: 2,
  },
  outboundContainer: {
    alignItems: 'flex-end',
  },
  inboundContainer: {
    alignItems: 'flex-start',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '85%',
    gap: 6,
  },
  bubbleRowOutbound: {
    justifyContent: 'flex-end',
  },
  bubbleRowInbound: {
    justifyContent: 'flex-start',
  },
  quickActionTrigger: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 64,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
      },
    }),
  },
  outboundBubble: {
    backgroundColor: '#246BFD',
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  consecutiveOutboundRadius: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  inboundBubble: {
    backgroundColor: '#1F222A',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#2A2D36',
  },
  consecutiveInboundRadius: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  failedBubble: {
    borderColor: '#F75555',
    borderWidth: 1,
  },
  replyQuoteBox: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  replyQuoteOutbound: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderLeftColor: '#FFFFFF',
  },
  replyQuoteInbound: {
    backgroundColor: '#262A34',
    borderLeftColor: '#246BFD',
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyAuthorOutbound: {
    color: '#FFFFFF',
  },
  replyAuthorInbound: {
    color: '#246BFD',
  },
  replyTextSnippet: {
    fontSize: 12,
  },
  replyTextOutbound: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  replyTextInbound: {
    color: '#A0A5B5',
  },
  attachmentsContainer: {
    gap: 6,
    marginBottom: 4,
  },
  imageWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#181A20',
  },
  attachmentImage: {
    borderRadius: 14,
    backgroundColor: '#262A34',
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    gap: 10,
    maxWidth: 240,
  },
  fileCardOutbound: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  fileCardInbound: {
    backgroundColor: '#262A34',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  fileIcon: {
    marginRight: 4,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600',
  },
  fileNameOutbound: {
    color: '#FFFFFF',
  },
  fileNameInbound: {
    color: '#FFFFFF',
  },
  fileSize: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 2,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  outboundText: {
    color: '#FFFFFF',
  },
  inboundText: {
    color: '#FFFFFF',
  },
  failedDecryptText: {
    fontStyle: 'italic',
    color: '#A0A5B5',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  lockBadge: {
    marginRight: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  outboundTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  inboundTime: {
    color: '#757B8C',
  },
  statusWrapper: {
    marginLeft: 3,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
  },
  reactionsRowOutbound: {
    justifyContent: 'flex-end',
    marginRight: 4,
  },
  reactionsRowInbound: {
    justifyContent: 'flex-start',
    marginLeft: 4,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    gap: 4,
    borderWidth: 1,
  },
  reactionPillInactive: {
    backgroundColor: '#1F222A',
    borderColor: '#2A2D36',
  },
  reactionPillActive: {
    backgroundColor: 'rgba(36, 107, 253, 0.2)',
    borderColor: '#246BFD',
  },
  reactionEmoji: {
    fontSize: 13,
  },
  reactionCount: {
    fontSize: 11,
    fontWeight: '700',
  },
  reactionCountInactive: {
    color: '#A0A5B5',
  },
  reactionCountActive: {
    color: '#246BFD',
  },
  copiedToast: {
    position: 'absolute',
    top: -24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#246BFD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 1000,
  },
  copiedToastOutbound: {
    right: 16,
  },
  copiedToastInbound: {
    left: 16,
  },
  copiedToastText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
