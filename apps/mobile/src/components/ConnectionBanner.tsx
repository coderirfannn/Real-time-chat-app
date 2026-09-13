import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from './ui/Icon';
import { useSocketStore } from '../store/socket.store';
import { useAppStore } from '../store/app.store';

/**
 * ConnectionBanner — shows only when the app has previously connected
 * successfully and subsequently lost connection (reconnecting / error / offline).
 *
 * Does NOT show on initial startup "connecting" state — that is expected
 * behaviour, not an error condition.
 */
export function ConnectionBanner(): React.JSX.Element | null {
  const connectionState = useSocketStore((state) => state.connectionState);
  const isOnline = useAppStore((state) => state.isOnline);

  // Track whether we have ever reached a stable connected state
  const wasEverConnectedRef = useRef(false);

  useEffect(() => {
    if (connectionState === 'connected') {
      wasEverConnectedRef.current = true;
    }
  }, [connectionState]);

  const wasEverConnected = wasEverConnectedRef.current;

  // No internet — always show regardless of prior connection state
  if (!isOnline) {
    return (
      <View style={[styles.banner, styles.offline]}>
        <Icon name="alert-circle" size={14} color="#F75555" />
        <Text style={[styles.text, styles.offlineText]}>
          No internet connection. Messages will queue.
        </Text>
      </View>
    );
  }

  // Only surface connecting/error banners AFTER a successful connection was established
  // On first launch, suppress entirely — connection is expected behavior, not an error
  if (!wasEverConnected) {
    return null;
  }

  if (connectionState === 'reconnecting') {
    return (
      <View style={[styles.banner, styles.reconnecting]}>
        <View style={[styles.pulseDot, styles.reconnectingDot]} />
        <Text style={[styles.text, styles.reconnectingText]}>
          Reconnecting…
        </Text>
      </View>
    );
  }

  if (connectionState === 'error') {
    return (
      <View style={[styles.banner, styles.error]}>
        <Icon name="alert-circle" size={14} color="#F75555" />
        <Text style={[styles.text, styles.errorText]}>
          Connection lost. Retrying securely…
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 8,
    borderBottomWidth: 1,
  },
  offline: {
    backgroundColor: 'rgba(247, 85, 85, 0.15)',
    borderBottomColor: 'rgba(247, 85, 85, 0.3)',
  },
  reconnecting: {
    backgroundColor: 'rgba(255, 186, 0, 0.12)',
    borderBottomColor: 'rgba(255, 186, 0, 0.28)',
  },
  error: {
    backgroundColor: 'rgba(247, 85, 85, 0.18)',
    borderBottomColor: 'rgba(247, 85, 85, 0.35)',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  reconnectingDot: {
    backgroundColor: '#FFBA00',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  offlineText: {
    color: '#F75555',
  },
  reconnectingText: {
    color: '#FFBA00',
  },
  errorText: {
    color: '#F75555',
  },
});
