import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { Badge } from '../../../components/Badge';
import { formatConversationTime } from '../../../utils/date-formatter';
import { brandColors } from '../../../theme/colors';
import type { ConversationItemData } from '../../../types/chat.types';

export interface ConversationItemProps {
  item: ConversationItemData;
  onPress: (conversationId: string) => void;
  isSelected?: boolean;
}

export const ConversationItem = memo(function ConversationItem({
  item,
  onPress,
  isSelected = false,
}: ConversationItemProps): React.JSX.Element {
  const displayName = item.recipient.displayName || item.recipient.username || 'Direct Message';
  const lastMessageText = item.lastMessage?.content || 'No messages yet';
  const timeText = formatConversationTime(item.lastMessageAt || item.lastMessage?.createdAt);
  const hasUnread = Boolean(item.unreadCount && item.unreadCount > 0);

  return (
    <TouchableOpacity
      style={[styles.container, isSelected && styles.containerSelected]}
      onPress={() => onPress(item.id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${displayName}. Last message: ${lastMessageText}. ${
        hasUnread ? `${item.unreadCount} unread messages.` : ''
      }`}
    >
      <Avatar
        name={displayName}
        avatarUrl={item.recipient.avatarUrl}
        size="md"
        isOnline={item.isOnline}
        hasRing={false}
      />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
            {displayName}
          </Text>
          {timeText ? (
            <Text style={[styles.time, hasUnread && styles.timeUnread]}>{timeText}</Text>
          ) : null}
        </View>

        <View style={styles.bottomRow}>
          <Text style={[styles.snippet, hasUnread && styles.snippetUnread]} numberOfLines={1}>
            {lastMessageText}
          </Text>
          <Badge count={item.unreadCount} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    // No bottom border — Figma uses pure padding-based separation
    backgroundColor: '#181A20',
  },
  containerSelected: {
    backgroundColor: '#262A34',
    borderRadius: 0,
  },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  nameUnread: {
    fontWeight: '700',
  },
  time: {
    fontSize: 11,
    color: '#757B8C',
    fontWeight: '500',
    flexShrink: 0,
  },
  timeUnread: {
    color: brandColors.primary,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minWidth: 0,
  },
  snippet: {
    fontSize: 13,
    color: '#A0A5B5',
    flex: 1,
    marginRight: 8,
  },
  snippetUnread: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
});
