import React, { useState } from 'react';
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

export default function AdminReportsPage(): React.JSX.Element {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-reports', page, statusFilter],
    queryFn: () =>
      adminApi.getReports({
        page,
        limit: 20,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
  });

  const statuses = ['ALL', 'PENDING', 'RESOLVED', 'DISMISSED'];
  const reports = data?.reports || [];
  const pagination = data?.pagination;

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { bg: '#3D2F14', text: '#FFC53D', border: '#7A5B1E' };
      case 'RESOLVED':
        return { bg: '#133827', text: '#52C41A', border: '#237804' };
      case 'DISMISSED':
        return { bg: '#25293A', text: '#8A8D9F', border: '#3E445B' };
      default:
        return { bg: '#25293A', text: '#8A8D9F', border: '#3E445B' };
    }
  };

  const getTargetTypeBadge = (targetType: string) => {
    switch (targetType) {
      case 'USER':
        return { bg: '#1D2A44', text: '#246BFD' };
      case 'MESSAGE':
        return { bg: '#372047', text: '#B37FEB' };
      case 'CONVERSATION':
        return { bg: '#1B3E3E', text: '#36CFC9' };
      default:
        return { bg: '#25293A', text: '#8A8D9F' };
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Reports Management</Text>
          <Text style={styles.pageSubtitle}>
            Moderation queue for user complaints, abusive content, and policy violations.
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => refetch()}>
          <Icon name="check" size={16} color="#8A8D9F" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="shield" size={20} color="#246BFD" />
        <Text style={styles.infoBannerText}>
          Reports foundation is active (Task 28). Reports submitted by users will appear directly in
          this moderation queue.
        </Text>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterCard}>
        <Text style={styles.filterLabel}>FILTER BY STATUS:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {statuses.map((st) => (
            <TouchableOpacity
              key={st}
              style={[styles.filterChip, statusFilter === st && styles.filterChipActive]}
              onPress={() => {
                setStatusFilter(st);
                setPage(1);
              }}
            >
              <Text
                style={[styles.filterChipText, statusFilter === st && styles.filterChipTextActive]}
              >
                {st}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Reports Table */}
      <View style={styles.tableCard}>
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#246BFD" />
            <Text style={styles.loadingText}>Fetching moderation reports...</Text>
          </View>
        ) : isError ? (
          <View style={styles.centerContainer}>
            <Icon name="alert-circle" size={36} color="#FF4D4F" />
            <Text style={styles.errorText}>Failed to load reports.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.centerContainer}>
            <Icon name="shield" size={44} color="#3E445B" />
            <Text style={styles.emptyTitle}>No reports found</Text>
            <Text style={styles.emptySubtitle}>
              {statusFilter === 'ALL'
                ? 'There are currently no reported incidents in the database.'
                : `No reports found matching status "${statusFilter}".`}
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.colHeader, { width: 140 }]}>TARGET TYPE</Text>
                <Text style={[styles.colHeader, { width: 180 }]}>REPORTED USER / ID</Text>
                <Text style={[styles.colHeader, { width: 180 }]}>REPORTER</Text>
                <Text style={[styles.colHeader, { width: 220 }]}>REASON</Text>
                <Text style={[styles.colHeader, { width: 130 }]}>STATUS</Text>
                <Text style={[styles.colHeader, { width: 160 }]}>FILED AT</Text>
              </View>

              {reports.map((rep) => {
                const sBadge = getStatusBadgeStyle(rep.status);
                const tBadge = getTargetTypeBadge(rep.targetType);
                return (
                  <View key={rep.id} style={styles.tableRow}>
                    <View style={[{ width: 140 }]}>
                      <View style={[styles.typeTag, { backgroundColor: tBadge.bg }]}>
                        <Text style={[styles.typeTagText, { color: tBadge.text }]}>
                          {rep.targetType}
                        </Text>
                      </View>
                    </View>

                    <View style={[{ width: 180 }]}>
                      <Text style={styles.cellBold} numberOfLines={1}>
                        {rep.reportedUsername || rep.reportedUserId}
                      </Text>
                      <Text style={styles.cellSub} numberOfLines={1}>
                        ID: {rep.reportedUserId.substring(0, 10)}...
                      </Text>
                    </View>

                    <View style={[{ width: 180 }]}>
                      <Text style={styles.cellText} numberOfLines={1}>
                        {rep.reporterUsername || rep.reporterId}
                      </Text>
                    </View>

                    <View style={[{ width: 220 }]}>
                      <Text style={styles.cellText} numberOfLines={1}>
                        {rep.reason}
                      </Text>
                      {rep.details ? (
                        <Text style={styles.cellSub} numberOfLines={1}>
                          {rep.details}
                        </Text>
                      ) : null}
                    </View>

                    <View style={[{ width: 130 }]}>
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: sBadge.bg,
                            borderColor: sBadge.border,
                          },
                        ]}
                      >
                        <Text style={[styles.badgeText, { color: sBadge.text }]}>{rep.status}</Text>
                      </View>
                    </View>

                    <View style={[{ width: 160 }]}>
                      <Text style={styles.cellSub}>{new Date(rep.createdAt).toLocaleString()}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Pagination Bar */}
        {pagination && pagination.totalPages > 1 && (
          <View style={styles.paginationBar}>
            <Text style={styles.paginationText}>
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total
              reports)
            </Text>
            <View style={styles.pageButtons}>
              <TouchableOpacity
                style={[styles.pageBtn, !pagination.hasPrevPage && styles.pageBtnDisabled]}
                disabled={!pagination.hasPrevPage}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              >
                <Text
                  style={[
                    styles.pageBtnText,
                    !pagination.hasPrevPage && styles.pageBtnTextDisabled,
                  ]}
                >
                  Previous
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pageBtn, !pagination.hasNextPage && styles.pageBtnDisabled]}
                disabled={!pagination.hasNextPage}
                onPress={() => setPage((p) => p + 1)}
              >
                <Text
                  style={[
                    styles.pageBtnText,
                    !pagination.hasNextPage && styles.pageBtnTextDisabled,
                  ]}
                >
                  Next
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#15213D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1D3B7A',
    marginBottom: 20,
  },
  infoBannerText: {
    flex: 1,
    color: '#8AB4F8',
    fontSize: 13,
    lineHeight: 18,
  },
  filterCard: {
    backgroundColor: '#1A1C24',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262A38',
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C6175',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#25293A',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#246BFD',
  },
  filterChipText: {
    fontSize: 12,
    color: '#8A8D9F',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tableCard: {
    backgroundColor: '#1A1C24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262A38',
    overflow: 'hidden',
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
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E1E3EB',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8A8D9F',
    marginTop: 4,
    textAlign: 'center',
  },
  table: {
    minWidth: 900,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#151720',
    borderBottomWidth: 1,
    borderBottomColor: '#262A38',
  },
  colHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#202330',
  },
  typeTag: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  typeTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cellBold: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cellText: {
    fontSize: 13,
    color: '#D1D5DB',
  },
  cellSub: {
    fontSize: 11,
    color: '#8A8D9F',
    marginTop: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  paginationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#262A38',
    backgroundColor: '#151720',
  },
  paginationText: {
    fontSize: 12,
    color: '#8A8D9F',
  },
  pageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  pageBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#25293A',
    borderRadius: 6,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pageBtnTextDisabled: {
    color: '#8A8D9F',
  },
});
