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

export interface AdminReportItem {
  id: ID;
  reporterId: ID;
  reporterUsername?: string;
  reportedUserId: ID;
  reportedUsername?: string;
  targetType: 'USER' | 'MESSAGE' | 'CONVERSATION';
  targetId: string;
  reason: string;
  details?: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  resolutionNotes?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
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
