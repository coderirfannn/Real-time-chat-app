import React from 'react';
import { StyleSheet, Text, View, StatusBar, SafeAreaView } from 'react-native';
import { mobileConfig } from './config/env';

export default function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <View style={styles.card}>
        <Text style={styles.title}>ChatLock</Text>
        <Text style={styles.subtitle}>Production-Grade Real-Time Messaging Platform</Text>

        <View style={styles.badgeContainer}>
          <Text style={styles.badge}>Environment: {mobileConfig.env}</Text>
          <Text style={styles.badge}>Foundation: Active</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>API Endpoint:</Text>
          <Text style={styles.infoValue}>{mobileConfig.apiUrl}</Text>

          <Text style={styles.infoLabel}>Socket Gateway:</Text>
          <Text style={styles.infoValue}>{mobileConfig.socketUrl}</Text>
        </View>

        <Text style={styles.footerText}>
          Core architecture initialized. Ready for auth & real-time messaging subsystems.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  badgeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  badge: {
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  infoBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    marginTop: 6,
  },
  infoValue: {
    fontSize: 13,
    color: '#38BDF8',
    fontFamily: 'monospace',
    marginTop: 2,
    marginBottom: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
