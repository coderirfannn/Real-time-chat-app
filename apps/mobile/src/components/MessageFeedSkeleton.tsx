/**
 * ChatLock UI Kit — MessageFeedSkeleton
 * High-fidelity animated skeleton placeholder loader for chat message feeds
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export function MessageFeedSkeleton(): React.JSX.Element {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      {/* Date Pill Placeholder */}
      <View style={styles.dateSeparatorRow}>
        <Animated.View style={[styles.datePill, { opacity: pulseAnim }]} />
      </View>

      {/* Bubble 1: Inbound */}
      <View style={[styles.bubbleRow, styles.inboundRow]}>
        <Animated.View
          style={[styles.bubble, styles.inboundBubble, { width: 210, height: 48, opacity: pulseAnim }]}
        />
      </View>

      {/* Bubble 2: Inbound consecutive */}
      <View style={[styles.bubbleRow, styles.inboundRow]}>
        <Animated.View
          style={[styles.bubble, styles.inboundBubble, { width: 150, height: 40, opacity: pulseAnim }]}
        />
      </View>

      {/* Bubble 3: Outbound */}
      <View style={[styles.bubbleRow, styles.outboundRow]}>
        <Animated.View
          style={[styles.bubble, styles.outboundBubble, { width: 240, height: 60, opacity: pulseAnim }]}
        />
      </View>

      {/* Bubble 4: Inbound */}
      <View style={[styles.bubbleRow, styles.inboundRow]}>
        <Animated.View
          style={[styles.bubble, styles.inboundBubble, { width: 280, height: 68, opacity: pulseAnim }]}
        />
      </View>

      {/* Bubble 5: Outbound */}
      <View style={[styles.bubbleRow, styles.outboundRow]}>
        <Animated.View
          style={[styles.bubble, styles.outboundBubble, { width: 170, height: 44, opacity: pulseAnim }]}
        />
      </View>

      {/* Bubble 6: Outbound consecutive */}
      <View style={[styles.bubbleRow, styles.outboundRow]}>
        <Animated.View
          style={[styles.bubble, styles.outboundBubble, { width: 120, height: 38, opacity: pulseAnim }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: 'flex-end',
    gap: 12,
  },
  dateSeparatorRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  datePill: {
    width: 90,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1F222A',
  },
  bubbleRow: {
    width: '100%',
    flexDirection: 'row',
  },
  inboundRow: {
    justifyContent: 'flex-start',
  },
  outboundRow: {
    justifyContent: 'flex-end',
  },
  bubble: {
    borderRadius: 18,
  },
  inboundBubble: {
    backgroundColor: '#1F222A',
    borderBottomLeftRadius: 4,
  },
  outboundBubble: {
    backgroundColor: '#262A34',
    borderBottomRightRadius: 4,
  },
});
