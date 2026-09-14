import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { userRepository } from '../../repositories/user.repository.js';
import { sessionRepository } from '../../repositories/session.repository.js';
import { deviceRepository } from '../../repositories/device.repository.js';
import { auditLogRepository } from '../../repositories/audit-log.repository.js';
import { reportRepository } from '../../repositories/report.repository.js';
import { ConversationModel } from '../../models/conversation.model.js';
import { MessageModel } from '../../models/message.model.js';
import { signAccessToken } from '../../utils/token.js';
import { hashPassword } from '../../utils/password.js';
import { AuthService } from '../../services/auth.service.js';
import type { IUserDoc } from '../../models/user.model.js';
import type { IAuditLogDoc } from '../../models/audit-log.model.js';

describe('Admin RBAC & Control Center Server Tests (/api/v1/admin/*)', () => {
  const app = createApp();

  const adminId = '507f1f77bcf86cd799439011';
  const normalUserId = '507f1f77bcf86cd799439022';
  const targetUserId = '507f1f77bcf86cd799439033';

  const { token: adminToken } = signAccessToken({
    sub: adminId,
    email: 'admin@chatlock.dev',
    username: 'admin_user',
    role: 'ADMIN',
  });

  const { token: userToken } = signAccessToken({
    sub: normalUserId,
    email: 'user@chatlock.dev',
    username: 'normal_user',
    role: 'USER',
  });

  const mockAdminDoc: Partial<IUserDoc> = {
    id: adminId,
    email: 'admin@chatlock.dev',
    username: 'admin_user',
    displayName: 'Admin User',
    role: 'ADMIN',
    accountStatus: 'ACTIVE',
    status: 'online',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    toJSON: (() => ({
      id: adminId,
      email: 'admin@chatlock.dev',
      username: 'admin_user',
      displayName: 'Admin User',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      status: 'online',
    })) as unknown as IUserDoc['toJSON'],
  };

  const mockUserDoc: Partial<IUserDoc> = {
    id: normalUserId,
    email: 'user@chatlock.dev',
    username: 'normal_user',
    displayName: 'Normal User',
    role: 'USER',
    accountStatus: 'ACTIVE',
    status: 'online',
    createdAt: new Date('2026-01-02'),
    updatedAt: new Date('2026-01-02'),
    toJSON: (() => ({
      id: normalUserId,
      email: 'user@chatlock.dev',
      username: 'normal_user',
      displayName: 'Normal User',
      role: 'USER',
      accountStatus: 'ACTIVE',
      status: 'online',
    })) as unknown as IUserDoc['toJSON'],
  };

  const mockTargetDoc: Partial<IUserDoc> = {
    id: targetUserId,
    email: 'target@chatlock.dev',
    username: 'target_user',
    displayName: 'Target User',
    role: 'USER',
    accountStatus: 'ACTIVE',
    status: 'offline',
    createdAt: new Date('2026-01-03'),
    updatedAt: new Date('2026-01-03'),
    toJSON: (() => ({
      id: targetUserId,
      email: 'target@chatlock.dev',
      username: 'target_user',
      displayName: 'Target User',
      role: 'USER',
      accountStatus: 'ACTIVE',
      status: 'offline',
    })) as unknown as IUserDoc['toJSON'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Route Protection & Authorization Boundaries', () => {
    it('returns 401 Unauthorized when unauthenticated request calls admin API', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('returns 403 Forbidden when normal authenticated USER calls admin API', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValue(mockUserDoc as IUserDoc);

      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('FORBIDDEN');
      expect(res.body.message).toContain('Administrative privileges required');
    });

    it('returns 403 Forbidden if admin account has been SUSPENDED', async () => {
      const suspendedAdmin = {
        ...mockAdminDoc,
        accountStatus: 'SUSPENDED' as const,
      };
      vi.spyOn(userRepository, 'findById').mockResolvedValue(suspendedAdmin as IUserDoc);

      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
      expect(res.body.message).toContain('suspended');
    });

    it('returns 200 OK when authenticated ADMIN calls admin dashboard', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValue(mockAdminDoc as IUserDoc);
      vi.spyOn(userRepository, 'count')
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(45) // active
        .mockResolvedValueOnce(3) // suspended
        .mockResolvedValueOnce(2) // banned
        .mockResolvedValueOnce(10); // online
      vi.spyOn(ConversationModel, 'countDocuments').mockReturnValue({
        exec: vi.fn().mockResolvedValue(25),
      } as unknown as ReturnType<typeof ConversationModel.countDocuments>);
      vi.spyOn(MessageModel, 'countDocuments').mockReturnValue({
        exec: vi.fn().mockResolvedValue(500),
      } as unknown as ReturnType<typeof MessageModel.countDocuments>);
      vi.spyOn(reportRepository, 'countPending').mockResolvedValue(0);
      vi.spyOn(auditLogRepository, 'count').mockResolvedValue(12);
      vi.spyOn(auditLogRepository, 'findRecentLogs').mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics.totalUsers).toBe(50);
      expect(res.body.data.metrics.activeUsers).toBe(45);
      expect(res.body.data.metrics.suspendedUsers).toBe(3);
      expect(res.body.data.metrics.bannedUsers).toBe(2);
      expect(res.body.data.systemHealth.status).toBe('healthy');
    });
  });

  describe('2. User Management Listing & Pagination', () => {
    it('returns paginated users list for admin', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValue(mockAdminDoc as IUserDoc);
      vi.spyOn(userRepository, 'findPaginatedUsers').mockResolvedValue({
        docs: [mockTargetDoc as IUserDoc],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });

      const res = await request(app)
        .get('/api/v1/admin/users?page=1&limit=20&q=target')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users).toHaveLength(1);
      expect(res.body.data.users[0].username).toBe('target_user');
      expect(res.body.data.pagination.total).toBe(1);
      // Ensure password hash is not exposed
      expect(res.body.data.users[0].passwordHash).toBeUndefined();
    });

    it('rejects normal user from listing users', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValue(mockUserDoc as IUserDoc);

      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('3. User Detail Inspection', () => {
    it('returns full user detail and records USER_VIEWED audit log', async () => {
      vi.spyOn(userRepository, 'findById')
        .mockResolvedValueOnce(mockAdminDoc as IUserDoc) // requireAdmin check
        .mockResolvedValueOnce(mockTargetDoc as IUserDoc); // target lookup
      vi.spyOn(ConversationModel, 'countDocuments').mockReturnValue({
        exec: vi.fn().mockResolvedValue(5),
      } as unknown as ReturnType<typeof ConversationModel.countDocuments>);
      vi.spyOn(MessageModel, 'countDocuments').mockReturnValue({
        exec: vi.fn().mockResolvedValue(42),
      } as unknown as ReturnType<typeof MessageModel.countDocuments>);
      vi.spyOn(deviceRepository, 'count').mockResolvedValue(1);
      vi.spyOn(reportRepository, 'count').mockResolvedValue(0);
      vi.spyOn(auditLogRepository, 'findByTarget').mockResolvedValue([]);
      const recordSpy = vi
        .spyOn(auditLogRepository, 'recordLog')
        .mockResolvedValue({} as IAuditLogDoc);

      const res = await request(app)
        .get(`/api/v1/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(targetUserId);
      expect(res.body.data.stats.totalMessagesSent).toBe(42);
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_VIEWED',
          targetId: targetUserId,
          adminUserId: adminId,
        }),
      );
    });
  });

  describe('4. Account Moderation: Suspend & Unsuspend', () => {
    it('prevents an administrator from suspending their own account', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValue(mockAdminDoc as IUserDoc);

      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Self-harm attempt' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('BAD_REQUEST');
      expect(res.body.message).toContain('cannot suspend their own account');
    });

    it('suspends target user, revokes active sessions, and records audit log', async () => {
      vi.spyOn(userRepository, 'findById')
        .mockResolvedValueOnce(mockAdminDoc as IUserDoc) // requireAdmin
        .mockResolvedValueOnce(mockTargetDoc as IUserDoc); // target lookup
      const updateStatusSpy = vi.spyOn(userRepository, 'updateAccountStatus').mockResolvedValue({
        ...mockTargetDoc,
        accountStatus: 'SUSPENDED',
      } as IUserDoc);
      const revokeSpy = vi.spyOn(sessionRepository, 'revokeAllUserSessions').mockResolvedValue(2);
      vi.spyOn(userRepository, 'updateStatus').mockResolvedValue({} as IUserDoc);
      const auditSpy = vi
        .spyOn(auditLogRepository, 'recordLog')
        .mockResolvedValue({} as IAuditLogDoc);

      const res = await request(app)
        .patch(`/api/v1/admin/users/${targetUserId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Spamming channels' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accountStatus).toBe('SUSPENDED');
      expect(updateStatusSpy).toHaveBeenCalledWith(targetUserId, 'SUSPENDED');
      expect(revokeSpy).toHaveBeenCalledWith(targetUserId);
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_SUSPENDED',
          targetId: targetUserId,
          metadata: expect.objectContaining({ reason: 'Spamming channels' }),
        }),
      );
    });

    it('unsuspends user and records audit log', async () => {
      vi.spyOn(userRepository, 'findById')
        .mockResolvedValueOnce(mockAdminDoc as IUserDoc)
        .mockResolvedValueOnce({
          ...mockTargetDoc,
          accountStatus: 'SUSPENDED',
        } as IUserDoc);
      vi.spyOn(userRepository, 'updateAccountStatus').mockResolvedValue({
        ...mockTargetDoc,
        accountStatus: 'ACTIVE',
      } as IUserDoc);
      const auditSpy = vi
        .spyOn(auditLogRepository, 'recordLog')
        .mockResolvedValue({} as IAuditLogDoc);

      const res = await request(app)
        .patch(`/api/v1/admin/users/${targetUserId}/unsuspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Appeal accepted' });

      expect(res.status).toBe(200);
      expect(res.body.data.accountStatus).toBe('ACTIVE');
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_UNSUSPENDED',
          targetId: targetUserId,
        }),
      );
    });
  });

  describe('5. Account Moderation: Ban & Unban', () => {
    it('prevents an administrator from banning their own account', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValue(mockAdminDoc as IUserDoc);

      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminId}/ban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Ban myself' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('BAD_REQUEST');
      expect(res.body.message).toContain('cannot ban their own account');
    });

    it('bans target user, revokes sessions, and records audit log', async () => {
      vi.spyOn(userRepository, 'findById')
        .mockResolvedValueOnce(mockAdminDoc as IUserDoc)
        .mockResolvedValueOnce(mockTargetDoc as IUserDoc);
      vi.spyOn(userRepository, 'updateAccountStatus').mockResolvedValue({
        ...mockTargetDoc,
        accountStatus: 'BANNED',
      } as IUserDoc);
      vi.spyOn(sessionRepository, 'revokeAllUserSessions').mockResolvedValue(1);
      vi.spyOn(userRepository, 'updateStatus').mockResolvedValue({} as IUserDoc);
      const auditSpy = vi
        .spyOn(auditLogRepository, 'recordLog')
        .mockResolvedValue({} as IAuditLogDoc);

      const res = await request(app)
        .patch(`/api/v1/admin/users/${targetUserId}/ban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Severe violation' });

      expect(res.status).toBe(200);
      expect(res.body.data.accountStatus).toBe('BANNED');
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_BANNED',
          targetId: targetUserId,
        }),
      );
    });

    it('unbans user and records audit log', async () => {
      vi.spyOn(userRepository, 'findById')
        .mockResolvedValueOnce(mockAdminDoc as IUserDoc)
        .mockResolvedValueOnce({
          ...mockTargetDoc,
          accountStatus: 'BANNED',
        } as IUserDoc);
      vi.spyOn(userRepository, 'updateAccountStatus').mockResolvedValue({
        ...mockTargetDoc,
        accountStatus: 'ACTIVE',
      } as IUserDoc);
      const auditSpy = vi
        .spyOn(auditLogRepository, 'recordLog')
        .mockResolvedValue({} as IAuditLogDoc);

      const res = await request(app)
        .patch(`/api/v1/admin/users/${targetUserId}/unban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Legal review cleared' });

      expect(res.status).toBe(200);
      expect(res.body.data.accountStatus).toBe('ACTIVE');
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_UNBANNED',
          targetId: targetUserId,
        }),
      );
    });
  });

  describe('6. Audit Logging Querying', () => {
    it('returns paginated audit logs for admin', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValue(mockAdminDoc as IUserDoc);
      vi.spyOn(auditLogRepository, 'findPaginatedLogs').mockResolvedValue({
        docs: [
          {
            id: 'audit-1',
            adminUserId: adminId as unknown as IAuditLogDoc['adminUserId'],
            adminUsername: 'admin_user',
            action: 'USER_SUSPENDED',
            targetId: targetUserId,
            targetType: 'USER',
            createdAt: new Date('2026-01-04'),
          } as unknown as IAuditLogDoc,
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });

      const res = await request(app)
        .get('/api/v1/admin/audit-logs?action=USER_SUSPENDED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logs).toHaveLength(1);
      expect(res.body.data.logs[0].action).toBe('USER_SUSPENDED');
    });
  });

  describe('7. Security & Privilege Elevation Defense', () => {
    it('ignores client-sent role in user profile updates', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValue(mockUserDoc as IUserDoc);
      const updateSpy = vi.spyOn(userRepository, 'updateById').mockResolvedValue({
        ...mockUserDoc,
        displayName: 'Updated Name',
      } as IUserDoc);

      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          displayName: 'Updated Name',
          // Client attempting to forge admin role in body
          role: 'ADMIN',
        });

      expect(res.status).toBe(200);
      // Verify that updateById did NOT receive role
      expect(updateSpy).toHaveBeenCalledWith(normalUserId, {
        displayName: 'Updated Name',
      });
    });

    it('rejects login for SUSPENDED user with HTTP 403', async () => {
      const passwordHash = await hashPassword('ValidPassword123');
      const suspendedUser = {
        ...mockUserDoc,
        accountStatus: 'SUSPENDED' as const,
        passwordHash,
      };

      const mockUserRepo = {
        findByIdentifierWithPassword: vi.fn().mockResolvedValue(suspendedUser),
        updateStatus: vi.fn(),
      };
      const mockSessionRepo = {
        createSession: vi.fn(),
      };
      const mockDeviceRepo = {
        upsertDevice: vi.fn(),
      };

      const isolatedAuthService = new AuthService(
        mockUserRepo as unknown as typeof userRepository,
        mockSessionRepo as unknown as typeof sessionRepository,
        mockDeviceRepo as unknown as typeof deviceRepository,
      );

      await expect(
        isolatedAuthService.login({
          identifier: 'user@chatlock.dev',
          password: 'ValidPassword123',
        }),
      ).rejects.toThrow('Your account has been suspended');
    });

    it('rejects token refresh for BANNED user with HTTP 403', async () => {
      const bannedUser = {
        ...mockUserDoc,
        accountStatus: 'BANNED' as const,
      };

      const mockSessionRepo = {
        findByTokenHash: vi.fn().mockResolvedValue({
          userId: normalUserId,
          deviceId: 'device-1',
          tokenHash: 'hash-1',
          expiresAt: new Date(Date.now() + 100000),
        }),
        revokeSession: vi.fn(),
      };
      const mockUserRepo = {
        findById: vi.fn().mockResolvedValue(bannedUser),
      };

      const isolatedAuthService = new AuthService(
        mockUserRepo as unknown as typeof userRepository,
        mockSessionRepo as unknown as typeof sessionRepository,
        {} as unknown as typeof deviceRepository,
      );

      await expect(isolatedAuthService.refreshToken('valid-token')).rejects.toThrow(
        'Your account has been permanently banned',
      );
    });
  });
});
