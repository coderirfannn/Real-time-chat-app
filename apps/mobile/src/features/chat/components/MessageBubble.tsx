import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { formatMessageTime } from '../../../utils/date-formatter';
import type { LocalMessage, DeliveryStatus } from '../../../types/chat.types';

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

export const MessageBubble = memo(function MessageBubble({
  message,
  isOutbound,
  showTime = true,
  isConsecutive = false,
  onRetry,
}: MessageBubbleProps): React.JSX.Element {
  const timeText = formatMessageTime(message.createdAt);
  const isFailed = message.status === 'failed';

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
        <Text style={[styles.text, isOutbound ? styles.outboundText : styles.inboundText]}>
          {message.content}
        </Text>

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
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
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
