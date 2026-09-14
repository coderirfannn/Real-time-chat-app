import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../../src/services/api/admin.api';
import { Icon } from '../../../src/components/ui/Icon';

export default function AdminUserDetailPage(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'SUSPEND' | 'UNSUSPEND' | 'BAN' | 'UNBAN';
    reason: string;
  }>({
    isOpen: false,
    type: 'SUSPEND',
    reason: '',
  });

  const {
    data: user,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-user-detail', id],
    queryFn: () => adminApi.getUser(id as string),
    enabled: Boolean(id),
  });

  const suspendMutation = useMutation({
    mutationFn: (reason?: string) => adminApi.suspendUser(id as string, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setModalState((prev) => ({ ...prev, isOpen: false }));
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: (reason?: string) => adminApi.unsuspendUser(id as string, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setModalState((prev) => ({ ...prev, isOpen: false }));
    },
  });

  const banMutation = useMutation({
    mutationFn: (reason?: string) => adminApi.banUser(id as string, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setModalState((prev) => ({ ...prev, isOpen: false }));
    },
  });

  const unbanMutation = useMutation({
    mutationFn: (reason?: string) => adminApi.unbanUser(id as string, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setModalState((prev) => ({ ...prev, isOpen: false }));
    },
  });

  const isMutating =
    suspendMutation.isPending ||
    unsuspendMutation.isPending ||
    banMutation.isPending ||
    unbanMutation.isPending;

  const handleConfirmAction = () => {
    const reason = modalState.reason.trim() || undefined;
    if (modalState.type === 'SUSPEND') suspendMutation.mutate(reason);
    if (modalState.type === 'UNSUSPEND') unsuspendMutation.mutate(reason);
    if (modalState.type === 'BAN') banMutation.mutate(reason);
    if (modalState.type === 'UNBAN') unbanMutation.mutate(reason);
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#246BFD" />
        <Text style={styles.loadingText}>Loading user profile details...</Text>
      </View>
    );
  }

  if (isError || !user) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="alert-circle" size={48} color="#FF4D4F" />
        <Text style={styles.errorTitle}>User Not Found</Text>
        <Text style={styles.errorSubtitle}>
          The requested user account does not exist or has been removed.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push('/admin/users' as never)}
        >
          <Icon name="arrow-left" size={16} color="#FFF" />
          <Text style={styles.backButtonText}>Back to Users</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header Bar */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backNavButton}
          onPress={() => router.push('/admin/users' as never)}
        >
          <Icon name="arrow-left" size={18} color="#8A8D9F" />
          <Text style={styles.backNavText}>All Users</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.refreshButton} onPress={() => refetch()}>
          <Icon name="check" size={16} color="#8A8D9F" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Main Profile Banner Card */}
      <View style={styles.card}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>
              {user.displayName?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{user.displayName}</Text>
              <View
                style={[
                  styles.rolePill,
                  user.role === 'ADMIN' ? styles.roleAdmin : styles.roleUser,
                ]}
              >
                <Text
                  style={[
                    styles.roleText,
                    user.role === 'ADMIN' ? { color: '#7B61FF' } : { color: '#246BFD' },
                  ]}
                >
                  {user.role}
                </Text>
              </View>
              <StatusBadge status={user.accountStatus} />
            </View>
            <Text style={styles.username}>@{user.username}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>
        </View>

        {user.bio ? (
          <View style={styles.bioContainer}>
            <Text style={styles.bioLabel}>BIO</Text>
            <Text style={styles.bioText}>{user.bio}</Text>
          </View>
        ) : null}

        {/* Metadata Details Grid */}
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>USER ID</Text>
            <Text style={styles.metaValueMono}>{user.id}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>REGISTERED</Text>
            <Text style={styles.metaValue}>{new Date(user.createdAt).toLocaleString()}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>LAST ACTIVE</Text>
            <Text style={styles.metaValue}>
              {user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString() : 'Never'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>PRESENCE</Text>
            <Text
              style={[
                styles.metaValue,
                user.status === 'online' ? { color: '#12D18E' } : { color: '#6C7080' },
              ]}
            >
              {user.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Moderation Action Buttons */}
        <View style={styles.actionRow}>
          {user.accountStatus === 'SUSPENDED' ? (
            <TouchableOpacity
              style={[styles.moderationBtn, styles.btnSuccess]}
              onPress={() => setModalState({ isOpen: true, type: 'UNSUSPEND', reason: '' })}
            >
              <Icon name="check" size={16} color="#FFF" />
              <Text style={styles.btnText}>Unsuspend Account</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.moderationBtn, styles.btnWarning]}
              onPress={() => setModalState({ isOpen: true, type: 'SUSPEND', reason: '' })}
            >
              <Icon name="alert-circle" size={16} color="#FFF" />
              <Text style={styles.btnText}>Suspend Account</Text>
            </TouchableOpacity>
          )}

          {user.accountStatus === 'BANNED' ? (
            <TouchableOpacity
              style={[styles.moderationBtn, styles.btnSuccess]}
              onPress={() => setModalState({ isOpen: true, type: 'UNBAN', reason: '' })}
            >
              <Icon name="check-check" size={16} color="#FFF" />
              <Text style={styles.btnText}>Unban Account</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.moderationBtn, styles.btnDanger]}
              onPress={() => setModalState({ isOpen: true, type: 'BAN', reason: '' })}
            >
              <Icon name="lock" size={16} color="#FFF" />
              <Text style={styles.btnText}>Ban Permanently</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Account Statistics Grid */}
      <Text style={styles.sectionTitle}>ACTIVITY & STATS</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statBoxLabel}>Conversations</Text>
          <Text style={styles.statBoxValue}>{user.stats.totalConversations}</Text>
          <Text style={styles.statBoxSub}>Active chat threads</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBoxLabel}>Messages Sent</Text>
          <Text style={styles.statBoxValue}>{user.stats.totalMessagesSent}</Text>
          <Text style={styles.statBoxSub}>Total text & media items</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBoxLabel}>Registered Devices</Text>
          <Text style={styles.statBoxValue}>{user.stats.activeDevices}</Text>
          <Text style={styles.statBoxSub}>Push token sessions</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBoxLabel}>Reports Filed Against</Text>
          <Text style={styles.statBoxValue}>{user.stats.reportCount ?? 0}</Text>
          <Text style={styles.statBoxSub}>Community flags</Text>
        </View>
      </View>

      {/* Moderation History & Audit Logs */}
      <Text style={styles.sectionTitle}>MODERATION HISTORY & AUDIT LOG</Text>
      <View style={styles.card}>
        {user.moderationHistory.length === 0 ? (
          <View style={styles.emptyLogs}>
            <Icon name="shield" size={32} color="#525666" />
            <Text style={styles.emptyLogsText}>
              No previous moderation actions taken on this account.
            </Text>
          </View>
        ) : (
          <View style={styles.historyList}>
            {user.moderationHistory.map((item) => (
              <View key={item.id} style={styles.historyItem}>
                <View style={styles.historyTop}>
                  <ActionBadge action={item.action} />
                  <Text style={styles.historyDate}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
                <Text style={styles.historyAdmin}>
                  Executed by admin{' '}
                  <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{item.adminUsername}</Text>
                </Text>
                {item.metadata?.['reason'] && (
                  <Text style={styles.historyReason}>
                    Reason: {String(item.metadata['reason'])}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Action Modal */}
      <Modal visible={modalState.isOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm {modalState.type}</Text>
            <Text style={styles.modalSubtitle}>
              Target: <Text style={{ color: '#FFF' }}>{user.displayName}</Text> (@{user.username})
            </Text>
            <Text style={styles.modalLabel}>Reason for Audit Log:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="State rationale..."
              placeholderTextColor="#6C7080"
              value={modalState.reason}
              onChangeText={(text) => setModalState((prev) => ({ ...prev, reason: text }))}
              multiline
            />
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                disabled={isMutating}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirm,
                  modalState.type.includes('BAN')
                    ? { backgroundColor: '#FF4D4F' }
                    : modalState.type.includes('SUSPEND')
                      ? { backgroundColor: '#EAB308' }
                      : { backgroundColor: '#12D18E' },
                ]}
                onPress={handleConfirmAction}
                disabled={isMutating}
              >
                {isMutating ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm {modalState.type}</Text>
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
    <View style={[styles.actionBadgePill, { backgroundColor: bgColor }]}>
      <Text style={[styles.actionBadgeText, { color: textColor }]}>{action}</Text>
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
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#121418',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#8A8D9F',
    marginTop: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 16,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#8A8D9F',
    marginTop: 4,
    marginBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#246BFD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backNavText: {
    color: '#8A8D9F',
    fontSize: 14,
    fontWeight: '500',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A1D24',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#8A8D9F',
    fontSize: 12,
  },
  card: {
    backgroundColor: '#1A1D24',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 24,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#246BFD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextLarge: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  username: {
    fontSize: 14,
    color: '#6C7080',
    marginTop: 2,
  },
  email: {
    fontSize: 14,
    color: '#8A8D9F',
    marginTop: 2,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
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
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  bioContainer: {
    backgroundColor: '#121418',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  bioLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6C7080',
    marginBottom: 4,
  },
  bioText: {
    color: '#C0C4D6',
    fontSize: 13,
    lineHeight: 18,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 20,
  },
  metaItem: {
    flex: 1,
    minWidth: 180,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6C7080',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  metaValueMono: {
    fontSize: 12,
    color: '#A0A4B8',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  moderationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnSuccess: {
    backgroundColor: '#12D18E',
  },
  btnWarning: {
    backgroundColor: '#EAB308',
  },
  btnDanger: {
    backgroundColor: '#FF4D4F',
  },
  btnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C7080',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#1A1D24',
    borderRadius: 12,
    padding: 16,
    margin: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statBoxLabel: {
    fontSize: 12,
    color: '#8A8D9F',
    fontWeight: '500',
  },
  statBoxValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginVertical: 4,
  },
  statBoxSub: {
    fontSize: 11,
    color: '#6C7080',
  },
  emptyLogs: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyLogsText: {
    color: '#6C7080',
    fontSize: 13,
  },
  historyList: {
    gap: 12,
  },
  historyItem: {
    backgroundColor: '#14161B',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    gap: 6,
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  historyDate: {
    color: '#6C7080',
    fontSize: 12,
  },
  historyAdmin: {
    color: '#8A8D9F',
    fontSize: 13,
  },
  historyReason: {
    color: '#C0C4D6',
    fontSize: 12,
    fontStyle: 'italic',
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
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#8A8D9F',
  },
  modalLabel: {
    fontSize: 12,
    color: '#8A8D9F',
    fontWeight: '600',
    marginTop: 6,
  },
  modalInput: {
    backgroundColor: '#121418',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    height: 70,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#8A8D9F',
    fontWeight: '600',
    fontSize: 13,
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
