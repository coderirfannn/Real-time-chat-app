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

export default function AdminGroupsPage(): React.JSX.Element {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-groups', page],
    queryFn: () =>
      adminApi.getGroups({
        page,
        limit: 20,
      }),
  });

  const groups = data?.groups || [];
  const pagination = data?.pagination;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Group Chats Moderation</Text>
          <Text style={styles.pageSubtitle}>
            Overview and oversight of group messaging rooms across the platform.
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => refetch()}>
          <Icon name="check" size={16} color="#8A8D9F" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="chat" size={20} color="#246BFD" />
        <Text style={styles.infoBannerText}>
          Group administration foundation is active (Task 34). Group conversation channels and
          participant membership metrics are populated here.
        </Text>
      </View>

      {/* Groups Table Card */}
      <View style={styles.tableCard}>
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#246BFD" />
            <Text style={styles.loadingText}>Fetching group channels...</Text>
          </View>
        ) : isError ? (
          <View style={styles.centerContainer}>
            <Icon name="alert-circle" size={36} color="#FF4D4F" />
            <Text style={styles.errorText}>Failed to load group conversations.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.centerContainer}>
            <Icon name="chat" size={44} color="#3E445B" />
            <Text style={styles.emptyTitle}>No group channels found</Text>
            <Text style={styles.emptySubtitle}>
              There are currently no multi-user group conversations created in the system.
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.colHeader, { width: 220 }]}>GROUP NAME / ID</Text>
                <Text style={[styles.colHeader, { width: 140 }]}>PARTICIPANTS</Text>
                <Text style={[styles.colHeader, { width: 120 }]}>ADMINS</Text>
                <Text style={[styles.colHeader, { width: 130 }]}>STATUS</Text>
                <Text style={[styles.colHeader, { width: 180 }]}>LAST ACTIVITY</Text>
                <Text style={[styles.colHeader, { width: 160 }]}>CREATED AT</Text>
              </View>

              {groups.map((grp) => (
                <View key={grp.id} style={styles.tableRow}>
                  <View style={[{ width: 220 }]}>
                    <Text style={styles.cellBold} numberOfLines={1}>
                      {grp.title || 'Untitled Group'}
                    </Text>
                    <Text style={styles.cellSub} numberOfLines={1}>
                      ID: {grp.id.substring(0, 12)}...
                    </Text>
                  </View>

                  <View style={[{ width: 140 }]}>
                    <View style={styles.badgeCount}>
                      <Text style={styles.badgeCountText}>{grp.participantsCount} members</Text>
                    </View>
                  </View>

                  <View style={[{ width: 120 }]}>
                    <Text style={styles.cellText}>{grp.adminsCount} admin(s)</Text>
                  </View>

                  <View style={[{ width: 130 }]}>
                    <View
                      style={[
                        styles.statusTag,
                        {
                          backgroundColor: grp.isArchived ? '#25293A' : '#133827',
                          borderColor: grp.isArchived ? '#3E445B' : '#237804',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusTagText,
                          { color: grp.isArchived ? '#8A8D9F' : '#52C41A' },
                        ]}
                      >
                        {grp.isArchived ? 'ARCHIVED' : 'ACTIVE'}
                      </Text>
                    </View>
                  </View>

                  <View style={[{ width: 180 }]}>
                    <Text style={styles.cellSub}>
                      {grp.lastMessageAt
                        ? new Date(grp.lastMessageAt).toLocaleString()
                        : 'No messages yet'}
                    </Text>
                  </View>

                  <View style={[{ width: 160 }]}>
                    <Text style={styles.cellSub}>
                      {new Date(grp.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Pagination Bar */}
        {pagination && pagination.totalPages > 1 && (
          <View style={styles.paginationBar}>
            <Text style={styles.paginationText}>
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} groups)
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
  badgeCount: {
    alignSelf: 'flex-start',
    backgroundColor: '#1D2A44',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeCountText: {
    color: '#246BFD',
    fontSize: 11,
    fontWeight: '700',
  },
  statusTag: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusTagText: {
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
