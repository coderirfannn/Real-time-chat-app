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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../src/services/api/admin.api';
import { Icon } from '../../src/components/ui/Icon';
import type { AdminReportItem, AdminAuditLogItem } from '@chatlock/shared-types';

export default function AdminReportsPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('ALL');

  // Inspection & Resolution Drawer Modal State
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [resolutionAction, setResolutionAction] = useState<'DISMISS' | 'WARN' | 'SUSPEND' | 'BAN'>(
    'DISMISS',
  );
  const [adminNotes, setAdminNotes] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch Reports List Query
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-reports', page, statusFilter, targetTypeFilter],
    queryFn: () =>
      adminApi.getReports({
        page,
        limit: 20,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        targetType: targetTypeFilter === 'ALL' ? undefined : targetTypeFilter,
      }),
  });

  // 2. Fetch Selected Report Detail Query
  const {
    data: reportDetailData,
    isLoading: isDetailLoading,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ['admin-report-detail', selectedReportId],
    queryFn: () => (selectedReportId ? adminApi.getReportDetail(selectedReportId) : null),
    enabled: Boolean(selectedReportId),
  });

  // 3. Resolve Mutation
  const resolveMutation = useMutation({
    mutationFn: (vars: {
      reportId: string;
      action: 'DISMISS' | 'WARN' | 'SUSPEND' | 'BAN';
      notes?: string;
      warningMessage?: string;
    }) =>
      adminApi.resolveReport(vars.reportId, {
        action: vars.action,
        notes: vars.notes,
        adminNotes: vars.notes,
        warningMessage: vars.warningMessage,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setSelectedReportId(null);
      setAdminNotes('');
      setWarningMessage('');
      setActionError(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to execute moderation action';
      setActionError(msg);
    },
  });

  const statuses = ['ALL', 'OPEN', 'UNDER_REVIEW', 'WARNED', 'SUSPENDED', 'BANNED', 'DISMISSED'];
  const targetTypes = ['ALL', 'USER', 'MESSAGE', 'CONVERSATION'];
  const reports = data?.reports || [];
  const pagination = data?.pagination;

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'OPEN':
      case 'PENDING':
        return { bg: '#3D2F14', text: '#FFC53D', border: '#7A5B1E' };
      case 'UNDER_REVIEW':
        return { bg: '#1D2A44', text: '#60A5FA', border: '#246BFD' };
      case 'WARNED':
        return { bg: '#3D1D1D', text: '#F59E0B', border: '#B45309' };
      case 'SUSPENDED':
        return { bg: '#4A1D24', text: '#F87171', border: '#DC2626' };
      case 'BANNED':
        return { bg: '#3B0D11', text: '#EF4444', border: '#991B1B' };
      case 'DISMISSED':
      case 'RESOLVED':
        return { bg: '#133827', text: '#52C41A', border: '#237804' };
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

  const handleOpenDetail = (rep: AdminReportItem) => {
    setSelectedReportId(rep.id);
    setResolutionAction('DISMISS');
    setAdminNotes('');
    setWarningMessage('');
    setActionError(null);
  };

  const handleExecuteResolution = () => {
    if (!selectedReportId) return;
    resolveMutation.mutate({
      reportId: selectedReportId,
      action: resolutionAction,
      notes: adminNotes.trim() || undefined,
      warningMessage: resolutionAction === 'WARN' ? warningMessage.trim() || undefined : undefined,
    });
  };

  const activeReport = reportDetailData?.report;
  const targetHistory: AdminAuditLogItem[] = reportDetailData?.targetUserModerationHistory || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Reports & Abuse Moderation</Text>
          <Text style={styles.pageSubtitle}>
            Review reported users, messages, and conversations with immediate account enforcement.
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => refetch()}>
          <Icon name="check" size={16} color="#8A8D9F" />
          <Text style={styles.refreshButtonText}>Refresh Queue</Text>
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="shield" size={20} color="#246BFD" />
        <Text style={styles.infoBannerText}>
          E2EE Privacy & Safe Moderation: Private message plaintext is never accessible to the
          server. Reports rely strictly on safe metadata, user descriptions, and reported accounts.
        </Text>
      </View>

      {/* Filter Cards */}
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

        <Text style={[styles.filterLabel, { marginTop: 12 }]}>FILTER BY TARGET TYPE:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {targetTypes.map((tt) => (
            <TouchableOpacity
              key={tt}
              style={[styles.filterChip, targetTypeFilter === tt && styles.filterChipActive]}
              onPress={() => {
                setTargetTypeFilter(tt);
                setPage(1);
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  targetTypeFilter === tt && styles.filterChipTextActive,
                ]}
              >
                {tt}
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
                ? 'There are currently no reported incidents matching your query.'
                : `No reports found matching status "${statusFilter}".`}
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.colHeader, { width: 130 }]}>TARGET TYPE</Text>
                <Text style={[styles.colHeader, { width: 180 }]}>REPORTED USER</Text>
                <Text style={[styles.colHeader, { width: 160 }]}>REPORTER</Text>
                <Text style={[styles.colHeader, { width: 200 }]}>REASON</Text>
                <Text style={[styles.colHeader, { width: 130 }]}>STATUS</Text>
                <Text style={[styles.colHeader, { width: 150 }]}>FILED AT</Text>
                <Text style={[styles.colHeader, { width: 140 }]}>ACTION</Text>
              </View>

              {reports.map((rep) => {
                const sBadge = getStatusBadgeStyle(rep.status);
                const tBadge = getTargetTypeBadge(rep.targetType);
                return (
                  <View key={rep.id} style={styles.tableRow}>
                    <View style={[{ width: 130 }]}>
                      <View style={[styles.typeTag, { backgroundColor: tBadge.bg }]}>
                        <Text style={[styles.typeTagText, { color: tBadge.text }]}>
                          {rep.targetType}
                        </Text>
                      </View>
                    </View>

                    <View style={[{ width: 180 }]}>
                      <Text style={styles.cellBold} numberOfLines={1}>
                        {rep.reportedUsername
                          ? `@${rep.reportedUsername}`
                          : rep.reportedDisplayName || rep.reportedUserId}
                      </Text>
                      <Text style={styles.cellSub} numberOfLines={1}>
                        ID: {rep.reportedUserId.substring(0, 10)}...
                      </Text>
                    </View>

                    <View style={[{ width: 160 }]}>
                      <Text style={styles.cellText} numberOfLines={1}>
                        {rep.reporterUsername
                          ? `@${rep.reporterUsername}`
                          : rep.reporterDisplayName || rep.reporterId}
                      </Text>
                    </View>

                    <View style={[{ width: 200 }]}>
                      <Text style={styles.cellText} numberOfLines={1}>
                        {rep.reason}
                      </Text>
                      {rep.description ? (
                        <Text style={styles.cellSub} numberOfLines={1}>
                          {rep.description}
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

                    <View style={[{ width: 150 }]}>
                      <Text style={styles.cellSub}>
                        {new Date(rep.createdAt).toLocaleDateString()}
                      </Text>
                    </View>

                    <View style={[{ width: 140 }]}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleOpenDetail(rep)}
                        activeOpacity={0.7}
                      >
                        <Icon name="eye" size={14} color="#246BFD" />
                        <Text style={styles.actionButtonText}>Inspect</Text>
                      </TouchableOpacity>
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

      {/* Report Inspection & Moderation Drawer Modal */}
      {selectedReportId && (
        <Modal
          visible={Boolean(selectedReportId)}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedReportId(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.detailCard}>
              {isDetailLoading || !activeReport ? (
                <View style={styles.detailLoadingContainer}>
                  <ActivityIndicator size="large" color="#246BFD" />
                  <Text style={styles.loadingText}>
                    Loading report details and audit history...
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={true}>
                  {/* Modal Header */}
                  <View style={styles.detailHeader}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.detailTitle}>
                          Report #{activeReport.id.substring(0, 8)}
                        </Text>
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor: getStatusBadgeStyle(activeReport.status).bg,
                              borderColor: getStatusBadgeStyle(activeReport.status).border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              { color: getStatusBadgeStyle(activeReport.status).text },
                            ]}
                          >
                            {activeReport.status}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.detailSub}>
                        Filed on {new Date(activeReport.createdAt).toLocaleString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.closeBtn}
                      onPress={() => setSelectedReportId(null)}
                      activeOpacity={0.7}
                    >
                      <Icon name="x" size={20} color="#8A8D9F" />
                    </TouchableOpacity>
                  </View>

                  {actionError ? (
                    <View style={styles.errorAlert}>
                      <Icon name="alert-circle" size={16} color="#FF4D4F" />
                      <Text style={styles.errorAlertText}>{actionError}</Text>
                    </View>
                  ) : null}

                  {/* Overview Grid */}
                  <View style={styles.gridRow}>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>TARGET TYPE</Text>
                      <Text style={styles.gridValue}>{activeReport.targetType}</Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>VIOLATION REASON</Text>
                      <Text style={[styles.gridValue, { color: '#FFC53D' }]}>
                        {activeReport.reason}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.gridRow}>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>REPORTED USER</Text>
                      <Text style={styles.gridValue}>
                        {activeReport.reportedUsername
                          ? `@${activeReport.reportedUsername}`
                          : activeReport.reportedDisplayName || activeReport.reportedUserId}
                      </Text>
                      <Text style={styles.cellSub}>ID: {activeReport.reportedUserId}</Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>REPORTER (CONFIDENTIAL)</Text>
                      <Text style={styles.gridValue}>
                        {activeReport.reporterUsername
                          ? `@${activeReport.reporterUsername}`
                          : activeReport.reporterDisplayName || activeReport.reporterId}
                      </Text>
                      <Text style={styles.cellSub}>ID: {activeReport.reporterId}</Text>
                    </View>
                  </View>

                  {/* Report Description / Details */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionLabel}>SUBMITTED DETAILS</Text>
                    <View style={styles.descBox}>
                      <Text style={styles.descText}>
                        {activeReport.description ||
                          activeReport.details ||
                          'No additional details provided by the reporter.'}
                      </Text>
                    </View>
                  </View>

                  {/* Previous Moderation History */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionLabel}>
                      REPORTED USER MODERATION HISTORY ({targetHistory.length} EVENTS)
                    </Text>
                    {targetHistory.length === 0 ? (
                      <Text style={styles.emptyHistoryText}>
                        No prior moderation actions recorded for this user.
                      </Text>
                    ) : (
                      <View style={styles.historyList}>
                        {targetHistory.map((h) => (
                          <View key={h.id} style={styles.historyItem}>
                            <View style={styles.historyDot} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.historyAction}>{h.action}</Text>
                              <Text style={styles.historySub}>
                                by {h.adminUsername} • {new Date(h.createdAt).toLocaleString()}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Resolution Controls */}
                  <View style={styles.moderationSection}>
                    <Text style={styles.detailSectionLabel}>MODERATION ACTION</Text>
                    <View style={styles.actionButtonGroup}>
                      {[
                        {
                          key: 'DISMISS',
                          label: 'Dismiss Report',
                          icon: 'shield',
                          color: '#8A8D9F',
                        },
                        {
                          key: 'WARN',
                          label: 'Issue Warning',
                          icon: 'alert-triangle',
                          color: '#FFC53D',
                        },
                        {
                          key: 'SUSPEND',
                          label: 'Suspend Account',
                          icon: 'user-x',
                          color: '#FF7875',
                        },
                        { key: 'BAN', label: 'Permanent Ban', icon: 'slash', color: '#FF4D4F' },
                      ].map((btn) => {
                        const isSelected = resolutionAction === btn.key;
                        return (
                          <TouchableOpacity
                            key={btn.key}
                            style={[
                              styles.resolutionChoice,
                              isSelected && {
                                borderColor: btn.color,
                                backgroundColor: 'rgba(255,255,255,0.06)',
                              },
                            ]}
                            onPress={() => setResolutionAction(btn.key as any)}
                            activeOpacity={0.7}
                          >
                            <Icon name={btn.icon as any} size={16} color={btn.color} />
                            <Text
                              style={[
                                styles.resolutionChoiceText,
                                isSelected && { color: btn.color, fontWeight: '700' },
                              ]}
                            >
                              {btn.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {resolutionAction === 'WARN' && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={styles.inputLabel}>
                          Warning Message (Delivered to Reported User)
                        </Text>
                        <TextInput
                          style={styles.textInput}
                          placeholder="Optional custom warning message (leave blank for standard community guideline notice)"
                          placeholderTextColor="#555B70"
                          value={warningMessage}
                          onChangeText={setWarningMessage}
                        />
                      </View>
                    )}

                    <View style={{ marginTop: 12 }}>
                      <Text style={styles.inputLabel}>Admin Internal Audit Notes</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Add internal notes explaining reasoning for audit log..."
                        placeholderTextColor="#555B70"
                        value={adminNotes}
                        onChangeText={setAdminNotes}
                      />
                    </View>

                    {/* Action Execution Button */}
                    <TouchableOpacity
                      style={[
                        styles.executeButton,
                        resolutionAction === 'BAN' && { backgroundColor: '#FF4D4F' },
                        resolutionAction === 'SUSPEND' && { backgroundColor: '#D9363E' },
                        resolveMutation.isPending && { opacity: 0.6 },
                      ]}
                      onPress={handleExecuteResolution}
                      disabled={resolveMutation.isPending}
                      activeOpacity={0.8}
                    >
                      {resolveMutation.isPending ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Icon name="check" size={16} color="#FFFFFF" />
                          <Text style={styles.executeButtonText}>
                            Confirm {resolutionAction} Action
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  contentContainer: {
    padding: 24,
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  pageTitle: {
    fontSize: 24,
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
    backgroundColor: '#141721',
    borderWidth: 1,
    borderColor: '#25293A',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8A8D9F',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#141721',
    borderLeftWidth: 4,
    borderLeftColor: '#246BFD',
    padding: 14,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#25293A',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#8A8D9F',
    lineHeight: 18,
  },
  filterCard: {
    backgroundColor: '#141721',
    borderWidth: 1,
    borderColor: '#25293A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A8D9F',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#1C2030',
    borderWidth: 1,
    borderColor: '#25293A',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#246BFD',
    borderColor: '#246BFD',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8D9F',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  tableCard: {
    backgroundColor: '#141721',
    borderWidth: 1,
    borderColor: '#25293A',
    borderRadius: 12,
    overflow: 'hidden',
  },
  centerContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#8A8D9F',
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#FF4D4F',
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#246BFD',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8A8D9F',
    marginTop: 4,
    textAlign: 'center',
  },
  table: {
    minWidth: 1100,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0F121C',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#25293A',
  },
  colHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A8D9F',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1C2030',
  },
  cellBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cellText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  cellSub: {
    fontSize: 11,
    color: '#8A8D9F',
    marginTop: 2,
  },
  typeTag: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  typeTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(36, 107, 253, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(36, 107, 253, 0.3)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#246BFD',
  },
  paginationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#25293A',
    flexWrap: 'wrap',
    gap: 12,
  },
  paginationText: {
    fontSize: 13,
    color: '#8A8D9F',
  },
  pageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  pageBtn: {
    backgroundColor: '#1C2030',
    borderWidth: 1,
    borderColor: '#25293A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8D9F',
  },
  pageBtnTextDisabled: {
    color: '#555B70',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailCard: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '90%',
    backgroundColor: '#141721',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#25293A',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
      },
    }),
  },
  detailLoadingContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScroll: {
    padding: 24,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  detailSub: {
    fontSize: 12,
    color: '#8A8D9F',
    marginTop: 4,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#1C2030',
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 77, 79, 0.1)',
    borderWidth: 1,
    borderColor: '#FF4D4F',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorAlertText: {
    fontSize: 13,
    color: '#FF4D4F',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
  },
  gridItem: {
    flex: 1,
    backgroundColor: '#1C2030',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#25293A',
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A8D9F',
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  detailSection: {
    marginTop: 16,
  },
  detailSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A8D9F',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  descBox: {
    backgroundColor: '#1C2030',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#25293A',
  },
  descText: {
    fontSize: 13,
    color: '#D1D5DB',
    lineHeight: 18,
  },
  emptyHistoryText: {
    fontSize: 13,
    color: '#555B70',
    fontStyle: 'italic',
  },
  historyList: {
    gap: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1C2030',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#25293A',
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FAAD14',
  },
  historyAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  historySub: {
    fontSize: 11,
    color: '#8A8D9F',
    marginTop: 2,
  },
  moderationSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#25293A',
  },
  actionButtonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  resolutionChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#25293A',
    backgroundColor: '#1C2030',
  },
  resolutionChoiceText: {
    fontSize: 12,
    color: '#8A8D9F',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D1D5DB',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#1C2030',
    borderWidth: 1,
    borderColor: '#25293A',
    borderRadius: 8,
    color: '#FFFFFF',
    padding: 10,
    fontSize: 13,
  },
  executeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#246BFD',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  executeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
