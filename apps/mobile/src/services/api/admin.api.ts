import { apiClient } from './client';
import type {
  AdminDashboardData,
  AdminUserListItem,
  AdminUserDetail,
  AdminAuditLogItem,
  AdminReportItem,
  AdminGroupItem,
  AdminMediaItem,
  AdminSettingsData,
} from '@chatlock/shared-types';

export interface AdminUserListResponse {
  users: AdminUserListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface AdminAuditLogResponse {
  logs: AdminAuditLogItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface AdminReportsResponse {
  reports: AdminReportItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface AdminGroupsResponse {
  groups: AdminGroupItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface AdminMediaResponse {
  media: AdminMediaItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export class AdminApi {
  /**
   * Retrieves live platform dashboard metrics.
   */
  public async getDashboard(): Promise<AdminDashboardData> {
    return apiClient.get<AdminDashboardData>('/admin/dashboard');
  }

  /**
   * Lists paginated users with optional search and filters.
   */
  public async getUsers(
    params: {
      page?: number;
      limit?: number;
      q?: string;
      role?: string;
      accountStatus?: string;
    } = {},
  ): Promise<AdminUserListResponse> {
    const queryParams: Record<string, string | number | undefined> = {
      page: params.page || 1,
      limit: params.limit || 20,
    };
    if (params.q?.trim()) queryParams['q'] = params.q.trim();
    if (params.role) queryParams['role'] = params.role;
    if (params.accountStatus) queryParams['accountStatus'] = params.accountStatus;

    return apiClient.get<AdminUserListResponse>('/admin/users', { params: queryParams });
  }

  /**
   * Retrieves single user detail including moderation history.
   */
  public async getUser(userId: string): Promise<AdminUserDetail> {
    return apiClient.get<AdminUserDetail>(`/admin/users/${userId}`);
  }

  /**
   * Suspends a user account.
   */
  public async suspendUser(userId: string, reason?: string): Promise<AdminUserListItem> {
    return apiClient.patch<AdminUserListItem>(`/admin/users/${userId}/suspend`, { reason });
  }

  /**
   * Unsuspends a user account.
   */
  public async unsuspendUser(userId: string, reason?: string): Promise<AdminUserListItem> {
    return apiClient.patch<AdminUserListItem>(`/admin/users/${userId}/unsuspend`, { reason });
  }

  /**
   * Bans a user account permanently.
   */
  public async banUser(userId: string, reason?: string): Promise<AdminUserListItem> {
    return apiClient.patch<AdminUserListItem>(`/admin/users/${userId}/ban`, { reason });
  }

  /**
   * Unbans a user account.
   */
  public async unbanUser(userId: string, reason?: string): Promise<AdminUserListItem> {
    return apiClient.patch<AdminUserListItem>(`/admin/users/${userId}/unban`, { reason });
  }

  /**
   * Lists administrative audit logs.
   */
  public async getAuditLogs(
    params: {
      page?: number;
      limit?: number;
      action?: string;
      adminId?: string;
      targetId?: string;
    } = {},
  ): Promise<AdminAuditLogResponse> {
    const queryParams: Record<string, string | number | undefined> = {
      page: params.page || 1,
      limit: params.limit || 20,
    };
    if (params.action) queryParams['action'] = params.action;
    if (params.adminId) queryParams['adminId'] = params.adminId;
    if (params.targetId) queryParams['targetId'] = params.targetId;

    return apiClient.get<AdminAuditLogResponse>('/admin/audit-logs', { params: queryParams });
  }

  /**
   * Lists pending and resolved reports with advanced filtering.
   */
  public async getReports(
    params: {
      page?: number;
      limit?: number;
      status?: string;
      targetType?: string;
      reason?: string;
      reporterId?: string;
      reportedUserId?: string;
    } = {},
  ): Promise<AdminReportsResponse> {
    const queryParams: Record<string, string | number | undefined> = {
      page: params.page || 1,
      limit: params.limit || 20,
    };
    if (params.status) queryParams['status'] = params.status;
    if (params.targetType) queryParams['targetType'] = params.targetType;
    if (params.reason) queryParams['reason'] = params.reason;
    if (params.reporterId) queryParams['reporterId'] = params.reporterId;
    if (params.reportedUserId) queryParams['reportedUserId'] = params.reportedUserId;

    return apiClient.get<AdminReportsResponse>('/admin/reports', { params: queryParams });
  }

  /**
   * Retrieves single report detail with target user moderation history.
   */
  public async getReportDetail(reportId: string): Promise<{
    report: AdminReportItem;
    targetUserModerationHistory: AdminAuditLogItem[];
  }> {
    return apiClient.get<{
      report: AdminReportItem;
      targetUserModerationHistory: AdminAuditLogItem[];
    }>(`/admin/reports/${reportId}`);
  }

  /**
   * Resolves report with action, notes, and optional warning message.
   */
  public async resolveReport(
    reportId: string,
    payload: {
      action: 'DISMISS' | 'WARN' | 'SUSPEND' | 'BAN';
      notes?: string;
      adminNotes?: string;
      warningMessage?: string;
    },
  ): Promise<AdminReportItem> {
    return apiClient.post<AdminReportItem>(`/admin/reports/${reportId}/resolve`, payload);
  }

  /**
   * Lists group conversations.
   */
  public async getGroups(
    params: {
      page?: number;
      limit?: number;
    } = {},
  ): Promise<AdminGroupsResponse> {
    const queryParams: Record<string, string | number | undefined> = {
      page: params.page || 1,
      limit: params.limit || 20,
    };

    return apiClient.get<AdminGroupsResponse>('/admin/groups', { params: queryParams });
  }

  /**
   * Lists media attachments.
   */
  public async getMedia(
    params: {
      page?: number;
      limit?: number;
    } = {},
  ): Promise<AdminMediaResponse> {
    const queryParams: Record<string, string | number | undefined> = {
      page: params.page || 1,
      limit: params.limit || 20,
    };

    return apiClient.get<AdminMediaResponse>('/admin/media', { params: queryParams });
  }

  /**
   * Retrieves safe system settings.
   */
  public async getSettings(): Promise<AdminSettingsData> {
    return apiClient.get<AdminSettingsData>('/admin/settings');
  }
}

export const adminApi = new AdminApi();
