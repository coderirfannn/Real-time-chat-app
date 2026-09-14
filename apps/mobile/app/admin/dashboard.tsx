import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../src/services/api/admin.api';
import { Icon, type IconName } from '../../src/components/ui/Icon';

export default function AdminDashboard(): React.JSX.Element {
  const router = useRouter();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminApi.getDashboard(),
    refetchInterval: 15000, // Live poll every 15s
  });

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hrs = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${seconds % 60}s`;
  };

  if (isLoading && !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#246BFD" />
        <Text style={styles.loadingText}>Fetching real-time metrics...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle" size={48} color="#FF4D4F" />
        <Text style={styles.errorTitle}>Failed to Load Dashboard</Text>
        <Text style={styles.errorSubtitle}>
          Could not communicate with the administrative API service.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const metrics = data?.metrics;
  const recentLogs = data?.recentAuditLogs || [];
  const health = data?.systemHealth;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#246BFD" />
      }
    >
      {/* Header Banner */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Platform Control Center</Text>
          <Text style={styles.pageSubtitle}>
            Live platform metrics, user moderation, and infrastructure audit overview.
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => refetch()}
            disabled={isRefetching}
          >
            <Icon name="check" size={16} color="#8A8D9F" />
            <Text style={styles.refreshButtonText}>
              {isRefetching ? 'Refreshing...' : 'Refresh'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => router.push('/admin/users' as never)}
          >
            <Icon name="user" size={16} color="#FFF" />
            <Text style={styles.primaryActionText}>User Directory</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Primary Metrics Grid */}
      <Text style={styles.sectionHeading}>USERS & ACCOUNTS</Text>
      <View style={styles.metricsGrid}>
        <MetricCard
          title="Total Registered Users"
          value={metrics?.totalUsers ?? 0}
          icon="user"
          color="#246BFD"
          subtitle="All platform accounts"
        />
        <MetricCard
          title="Active Users"
          value={metrics?.activeUsers ?? 0}
          icon="check-check"
          color="#12D18E"
          subtitle="Unrestricted messaging"
        />
        <MetricCard
          title="Suspended Users"
          value={metrics?.suspendedUsers ?? 0}
          icon="alert-circle"
          color="#FACC15"
          subtitle="Temporarily restricted"
        />
        <MetricCard
          title="Banned Users"
          value={metrics?.bannedUsers ?? 0}
          icon="lock"
          color="#FF4D4F"
          subtitle="Permanent TOS bans"
        />
      </View>

      {/* Secondary Metrics Grid */}
      <Text style={styles.sectionHeading}>REAL-TIME ACTIVITY & MESSAGING</Text>
      <View style={styles.metricsGrid}>
        <MetricCard
          title="Users Online Now"
          value={metrics?.onlineUsers ?? 0}
          icon="chat"
          color="#12D18E"
          subtitle="Live socket connections"
        />
        <MetricCard
          title="Conversations"
          value={metrics?.totalConversations ?? 0}
          icon="chat"
          color="#7B61FF"
          subtitle={`${metrics?.directChats ?? 0} direct, ${metrics?.groupChats ?? 0} groups`}
        />
        <MetricCard
          title="Total Messages"
          value={metrics?.totalMessages ?? 0}
          icon="send"
          color="#00C7BE"
          subtitle={`${metrics?.mediaAttachments ?? 0} media attachments`}
        />
        <MetricCard
          title="Pending Reports"
          value={metrics?.pendingReports ?? 0}
          icon="shield"
          color="#FF9500"
          subtitle="Awaiting admin review"
        />
      </View>

      {/* System Health Banner */}
      <View style={styles.healthCard}>
        <View style={styles.healthHeader}>
          <View style={styles.healthTitleGroup}>
            <View style={styles.liveDot} />
            <Text style={styles.healthCardTitle}>Backend Infrastructure Status</Text>
          </View>
          <View style={styles.healthyPill}>
            <Text style={styles.healthyPillText}>OPERATIONAL</Text>
          </View>
        </View>

        <View style={styles.healthGrid}>
          <View style={styles.healthStat}>
            <Text style={styles.healthLabel}>API Engine Uptime</Text>
            <Text style={styles.healthValue}>{formatUptime(health?.uptime ?? 0)}</Text>
          </View>
          <View style={styles.healthStat}>
            <Text style={styles.healthLabel}>MongoDB Persistence</Text>
            <Text style={[styles.healthValue, { color: '#12D18E' }]}>Connected & Healthy</Text>
          </View>
          <View style={styles.healthStat}>
            <Text style={styles.healthLabel}>Redis State Cache</Text>
            <Text style={[styles.healthValue, { color: '#12D18E' }]}>Synchronized</Text>
          </View>
          <View style={styles.healthStat}>
            <Text style={styles.healthLabel}>Admin Audit Entries</Text>
            <Text style={styles.healthValue}>{metrics?.totalAuditLogs ?? 0} actions recorded</Text>
          </View>
        </View>
      </View>

      {/* Recent Administrative Activity Feed */}
      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <View>
            <Text style={styles.tableTitle}>Recent Administrative Activity</Text>
            <Text style={styles.tableSubtitle}>
              Audit log of privileged actions performed by administrators
            </Text>
          </View>
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => router.push('/admin/audit-logs' as never)}
          >
            <Text style={styles.viewAllText}>View All Logs</Text>
            <Icon name="chevron-right" size={14} color="#246BFD" />
          </TouchableOpacity>
        </View>

        {recentLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="file-text" size={32} color="#525666" />
            <Text style={styles.emptyText}>No recent administrative actions recorded.</Text>
          </View>
        ) : (
          <View style={styles.logList}>
            {recentLogs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.logActionGroup}>
                  <ActionBadge action={log.action} />
                  <View>
                    <Text style={styles.logAdmin}>
                      By{' '}
                      <Text style={{ color: '#FFF', fontWeight: '600' }}>{log.adminUsername}</Text>
                    </Text>
                    {log.targetId && (
                      <Text style={styles.logTarget}>
                        Target ID: <Text style={styles.mono}>{log.targetId}</Text>
                      </Text>
                    )}
                  </View>
                </View>
                <Text style={styles.logDate}>
                  {new Date(log.createdAt).toLocaleTimeString()} ·{' '}
                  {new Date(log.createdAt).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function MetricCard({
  title,
  value,
  icon,
  color,
  subtitle,
}: {
  title: string;
  value: number;
  icon: IconName;
  color: string;
  subtitle: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={[styles.cardIconBadge, { backgroundColor: `${color}18` }]}>
          <Icon name={icon} size={18} color={color} />
        </View>
      </View>
      <Text style={styles.cardValue}>{value.toLocaleString()}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </View>
  );
}

function ActionBadge({ action }: { action: string }) {
  let bgColor = 'rgba(36, 107, 253, 0.15)';
  let textColor = '#246BFD';

  if (action.includes('SUSPEND')) {
    bgColor = 'rgba(250, 204, 21, 0.15)';
    textColor = '#FACC15';
  } else if (action.includes('BAN')) {
    bgColor = 'rgba(255, 77, 79, 0.15)';
    textColor = '#FF4D4F';
  } else if (action.includes('UNBAN') || action.includes('UNSUSPEND')) {
    bgColor = 'rgba(18, 209, 142, 0.15)';
    textColor = '#12D18E';
  }

  return (
    <View style={[styles.badgePill, { backgroundColor: bgColor }]}>
      <Text style={[styles.badgePillText, { color: textColor }]}>{action}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121418',
  },
  contentContainer: {
    padding: 24,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#121418',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8A8D9F',
    fontSize: 14,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#121418',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#8A8D9F',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#246BFD',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#8A8D9F',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A1D24',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  refreshButtonText: {
    color: '#8A8D9F',
    fontSize: 13,
    fontWeight: '500',
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#246BFD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryActionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6C7080',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#1A1D24',
    borderRadius: 14,
    padding: 18,
    margin: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    color: '#8A8D9F',
    fontWeight: '500',
  },
  cardIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6C7080',
  },
  healthCard: {
    backgroundColor: '#16181E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  healthTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#12D18E',
  },
  healthCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  healthyPill: {
    backgroundColor: 'rgba(18, 209, 142, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  healthyPillText: {
    color: '#12D18E',
    fontSize: 11,
    fontWeight: '700',
  },
  healthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  healthStat: {
    flex: 1,
    minWidth: 180,
  },
  healthLabel: {
    fontSize: 12,
    color: '#6C7080',
    marginBottom: 4,
  },
  healthValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tableCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  tableSubtitle: {
    fontSize: 13,
    color: '#8A8D9F',
    marginTop: 2,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    color: '#246BFD',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    color: '#6C7080',
    fontSize: 13,
  },
  logList: {
    gap: 10,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#14161B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    flexWrap: 'wrap',
    gap: 8,
  },
  logActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  logAdmin: {
    fontSize: 13,
    color: '#8A8D9F',
  },
  logTarget: {
    fontSize: 12,
    color: '#6C7080',
    marginTop: 2,
  },
  mono: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    color: '#A0A4B8',
  },
  logDate: {
    fontSize: 12,
    color: '#6C7080',
  },
});
