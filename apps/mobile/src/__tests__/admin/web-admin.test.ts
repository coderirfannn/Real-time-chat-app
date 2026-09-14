import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { adminApi } from '../../services/api/admin.api';
import { apiClient } from '../../services/api/client';

describe('Admin Web API Client (Task 26 Control Center API)', () => {
  let originalGet: typeof apiClient.get;
  let originalPatch: typeof apiClient.patch;

  beforeEach(() => {
    originalGet = apiClient.get;
    originalPatch = apiClient.patch;
  });

  afterEach(() => {
    apiClient.get = originalGet;
    apiClient.patch = originalPatch;
    vi.restoreAllMocks();
  });

  it('1. getDashboard: requests /admin/dashboard', async () => {
    const mockDashboard = {
      metrics: {
        totalUsers: 100,
        activeUsers: 80,
        suspendedUsers: 15,
        bannedUsers: 5,
        onlineUsers: 20,
        totalConversations: 45,
        directChats: 35,
        groupChats: 10,
        totalMessages: 1500,
        mediaAttachments: 50,
        pendingReports: 3,
        totalAuditLogs: 22,
      },
      recentAuditLogs: [],
      systemHealth: {
        status: 'healthy' as const,
        uptime: 12345,
        database: 'connected',
        redis: 'connected',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    };

    const spy = vi.spyOn(apiClient, 'get').mockResolvedValue(mockDashboard);
    const result = await adminApi.getDashboard();

    expect(spy).toHaveBeenCalledWith('/admin/dashboard');
    expect(result.metrics.totalUsers).toBe(100);
    expect(result.metrics.pendingReports).toBe(3);
  });

  it('2. getUsers: forwards query parameters (search, role, accountStatus, pagination)', async () => {
    const mockUsersResponse = {
      users: [],
      pagination: {
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: true,
      },
    };

    const spy = vi.spyOn(apiClient, 'get').mockResolvedValue(mockUsersResponse);
    await adminApi.getUsers({
      page: 2,
      limit: 10,
      q: 'alice',
      role: 'USER',
      accountStatus: 'ACTIVE',
    });

    expect(spy).toHaveBeenCalledWith('/admin/users', {
      params: {
        page: 2,
        limit: 10,
        q: 'alice',
        role: 'USER',
        accountStatus: 'ACTIVE',
      },
    });
  });

  it('3. getUser: requests /admin/users/:userId', async () => {
    const mockUserDetail = {
      id: 'usr-123',
      email: 'alice@example.com',
      username: 'alice',
      displayName: 'Alice Smith',
      role: 'USER',
      accountStatus: 'ACTIVE',
      status: 'offline',
      isEmailVerified: true,
      twoFactorEnabled: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      stats: {
        totalConversations: 5,
        totalMessagesSent: 120,
        activeDevices: 2,
      },
      moderationHistory: [],
    };

    const spy = vi.spyOn(apiClient, 'get').mockResolvedValue(mockUserDetail);
    const result = await adminApi.getUser('usr-123');

    expect(spy).toHaveBeenCalledWith('/admin/users/usr-123');
    expect(result.username).toBe('alice');
  });

  it('4. suspendUser: sends PATCH to /admin/users/:userId/suspend with reason', async () => {
    const mockResponse = { id: 'usr-123', accountStatus: 'SUSPENDED' };
    const spy = vi.spyOn(apiClient, 'patch').mockResolvedValue(mockResponse);

    const result = await adminApi.suspendUser('usr-123', 'Repeated spam violation');

    expect(spy).toHaveBeenCalledWith('/admin/users/usr-123/suspend', {
      reason: 'Repeated spam violation',
    });
    expect(result.accountStatus).toBe('SUSPENDED');
  });

  it('5. unsuspendUser: sends PATCH to /admin/users/:userId/unsuspend with reason', async () => {
    const mockResponse = { id: 'usr-123', accountStatus: 'ACTIVE' };
    const spy = vi.spyOn(apiClient, 'patch').mockResolvedValue(mockResponse);

    const result = await adminApi.unsuspendUser('usr-123', 'Suspension period expired');

    expect(spy).toHaveBeenCalledWith('/admin/users/usr-123/unsuspend', {
      reason: 'Suspension period expired',
    });
    expect(result.accountStatus).toBe('ACTIVE');
  });

  it('6. banUser: sends PATCH to /admin/users/:userId/ban with reason', async () => {
    const mockResponse = { id: 'usr-123', accountStatus: 'BANNED' };
    const spy = vi.spyOn(apiClient, 'patch').mockResolvedValue(mockResponse);

    const result = await adminApi.banUser('usr-123', 'Severe terms of service breach');

    expect(spy).toHaveBeenCalledWith('/admin/users/usr-123/ban', {
      reason: 'Severe terms of service breach',
    });
    expect(result.accountStatus).toBe('BANNED');
  });

  it('7. unbanUser: sends PATCH to /admin/users/:userId/unban with reason', async () => {
    const mockResponse = { id: 'usr-123', accountStatus: 'ACTIVE' };
    const spy = vi.spyOn(apiClient, 'patch').mockResolvedValue(mockResponse);

    const result = await adminApi.unbanUser('usr-123', 'Ban appeal approved');

    expect(spy).toHaveBeenCalledWith('/admin/users/usr-123/unban', {
      reason: 'Ban appeal approved',
    });
    expect(result.accountStatus).toBe('ACTIVE');
  });

  it('8. getAuditLogs: requests /admin/audit-logs with action filter and pagination', async () => {
    const mockAuditResponse = {
      logs: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };

    const spy = vi.spyOn(apiClient, 'get').mockResolvedValue(mockAuditResponse);
    await adminApi.getAuditLogs({ page: 1, limit: 20, action: 'USER_BANNED' });

    expect(spy).toHaveBeenCalledWith('/admin/audit-logs', {
      params: {
        page: 1,
        limit: 20,
        action: 'USER_BANNED',
      },
    });
  });

  it('9. getReports: requests /admin/reports with status filter', async () => {
    const mockReportsResponse = {
      reports: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };

    const spy = vi.spyOn(apiClient, 'get').mockResolvedValue(mockReportsResponse);
    await adminApi.getReports({ page: 1, limit: 20, status: 'PENDING' });

    expect(spy).toHaveBeenCalledWith('/admin/reports', {
      params: {
        page: 1,
        limit: 20,
        status: 'PENDING',
      },
    });
  });

  it('10. getGroups: requests /admin/groups with pagination', async () => {
    const mockGroupsResponse = {
      groups: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };

    const spy = vi.spyOn(apiClient, 'get').mockResolvedValue(mockGroupsResponse);
    await adminApi.getGroups({ page: 1, limit: 20 });

    expect(spy).toHaveBeenCalledWith('/admin/groups', {
      params: {
        page: 1,
        limit: 20,
      },
    });
  });

  it('11. getMedia: requests /admin/media with pagination', async () => {
    const mockMediaResponse = {
      media: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };

    const spy = vi.spyOn(apiClient, 'get').mockResolvedValue(mockMediaResponse);
    await adminApi.getMedia({ page: 1, limit: 20 });

    expect(spy).toHaveBeenCalledWith('/admin/media', {
      params: {
        page: 1,
        limit: 20,
      },
    });
  });

  it('12. getSettings: requests /admin/settings', async () => {
    const mockSettings = {
      environment: 'development',
      appName: 'ChatLock',
      apiPrefix: '/api/v1',
      storageDriver: 'local',
      rateLimit: { windowMs: 900000, maxRequests: 100 },
      features: { messageReactions: true, voiceCalls: false, e2ee: true },
      serverUptime: 4500,
    };

    const spy = vi.spyOn(apiClient, 'get').mockResolvedValue(mockSettings);
    const result = await adminApi.getSettings();

    expect(spy).toHaveBeenCalledWith('/admin/settings');
    expect(result.appName).toBe('ChatLock');
    expect(result.features.e2ee).toBe(true);
  });
});
