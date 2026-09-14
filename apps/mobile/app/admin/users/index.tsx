import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../../src/services/api/admin.api';
import { Icon } from '../../../src/components/ui/Icon';
import type { AdminUserListItem } from '@chatlock/shared-types';

export default function AdminUsersPage(): React.JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'USER' | 'ADMIN'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'BANNED'>(
    'ALL',
  );

  // Moderation action modal state
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    type: 'SUSPEND' | 'UNSUSPEND' | 'BAN' | 'UNBAN';
    user: AdminUserListItem | null;
    reason: string;
  }>({
    isOpen: false,
    type: 'SUSPEND',
    user: null,
    reason: '',
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users', page, searchQuery, roleFilter, statusFilter],
    queryFn: () =>
      adminApi.getUsers({
        page,
        limit: 15,
        q: searchQuery,
        role: roleFilter === 'ALL' ? undefined : roleFilter,
        accountStatus: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      adminApi.suspendUser(userId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      closeModal();
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      adminApi.unsuspendUser(userId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      closeModal();
    },
  });

  const banMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      adminApi.banUser(userId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      closeModal();
    },
  });

  const unbanMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      adminApi.unbanUser(userId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      closeModal();
    },
  });

  const openActionModal = (
    type: 'SUSPEND' | 'UNSUSPEND' | 'BAN' | 'UNBAN',
    user: AdminUserListItem,
  ) => {
    setActionModal({
      isOpen: true,
      type,
      user,
      reason: '',
    });
  };

  const closeModal = () => {
    setActionModal({
      isOpen: false,
      type: 'SUSPEND',
      user: null,
      reason: '',
    });
  };

  const handleConfirmAction = () => {
    if (!actionModal.user) return;
    const userId = actionModal.user.id;
    const reason = actionModal.reason.trim() || undefined;

    switch (actionModal.type) {
      case 'SUSPEND':
        suspendMutation.mutate({ userId, reason });
        break;
      case 'UNSUSPEND':
        unsuspendMutation.mutate({ userId, reason });
        break;
      case 'BAN':
        banMutation.mutate({ userId, reason });
        break;
      case 'UNBAN':
        unbanMutation.mutate({ userId, reason });
        break;
    }
  };

  const isMutating =
    suspendMutation.isPending ||
    unsuspendMutation.isPending ||
    banMutation.isPending ||
    unbanMutation.isPending;

  const users = data?.users || [];
  const pagination = data?.pagination;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header Banner */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>User Management</Text>
          <Text style={styles.pageSubtitle}>
            Inspect user profiles, manage roles, and execute administrative moderation.
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => refetch()}>
          <Icon name="check" size={16} color="#8A8D9F" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Filter & Search Bar */}
      <View style={styles.filterCard}>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color="#6C7080" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username, display name, or email..."
            placeholderTextColor="#6C7080"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setPage(1);
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close" size={16} color="#6C7080" />
            </TouchableOpacity>
          )}
        </View>

        {/* Role Filters */}
        <View style={styles.filterButtonGroup}>
          <Text style={styles.filterLabel}>ROLE:</Text>
          {(['ALL', 'USER', 'ADMIN'] as const).map((role) => (
            <TouchableOpacity
              key={role}
              style={[styles.filterChip, roleFilter === role && styles.filterChipActive]}
              onPress={() => {
                setRoleFilter(role);
                setPage(1);
              }}
            >
              <Text
                style={[styles.filterChipText, roleFilter === role && styles.filterChipTextActive]}
              >
                {role}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Status Filters */}
        <View style={styles.filterButtonGroup}>
          <Text style={styles.filterLabel}>STATUS:</Text>
          {(['ALL', 'ACTIVE', 'SUSPENDED', 'BANNED'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
              onPress={() => {
                setStatusFilter(status);
                setPage(1);
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === status && styles.filterChipTextActive,
                ]}
              >
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Data Table */}
      <View style={styles.tableCard}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#246BFD" />
            <Text style={styles.loadingText}>Loading user records...</Text>
          </View>
        ) : isError ? (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={36} color="#FF4D4F" />
            <Text style={styles.errorText}>Failed to load user directory.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="user" size={40} color="#525666" />
            <Text style={styles.emptyTitle}>No users found</Text>
            <Text style={styles.emptySubtitle}>Try changing your search query or filters.</Text>
          </View>
        ) : (
          <View style={styles.tableWrapper}>
            {/* Table Header Row */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.columnHeader, { flex: 2 }]}>USER</Text>
              <Text style={[styles.columnHeader, { flex: 2 }]}>EMAIL</Text>
              <Text style={[styles.columnHeader, { width: 90 }]}>ROLE</Text>
              <Text style={[styles.columnHeader, { width: 110 }]}>STATUS</Text>
              <Text style={[styles.columnHeader, { width: 110 }]}>JOINED</Text>
              <Text style={[styles.columnHeader, { width: 140, textAlign: 'right' }]}>ACTIONS</Text>
            </View>

            {/* User Rows */}
            {users.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                {/* User column */}
                <View
                  style={[
                    styles.cell,
                    { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 },
                  ]}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.displayName?.charAt(0).toUpperCase() || 'U'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.displayNameText} numberOfLines={1}>
                      {item.displayName}
                    </Text>
                    <Text style={styles.usernameText} numberOfLines={1}>
                      @{item.username}
                    </Text>
                  </View>
                </View>

                {/* Email column */}
                <View style={[styles.cell, { flex: 2 }]}>
                  <Text style={styles.emailText} numberOfLines={1}>
                    {item.email}
                  </Text>
                </View>

                {/* Role column */}
                <View style={[styles.cell, { width: 90 }]}>
                  <View
                    style={[
                      styles.rolePill,
                      item.role === 'ADMIN' ? styles.roleAdmin : styles.roleUser,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        item.role === 'ADMIN' ? { color: '#7B61FF' } : { color: '#246BFD' },
                      ]}
                    >
                      {item.role}
                    </Text>
                  </View>
                </View>

                {/* Status column */}
                <View style={[styles.cell, { width: 110 }]}>
                  <StatusBadge status={item.accountStatus} />
                </View>

                {/* Joined date column */}
                <View style={[styles.cell, { width: 110 }]}>
                  <Text style={styles.dateText}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>

                {/* Actions column */}
                <View
                  style={[
                    styles.cell,
                    { width: 140, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
                  ]}
                >
                  {/* View Details button */}
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => router.push(`/admin/users/${item.id}` as never)}
                    accessibilityLabel="Inspect user"
                  >
                    <Icon name="eye" size={14} color="#8A8D9F" />
                  </TouchableOpacity>

                  {/* Suspend / Unsuspend */}
                  {item.accountStatus === 'SUSPENDED' ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnSuccess]}
                      onPress={() => openActionModal('UNSUSPEND', item)}
                      accessibilityLabel="Unsuspend user"
                    >
                      <Icon name="check" size={14} color="#12D18E" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnWarning]}
                      onPress={() => openActionModal('SUSPEND', item)}
                      accessibilityLabel="Suspend user"
                    >
                      <Icon name="alert-circle" size={14} color="#FACC15" />
                    </TouchableOpacity>
                  )}

                  {/* Ban / Unban */}
                  {item.accountStatus === 'BANNED' ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnSuccess]}
                      onPress={() => openActionModal('UNBAN', item)}
                      accessibilityLabel="Unban user"
                    >
                      <Icon name="check-check" size={14} color="#12D18E" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnDanger]}
                      onPress={() => openActionModal('BAN', item)}
                      accessibilityLabel="Ban user"
                    >
                      <Icon name="lock" size={14} color="#FF4D4F" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Pagination Controls */}
        {pagination && pagination.totalPages > 1 && (
          <View style={styles.paginationRow}>
            <Text style={styles.paginationInfo}>
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total
              users)
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

      {/* Moderation Confirmation Modal */}
      <Modal visible={actionModal.isOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View
                style={[
                  styles.modalIconBadge,
                  actionModal.type.includes('BAN')
                    ? { backgroundColor: 'rgba(255, 77, 79, 0.15)' }
                    : { backgroundColor: 'rgba(250, 204, 21, 0.15)' },
                ]}
              >
                <Icon
                  name={actionModal.type.includes('BAN') ? 'lock' : 'alert-circle'}
                  size={24}
                  color={actionModal.type.includes('BAN') ? '#FF4D4F' : '#FACC15'}
                />
              </View>
              <Text style={styles.modalTitle}>Confirm {actionModal.type} Action</Text>
              <Text style={styles.modalSubtitle}>
                Target User:{' '}
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
                  {actionModal.user?.displayName}
                </Text>{' '}
                (@{actionModal.user?.username})
              </Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.reasonLabel}>Administrative Reason (Optional):</Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="State the reason for audit logs..."
                placeholderTextColor="#6C7080"
                value={actionModal.reason}
                onChangeText={(text) => setActionModal((prev) => ({ ...prev, reason: text }))}
                multiline
                numberOfLines={3}
              />

              {actionModal.type === 'BAN' && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    Warning: Banning immediately terminates active sessions and blocks all
                    authentication permanently.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={closeModal}
                disabled={isMutating}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  actionModal.type.includes('BAN')
                    ? { backgroundColor: '#FF4D4F' }
                    : actionModal.type.includes('SUSPEND')
                      ? { backgroundColor: '#EAB308' }
                      : { backgroundColor: '#12D18E' },
                ]}
                onPress={handleConfirmAction}
                disabled={isMutating}
              >
                {isMutating ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm {actionModal.type}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function StatusBadge({ status }: { status: string }) {
  let bgColor = 'rgba(18, 209, 142, 0.12)';
  let textColor = '#12D18E';

  if (status === 'SUSPENDED') {
    bgColor = 'rgba(250, 204, 21, 0.12)';
    textColor = '#FACC15';
  } else if (status === 'BANNED') {
    bgColor = 'rgba(255, 77, 79, 0.12)';
    textColor = '#FF4D4F';
  }

  return (
    <View style={[styles.statusPill, { backgroundColor: bgColor }]}>
      <Text style={[styles.statusPillText, { color: textColor }]}>{status}</Text>
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
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121418',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
  },
  filterButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6C7080',
    letterSpacing: 0.5,
    marginRight: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
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
    minWidth: 700,
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
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#246BFD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  displayNameText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  usernameText: {
    color: '#6C7080',
    fontSize: 11,
  },
  emailText: {
    color: '#8A8D9F',
    fontSize: 13,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  roleUser: {
    backgroundColor: 'rgba(36, 107, 253, 0.12)',
  },
  roleAdmin: {
    backgroundColor: 'rgba(123, 97, 255, 0.15)',
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dateText: {
    color: '#6C7080',
    fontSize: 12,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnSuccess: {
    backgroundColor: 'rgba(18, 209, 142, 0.12)',
  },
  actionBtnWarning: {
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
  },
  actionBtnDanger: {
    backgroundColor: 'rgba(255, 77, 79, 0.12)',
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#8A8D9F',
    fontSize: 13,
  },
  errorContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 10,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 16,
    padding: 24,
    maxWidth: 440,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#8A8D9F',
  },
  modalBody: {
    marginBottom: 20,
    gap: 8,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8D9F',
  },
  reasonInput: {
    backgroundColor: '#121418',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    textAlignVertical: 'top',
    height: 70,
  },
  warningBox: {
    backgroundColor: 'rgba(255, 77, 79, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  warningText: {
    color: '#FF4D4F',
    fontSize: 11,
    lineHeight: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#8A8D9F',
    fontSize: 13,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
