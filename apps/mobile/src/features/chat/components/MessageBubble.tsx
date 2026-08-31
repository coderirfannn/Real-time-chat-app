import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image, Linking } from 'react-native';
import { formatMessageTime } from '../../../utils/date-formatter';
import type { LocalMessage, DeliveryStatus } from '../../../types/chat.types';
import type { MessageAttachment } from '@chatlock/shared-types';

export interface MessageBubbleProps {
  message: LocalMessage;
  isOutbound: boolean;
  showTime?: boolean;
  isConsecutive?: boolean;
  onRetry?: (clientMessageId: string) => void;
}

function renderStatusIndicator(
  status: DeliveryStatus,
  onRetry?: () => void,
): React.JSX.Element | null {
  switch (status) {
    case 'pending':
      return <Text style={styles.statusPending}>⏳</Text>;
    case 'sending':
      return <Text style={styles.statusSending}>🕒</Text>;
    case 'sent':
      return <Text style={styles.statusSent}>✓</Text>;
    case 'delivered':
      return <Text style={styles.statusDelivered}>✓✓</Text>;
    case 'read':
      return <Text style={styles.statusRead}>✓✓</Text>;
    case 'failed':
      return (
        <TouchableOpacity onPress={onRetry} activeOpacity={0.7} style={styles.retryTouch}>
          <Text style={styles.statusFailed}>⚠️ Retry</Text>
        </TouchableOpacity>
      );
    default:
      return null;
  }
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📕';
  if (mimeType.includes('zip')) return '📦';
  return '📄';
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
  onRetry,
}: MessageBubbleProps): React.JSX.Element {
  const timeText = formatMessageTime(message.createdAt);
  const isFailed = message.status === 'failed';
  const attachments = message.attachments || [];

  const handleOpenAttachment = useCallback((att: MessageAttachment) => {
    if (att.url) {
      Linking.openURL(att.url).catch(() => {});
    }
  }, []);

  return (
    <View
      style={[
        styles.container,
        isOutbound ? styles.outboundContainer : styles.inboundContainer,
        isConsecutive ? styles.consecutivePadding : styles.normalPadding,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isOutbound ? styles.outboundBubble : styles.inboundBubble,
          isFailed ? styles.failedBubble : null,
        ]}
      >
        {/* Attachments Section */}
        {attachments.length > 0 && (
          <View style={styles.attachmentsContainer}>
            {attachments.map((att, index) => {
              const isImage = att.mimeType?.startsWith('image/');
              if (isImage) {
                return (
                  <TouchableOpacity
                    key={att.id || `att_${index}`}
                    activeOpacity={0.85}
                    onPress={() => handleOpenAttachment(att)}
                    style={styles.imageWrapper}
                  >
                    <Image
                      source={{ uri: att.url }}
                      style={styles.attachmentImage}
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
                  <Text style={styles.fileIcon}>{getFileIcon(att.mimeType || '')}</Text>
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
          <Text style={[styles.text, isOutbound ? styles.outboundText : styles.inboundText]}>
            {message.content}
          </Text>
        )}

        <View style={styles.metaRow}>
          {showTime && <Text style={styles.timeText}>{timeText}</Text>}
          {isOutbound && (
            <View style={styles.statusWrapper}>
              {renderStatusIndicator(message.status, () => onRetry?.(message.clientMessageId))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 12,
    flexDirection: 'row',
  },
  normalPadding: {
    marginVertical: 4,
  },
  consecutivePadding: {
    marginTop: 2,
    marginBottom: 2,
  },
  outboundContainer: {
    justifyContent: 'flex-end',
  },
  inboundContainer: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  outboundBubble: {
    backgroundColor: '#0284C7',
    borderBottomRightRadius: 4,
  },
  inboundBubble: {
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  failedBubble: {
    borderColor: '#EF4444',
    borderWidth: 1,
  },
  attachmentsContainer: {
    gap: 6,
    marginBottom: 4,
  },
  imageWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  attachmentImage: {
    width: 220,
    height: 160,
    borderRadius: 10,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    gap: 8,
    maxWidth: 220,
  },
  fileCardOutbound: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  fileCardInbound: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  fileIcon: {
    fontSize: 20,
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
    color: '#F8FAFC',
  },
  fileSize: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
  outboundText: {
    color: '#FFFFFF',
  },
  inboundText: {
    color: '#F8FAFC',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  statusWrapper: {
    marginLeft: 2,
  },
  statusPending: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  statusSending: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  statusSent: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '700',
  },
  statusDelivered: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '700',
  },
  statusRead: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
  },
  statusFailed: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
  },
  retryTouch: {
    paddingVertical: 1,
    paddingHorizontal: 3,
  },
});
