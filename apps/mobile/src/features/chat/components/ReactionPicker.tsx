import React, { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Animated } from 'react-native';
import { Icon } from '../../../components/ui/Icon';

export const QUICK_EMOJIS = ['❤️', '👍', '😂', '🔥', '😮', '😢', '👏', '🎉'];

export interface ReactionPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onReply?: () => void;
  onCopy?: () => void;
  onClose?: () => void;
  isOutbound?: boolean;
}

export const ReactionPicker = memo(function ReactionPicker({
  onSelectEmoji,
  onReply,
  onCopy,
  isOutbound = false,
}: ReactionPickerProps): React.JSX.Element {
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enterAnim, {
      toValue: 1,
      friction: 7,
      tension: 90,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [enterAnim]);

  const scale = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        isOutbound ? styles.outboundContainer : styles.inboundContainer,
        {
          opacity: enterAnim,
          transform: [{ scale }],
        },
      ]}
    >
      <View style={styles.bubbleCard}>
        {/* Emoji row with horizontal scroll for small phone screens */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.emojiRow}
        >
          {QUICK_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => onSelectEmoji(emoji)}
              style={styles.emojiButton}
              activeOpacity={0.6}
              accessibilityLabel={`React with ${emoji}`}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Action buttons row */}
        {(Boolean(onReply) || Boolean(onCopy)) && (
          <View style={styles.actionsRow}>
            {Boolean(onReply) && (
              <TouchableOpacity
                onPress={onReply}
                style={styles.actionBtn}
                activeOpacity={0.7}
                accessibilityLabel="Reply to this message"
              >
                <Icon name="reply" size={13} color="#A0A5B5" />
                <Text style={styles.actionText}>Reply</Text>
              </TouchableOpacity>
            )}

            {Boolean(onCopy) && (
              <TouchableOpacity
                onPress={onCopy}
                style={styles.actionBtn}
                activeOpacity={0.7}
                accessibilityLabel="Copy message text"
              >
                <Icon name="copy" size={13} color="#A0A5B5" />
                <Text style={styles.actionText}>Copy</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    zIndex: 100,
    width: '100%',
  },
  outboundContainer: {
    alignItems: 'flex-end',
  },
  inboundContainer: {
    alignItems: 'flex-start',
  },
  bubbleCard: {
    backgroundColor: '#1F222A',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2A2D36',
    paddingVertical: 8,
    paddingHorizontal: 10,
    maxWidth: 350,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 8,
      },
    }),
  },
  emojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  emojiButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#262A34',
  },
  emojiText: {
    fontSize: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#2A2D36',
    marginTop: 8,
    paddingTop: 8,
    gap: 10,
    paddingHorizontal: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#262A34',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
