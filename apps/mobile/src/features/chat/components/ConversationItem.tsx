import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Avatar } from '../../../components/Avatar.js';
import { Badge } from '../../../components/Badge.js';
import { formatConversationTime } from '../../../utils/date-formatter.js';
import type { ConversationItemData } from '../../../types/chat.types.js';

export interface ConversationItemProps {
  item: ConversationItemData;
  onPress: (conversationId: string) => void;
}

export const ConversationItem = memo(function ConversationItem({
  item,
  onPress,
}: ConversationItemProps): React.JSX.Element {
  const displayName = item.recipient.displayName || item.recipient.username || 'Direct Message';
  const lastMessageText = item.lastMessage?.content || 'No messages yet';
  const timeText = formatConversationTime(item.lastMessageAt || item.lastMessage?.createdAt);

  return (
    <TouchableOpacity style={styles.container} onPress={() => onPress(item.id)} activeOpacity={0.7}>
      <Avatar
        name={displayName}
        avatarUrl={item.recipient.avatarUrl}
        size="md"
        isOnline={item.isOnline}
      />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {timeText ? <Text style={styles.time}>{timeText}</Text> : null}
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.snippet} numberOfLines={1}>
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
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    color: '#64748B',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  snippet: {
    fontSize: 14,
    color: '#94A3B8',
    flex: 1,
    marginRight: 8,
  },
});
