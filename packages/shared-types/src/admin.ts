import type { ID } from './common.js';
import type { UserRole, AccountStatus, UserStatus } from './user.js';

export interface AdminDashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  onlineUsers: number;
  totalConversations: number;
  directChats: number;
  groupChats: number;
  totalMessages: number;
  mediaAttachments: number;
  pendingReports: number;
  totalAuditLogs: number;
}

export interface AdminAuditLogItem {
  id: ID;
  adminUserId: ID;
  adminUsername: string;
  action: string;
  targetId?: string;
  targetType?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminSystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  database: string;
  redis: string;
  timestamp: string;
}

export interface AdminDashboardData {
  metrics: AdminDashboardMetrics;
  recentAuditLogs: AdminAuditLogItem[];
  systemHealth: AdminSystemHealth;
}

export interface AdminUserListItem {
  id: ID;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  role: UserRole;
  accountStatus: AccountStatus;
  status: UserStatus;
  lastSeenAt?: string;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserStats {
  totalConversations: number;
  totalMessagesSent: number;
  activeDevices: number;
  reportCount?: number;
}

export interface AdminUserDetail extends AdminUserListItem {
  stats: AdminUserStats;
  moderationHistory: AdminAuditLogItem[];
}

export type ReportStatus =
  'OPEN' | 'UNDER_REVIEW' | 'DISMISSED' | 'WARNED' | 'SUSPENDED' | 'BANNED';

export type ReportTargetType = 'USER' | 'MESSAGE' | 'CONVERSATION';

export type ReportReason =
  | 'HARASSMENT'
  | 'SPAM'
  | 'HATE_SPEECH'
  | 'INAPPROPRIATE_CONTENT'
  | 'IMPERSONATION'
  | 'THREATS'
  | 'OTHER';

export type ModerationAction = 'DISMISS' | 'WARN' | 'SUSPEND' | 'BAN';

export interface IReport {
  id: ID;
  reporterId: ID;
  reporterUsername?: string;
  reporterDisplayName?: string;
  reportedUserId: ID;
  reportedUsername?: string;
  reportedDisplayName?: string;
  targetType: ReportTargetType;
  targetId: string;
  messageId?: string;
  conversationId?: string;
  reason: ReportReason | string;
  details?: string;
  description?: string;
  status: ReportStatus;
  resolutionAction?: ModerationAction;
  resolutionNotes?: string;
  warningMessage?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type AdminReportItem = IReport;

export interface CreateReportPayload {
  reportedUserId?: string;
  targetType: ReportTargetType;
  targetId: string;
  messageId?: string;
  conversationId?: string;
  reason: ReportReason | string;
  description?: string;
}

export interface ResolveReportPayload {
  action: ModerationAction;
  notes?: string;
  warningMessage?: string;
}

export interface AdminGroupItem {
  id: ID;
  title?: string;
  avatarUrl?: string;
  creatorId?: ID;
  creatorUsername?: string;
  participantsCount: number;
  adminsCount: number;
  lastMessageAt?: string;
  isArchived: boolean;
  createdAt: string;
}

export interface AdminMediaItem {
  id: string;
  messageId: ID;
  conversationId: ID;
  senderId: ID;
  senderUsername?: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  createdAt: string;
}

export interface AdminSettingsData {
  environment: string;
  appName: string;
  apiPrefix: string;
  storageDriver: string;
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  features: {
    messageReactions: boolean;
    voiceCalls: boolean;
    e2ee: boolean;
  };
  serverUptime: number;
}
