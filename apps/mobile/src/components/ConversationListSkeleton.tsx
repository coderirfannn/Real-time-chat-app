/**
 * ChatLock UI Kit — ConversationListSkeleton
 * High-fidelity animated skeleton placeholder loader for conversations list
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export interface ConversationListSkeletonProps {
  count?: number;
}

export function ConversationListSkeleton({ count = 7 }: ConversationListSkeletonProps): React.JSX.Element {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={`conv-skeleton-${index}`} style={styles.row}>
          {/* Avatar Skeleton */}
          <Animated.View style={[styles.avatar, { opacity: pulseAnim }]} />

          {/* Content Column */}
          <View style={styles.content}>
            <View style={styles.topRow}>
              {/* Name Bar */}
              <Animated.View
                style={[
                  styles.nameBar,
                  { width: index % 2 === 0 ? 130 : 160, opacity: pulseAnim },
                ]}
              />
              {/* Timestamp Bar */}
              <Animated.View style={[styles.timeBar, { opacity: pulseAnim }]} />
            </View>

            <View style={styles.bottomRow}>
              {/* Snippet Bar */}
              <Animated.View
                style={[
                  styles.snippetBar,
                  { width: index % 3 === 0 ? '75%' : '90%', opacity: pulseAnim },
                ]}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D36',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1F222A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameBar: {
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1F222A',
  },
  timeBar: {
    width: 44,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1F222A',
  },
  bottomRow: {
    flexDirection: 'row',
  },
  snippetBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1F222A',
  },
});
