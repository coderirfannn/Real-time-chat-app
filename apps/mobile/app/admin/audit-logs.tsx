import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../src/services/api/admin.api';
import { Icon } from '../../src/components/ui/Icon';

export default function AdminAuditLogsPage(): React.JSX.Element {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-audit-logs', page, actionFilter],
    queryFn: () =>
      adminApi.getAuditLogs({
        page,
        limit: 20,
        action: actionFilter === 'ALL' ? undefined : actionFilter,
      }),
  });

  const actions = [
    'ALL',
    'USER_SUSPENDED',
    'USER_UNSUSPENDED',
    'USER_BANNED',
    'USER_UNBANNED',
    'USER_VIEWED',
    'USER_PROMOTED_ADMIN',
  ];

  const logs = data?.logs || [];
  const pagination = data?.pagination;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Administrative Audit Logs</Text>
          <Text style={styles.pageSubtitle}>
            Tamper-evident record of all privileged actions and moderation operations.
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => refetch()}>
          <Icon name="check" size={16} color="#8A8D9F" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Action Filter Chips */}
      <View style={styles.filterCard}>
        <Text style={styles.filterLabel}>FILTER BY ACTION:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {actions.map((act) => (
            <TouchableOpacity
              key={act}
              style={[styles.filterChip, actionFilter === act && styles.filterChipActive]}
              onPress={() => {
                setActionFilter(act);
                setPage(1);
              }}
            >
              <Text
                style={[styles.filterChipText, actionFilter === act && styles.filterChipTextActive]}
              >
                {act}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Audit Log Table */}
      <View style={styles.tableCard}>
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#246BFD" />
            <Text style={styles.loadingText}>Fetching audit records...</Text>
          </View>
        ) : isError ? (
          <View style={styles.centerContainer}>
            <Icon name="alert-circle" size={36} color="#FF4D4F" />
            <Text style={styles.errorText}>Failed to load audit logs.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="file-text" size={40} color="#525666" />
            <Text style={styles.emptyTitle}>No audit logs found</Text>
            <Text style={styles.emptySubtitle}>No records matched the selected action filter.</Text>
          </View>
        ) : (
          <View style={styles.tableWrapper}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.columnHeader, { width: 170 }]}>ACTION</Text>
              <Text style={[styles.columnHeader, { width: 140 }]}>ADMIN</Text>
              <Text style={[styles.columnHeader, { flex: 2 }]}>TARGET</Text>
              <Text style={[styles.columnHeader, { flex: 2 }]}>METADATA / DETAILS</Text>
              <Text style={[styles.columnHeader, { width: 170, textAlign: 'right' }]}>
                TIMESTAMP
              </Text>
            </View>

            {logs.map((log) => (
              <View key={log.id} style={styles.tableRow}>
                <View style={[styles.cell, { width: 170 }]}>
                  <ActionBadge action={log.action} />
                </View>
                <View style={[styles.cell, { width: 140 }]}>
                  <Text style={styles.adminText}>{log.adminUsername}</Text>
                </View>
                <View style={[styles.cell, { flex: 2 }]}>
                  <Text style={styles.targetText}>
                    {log.targetType}: <Text style={styles.monoText}>{log.targetId || 'N/A'}</Text>
                  </Text>
                </View>
                <View style={[styles.cell, { flex: 2 }]}>
                  <Text style={styles.metadataText} numberOfLines={2}>
                    {log.metadata && Object.keys(log.metadata).length > 0
                      ? JSON.stringify(log.metadata).replace(/["{}]/g, ' ')
                      : 'None'}
                  </Text>
                </View>
                <View style={[styles.cell, { width: 170, alignItems: 'flex-end' }]}>
                  <Text style={styles.dateText}>{new Date(log.createdAt).toLocaleString()}</Text>
                  {log.ipAddress && <Text style={styles.ipText}>{log.ipAddress}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Pagination Bar */}
        {pagination && pagination.totalPages > 1 && (
          <View style={styles.paginationRow}>
            <Text style={styles.paginationInfo}>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total logs)
            </Text>
            <View style={styles.pageButtons}>
              <TouchableOpacity
                style={[styles.pageButton, !pagination.hasPrevPage && styles.pageButtonDisabled]}
                disabled={!pagination.hasPrevPage}
                onPress={() => setPage(page - 1)}
              >
                <Icon
                  name="chevron-left"
                  size={16}
                  color={pagination.hasPrevPage ? '#FFF' : '#525666'}
                />
                <Text
                  style={[styles.pageButtonText, !pagination.hasPrevPage && { color: '#525666' }]}
                >
                  Previous
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pageButton, !pagination.hasNextPage && styles.pageButtonDisabled]}
                disabled={!pagination.hasNextPage}
                onPress={() => setPage(page + 1)}
              >
                <Text
                  style={[styles.pageButtonText, !pagination.hasNextPage && { color: '#525666' }]}
                >
                  Next
                </Text>
                <Icon
                  name="chevron-right"
                  size={16}
                  color={pagination.hasNextPage ? '#FFF' : '#525666'}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
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
  } else if (
    action.includes('UNBAN') ||
    action.includes('UNSUSPEND') ||
    action.includes('PROMOTED')
  ) {
    bgColor = 'rgba(18, 209, 142, 0.15)';
    textColor = '#12D18E';
  }

  return (
    <View style={[styles.badgePill, { backgroundColor: bgColor }]}>
      <Text style={[styles.badgeText, { color: textColor }]}>{action}</Text>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#8A8D9F',
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
  filterCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6C7080',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: 'rgba(36, 107, 253, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(36, 107, 253, 0.3)',
  },
  filterChipText: {
    fontSize: 12,
    color: '#8A8D9F',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#246BFD',
    fontWeight: '700',
  },
  tableCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  tableWrapper: {
    minWidth: 800,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#16181E',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  columnHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6C7080',
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  cell: {
    justifyContent: 'center',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  adminText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  targetText: {
    color: '#8A8D9F',
    fontSize: 12,
  },
  monoText: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    color: '#C0C4D6',
  },
  metadataText: {
    color: '#6C7080',
    fontSize: 12,
  },
  dateText: {
    color: '#8A8D9F',
    fontSize: 12,
  },
  ipText: {
    color: '#525666',
    fontSize: 10,
    marginTop: 2,
  },
  centerContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#8A8D9F',
    fontSize: 13,
  },
  errorText: {
    color: '#FF4D4F',
    fontSize: 14,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#246BFD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#6C7080',
    fontSize: 13,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    flexWrap: 'wrap',
    gap: 10,
  },
  paginationInfo: {
    fontSize: 12,
    color: '#6C7080',
  },
  pageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#14161B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
});
