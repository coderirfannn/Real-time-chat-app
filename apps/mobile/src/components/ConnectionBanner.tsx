import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSocketStore } from '../store/socket.store';
import { useAppStore } from '../store/app.store';

export function ConnectionBanner(): React.JSX.Element | null {
  const connectionState = useSocketStore((state) => state.connectionState);
  const isOnline = useAppStore((state) => state.isOnline);

  if (!isOnline) {
    return (
      <View style={[styles.banner, styles.offline]}>
        <Text style={styles.text}>Waiting for network connection...</Text>
      </View>
    );
  }

  if (connectionState === 'connecting') {
    return (
      <View style={[styles.banner, styles.connecting]}>
        <Text style={styles.text}>Connecting to ChatLock...</Text>
      </View>
    );
  }

  if (connectionState === 'reconnecting') {
    return (
      <View style={[styles.banner, styles.reconnecting]}>
        <Text style={styles.text}>Reconnecting to chat...</Text>
      </View>
    );
  }

  if (connectionState === 'error') {
    return (
      <View style={[styles.banner, styles.error]}>
        <Text style={styles.text}>Connection failed. Retrying...</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  offline: {
    backgroundColor: '#7F1D1D',
  },
  connecting: {
    backgroundColor: '#1E293B',
  },
  reconnecting: {
    backgroundColor: '#854D0E',
  },
  error: {
    backgroundColor: '#991B1B',
  },
  text: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '500',
  },
});
