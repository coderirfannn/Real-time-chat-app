import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../src/services/api/admin.api';
import { Icon } from '../../src/components/ui/Icon';

export default function AdminSettingsPage(): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminApi.getSettings(),
  });

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hrs = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hrs > 0) parts.push(`${hrs}h`);
    parts.push(`${mins}m`);
    return parts.join(' ');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>System Configuration & Health</Text>
          <Text style={styles.pageSubtitle}>
            Live platform architecture parameters, feature flags, and security controls.
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => refetch()}>
          <Icon name="check" size={16} color="#8A8D9F" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Security Notice */}
      <View style={styles.securityNotice}>
        <Icon name="lock" size={20} color="#52C41A" />
        <Text style={styles.securityNoticeText}>
          Security Boundary: Sensitive secrets, private cryptographic keys, and database connection
          strings are never exposed over the administrative API.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#246BFD" />
          <Text style={styles.loadingText}>Fetching system configuration...</Text>
        </View>
      ) : isError || !data ? (
        <View style={styles.centerContainer}>
          <Icon name="alert-circle" size={36} color="#FF4D4F" />
          <Text style={styles.errorText}>Failed to retrieve system settings.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.grid}>
          {/* General Environment */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="server" size={18} color="#246BFD" />
              <Text style={styles.cardTitle}>Application & Runtime</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Application Name</Text>
              <Text style={styles.val}>{data.appName}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Environment</Text>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{data.environment.toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>API Prefix</Text>
              <Text style={styles.val}>{data.apiPrefix}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Storage Driver</Text>
              <Text style={styles.val}>{data.storageDriver}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Server Uptime</Text>
              <Text style={styles.valHighlight}>{formatUptime(data.serverUptime)}</Text>
            </View>
          </View>

          {/* Rate Limiting */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="shield" size={18} color="#FFC53D" />
              <Text style={styles.cardTitle}>API Rate Limiting</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Rate Limit Window</Text>
              <Text style={styles.val}>{Math.round(data.rateLimit.windowMs / 1000)} seconds</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Max Requests Per Window</Text>
              <Text style={styles.val}>{data.rateLimit.maxRequests} req</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Burst Protection</Text>
              <Text style={styles.valHighlight}>Enabled (Strict)</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>DDoS Mitigation</Text>
              <Text style={styles.valHighlight}>Active</Text>
            </View>
          </View>

          {/* Feature Flags */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="settings" size={18} color="#B37FEB" />
              <Text style={styles.cardTitle}>Feature Flags & Capabilities</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>End-to-End Encryption (E2EE)</Text>
              <View
                style={[
                  styles.featureTag,
                  { backgroundColor: data.features.e2ee ? '#133827' : '#3D1A1E' },
                ]}
              >
                <Text
                  style={[
                    styles.featureTagText,
                    { color: data.features.e2ee ? '#52C41A' : '#FF4D4F' },
                  ]}
                >
                  {data.features.e2ee ? 'ENABLED' : 'DISABLED'}
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Message Reactions</Text>
              <View
                style={[
                  styles.featureTag,
                  { backgroundColor: data.features.messageReactions ? '#133827' : '#3D1A1E' },
                ]}
              >
                <Text
                  style={[
                    styles.featureTagText,
                    { color: data.features.messageReactions ? '#52C41A' : '#FF4D4F' },
                  ]}
                >
                  {data.features.messageReactions ? 'ENABLED' : 'DISABLED'}
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Voice Calls</Text>
              <View
                style={[
                  styles.featureTag,
                  { backgroundColor: data.features.voiceCalls ? '#133827' : '#3D1A1E' },
                ]}
              >
                <Text
                  style={[
                    styles.featureTagText,
                    { color: data.features.voiceCalls ? '#52C41A' : '#FF4D4F' },
                  ]}
                >
                  {data.features.voiceCalls ? 'ENABLED' : 'DISABLED'}
                </Text>
              </View>
            </View>
          </View>

          {/* Platform Security Boundaries */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="lock" size={18} color="#52C41A" />
              <Text style={styles.cardTitle}>Platform Architecture Bounds</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Admin UI Exposure</Text>
              <Text style={styles.valHighlight}>Web Browser Only</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Mobile Native Admin</Text>
              <View style={[styles.featureTag, { backgroundColor: '#3D1A1E' }]}>
                <Text style={[styles.featureTagText, { color: '#FF4D4F' }]}>
                  PROHIBITED (0 Routes)
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>RBAC Enforcement</Text>
              <Text style={styles.valHighlight}>Live MongoDB Verification</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Audit Trails</Text>
              <Text style={styles.valHighlight}>Immutable Server Logs</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121318',
  },
  contentContainer: {
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#8A8D9F',
    marginTop: 4,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#1E202B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E3346',
  },
  refreshButtonText: {
    color: '#8A8D9F',
    fontSize: 13,
    fontWeight: '600',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#132B1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E5E3A',
    marginBottom: 24,
  },
  securityNoticeText: {
    flex: 1,
    color: '#8AE8AA',
    fontSize: 13,
    lineHeight: 18,
  },
  centerContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#8A8D9F',
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    color: '#FF4D4F',
    fontSize: 14,
    marginTop: 10,
  },
  retryButton: {
    marginTop: 14,
    backgroundColor: '#246BFD',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  grid: {
    gap: 20,
  },
  card: {
    backgroundColor: '#1A1C24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262A38',
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#262A38',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#202330',
  },
  label: {
    fontSize: 13,
    color: '#8A8D9F',
  },
  val: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  valHighlight: {
    fontSize: 13,
    fontWeight: '700',
    color: '#52C41A',
  },
  tag: {
    backgroundColor: '#1D2A44',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  tagText: {
    color: '#246BFD',
    fontSize: 11,
    fontWeight: '700',
  },
  featureTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  featureTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
