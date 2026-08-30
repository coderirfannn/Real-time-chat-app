import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ConversationListScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Conversations</Text>
      <Text style={styles.subtitle}>Your real-time encrypted chats</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
  },
});
