import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import type { Types } from 'mongoose';
import { createApp } from '../../app.js';
import { userRepository } from '../../repositories/user.repository.js';
import { sessionRepository } from '../../repositories/session.repository.js';
import { auditLogRepository } from '../../repositories/audit-log.repository.js';
import { deviceRepository } from '../../repositories/device.repository.js';
import { reportRepository } from '../../repositories/report.repository.js';
import { MessageModel } from '../../models/message.model.js';
import { signAccessToken } from '../../utils/token.js';
import type { IUserDoc } from '../../models/user.model.js';
import type { IReportDoc } from '../../models/report.model.js';
import type { IAuditLogDoc } from '../../models/audit-log.model.js';

describe('Task 28: Reporting & Abuse Moderation Tests (/api/v1/reports & /api/v1/admin/reports)', () => {
  const app = createApp();

  const adminId = '507f1f77bcf86cd799439011';
  const reporterId = '507f1f77bcf86cd799439022';
  const reportedUserId = '507f1f77bcf86cd799439033';
  const messageId = '507f1f77bcf86cd799439044';
  const conversationId = '507f1f77bcf86cd799439055';
  const reportId = '507f1f77bcf86cd799439066';

  const { token: adminToken } = signAccessToken({
    sub: adminId,
    email: 'admin@chatlock.dev',
    username: 'admin_user',
    role: 'ADMIN',
  });

  const { token: reporterToken } = signAccessToken({
    sub: reporterId,
    email: 'reporter@chatlock.dev',
    username: 'reporter_user',
    role: 'USER',
  });

  const mockAdminUser: Partial<IUserDoc> = {
    id: adminId,
    email: 'admin@chatlock.dev',
    username: 'admin_user',
    role: 'ADMIN',
    accountStatus: 'ACTIVE',
    status: 'online',
    toJSON: (() => ({
      id: adminId,
      role: 'ADMIN',
      username: 'admin_user',
    })) as unknown as IUserDoc['toJSON'],
  };

  const mockReporterUser: Partial<IUserDoc> = {
    id: reporterId,
    email: 'reporter@chatlock.dev',
    username: 'reporter_user',
    role: 'USER',
    accountStatus: 'ACTIVE',
    status: 'online',
    toJSON: (() => ({
      id: reporterId,
      role: 'USER',
      username: 'reporter_user',
    })) as unknown as IUserDoc['toJSON'],
  };

  const mockReportedUser: Partial<IUserDoc> = {
    id: reportedUserId,
    email: 'badguy@chatlock.dev',
    username: 'bad_user',
    role: 'USER',
    accountStatus: 'ACTIVE',
    status: 'online',
    toJSON: (() => ({
      id: reportedUserId,
      role: 'USER',
      username: 'bad_user',
    })) as unknown as IUserDoc['toJSON'],
  };

  const mockReportDoc: Partial<IReportDoc> = {
    id: reportId,
    reporterId: reporterId as unknown as Types.ObjectId,
    reportedUserId: reportedUserId as unknown as Types.ObjectId,
    targetType: 'USER',
    targetId: reportedUserId,
    reason: 'HARASSMENT',
    description: 'User is sending abusive threats.',
    status: 'OPEN',
    createdAt: new Date('2026-09-14T12:00:00Z'),
    updatedAt: new Date('2026-09-14T12:00:00Z'),
    toJSON: (() => ({
      id: reportId,
      reporterId,
      reportedUserId,
      targetType: 'USER',
      targetId: reportedUserId,
      reason: 'HARASSMENT',
      description: 'User is sending abusive threats.',
      status: 'OPEN',
      createdAt: '2026-09-14T12:00:00.000Z',
      updatedAt: '2026-09-14T12:00:00.000Z',
    })) as unknown as IReportDoc['toJSON'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    // Default user lookups
    vi.spyOn(userRepository, 'findById').mockImplementation(async (id: string) => {
      if (id === adminId) return mockAdminUser as IUserDoc;
      if (id === reporterId) return mockReporterUser as IUserDoc;
      if (id === reportedUserId) return mockReportedUser as IUserDoc;
      return null;
    });

    vi.spyOn(userRepository, 'updateAccountStatus').mockResolvedValue(mockReportedUser as IUserDoc);
    vi.spyOn(userRepository, 'updateStatus').mockResolvedValue(mockReportedUser as IUserDoc);
    vi.spyOn(sessionRepository, 'revokeAllUserSessions').mockResolvedValue(1);
    vi.spyOn(deviceRepository, 'findActiveTokensByUser').mockResolvedValue([]);
    vi.spyOn(auditLogRepository, 'recordLog').mockResolvedValue({
      id: 'audit-1',
    } as unknown as IAuditLogDoc);
    vi.spyOn(auditLogRepository, 'findByTarget').mockResolvedValue([]);
  });

  describe('User Reporting Endpoints (/api/v1/reports)', () => {
    it('requires authentication to submit a report', async () => {
      const res = await request(app).post('/api/v1/reports').send({
        targetType: 'USER',
        targetId: reportedUserId,
        reason: 'SPAM',
      });
      expect(res.status).toBe(401);
    });

    it('rejects self-reporting (prevent self abuse/confusion)', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({
          targetType: 'USER',
          targetId: reporterId, // Reporting self!
          reason: 'SPAM',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot report yourself/i);
    });

    it('successfully submits a report for a user', async () => {
      vi.spyOn(reportRepository, 'findActiveReport').mockResolvedValue(null);
      vi.spyOn(reportRepository, 'create').mockResolvedValue(mockReportDoc as IReportDoc);

      const res = await request(app)
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({
          targetType: 'USER',
          targetId: reportedUserId,
          reason: 'HARASSMENT',
          description: 'User is sending abusive threats.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/report submitted/i);
      expect(reportRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: 'USER',
          targetId: reportedUserId,
          reason: 'HARASSMENT',
          status: 'OPEN',
        }),
      );
    });

    it('successfully submits a report for a message (resolves reported user & conv from message)', async () => {
      vi.spyOn(reportRepository, 'findActiveReport').mockResolvedValue(null);
      vi.spyOn(reportRepository, 'create').mockResolvedValue({
        ...mockReportDoc,
        targetType: 'MESSAGE',
        targetId: messageId,
      } as IReportDoc);

      // Mock finding the reported message
      vi.spyOn(MessageModel, 'findById').mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          _id: messageId,
          senderId: reportedUserId,
          conversationId,
        }),
      } as unknown as ReturnType<typeof MessageModel.findById>);

      const res = await request(app)
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({
          targetType: 'MESSAGE',
          targetId: messageId,
          reason: 'INAPPROPRIATE_CONTENT',
          description: 'Inappropriate content in chat',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(reportRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: 'MESSAGE',
          targetId: messageId,
          reason: 'INAPPROPRIATE_CONTENT',
        }),
      );
    });

    it('rejects duplicate active reports on the same target (409 Conflict)', async () => {
      // Mock existing active report
      vi.spyOn(reportRepository, 'findActiveReport').mockResolvedValue(mockReportDoc as IReportDoc);

      const res = await request(app)
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({
          targetType: 'USER',
          targetId: reportedUserId,
          reason: 'SPAM',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already submitted a report.*under review/i);
    });

    it('retrieves user submitted report history', async () => {
      vi.spyOn(reportRepository, 'findUserReports').mockResolvedValue({
        docs: [mockReportDoc as IReportDoc],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });

      const res = await request(app)
        .get('/api/v1/reports/my-reports')
        .set('Authorization', `Bearer ${reporterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.docs).toHaveLength(1);
    });
  });

  describe('Admin Moderation Endpoints (/api/v1/admin/reports)', () => {
    it('blocks regular users from accessing admin reports queue (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${reporterToken}`);

      expect(res.status).toBe(403);
    });

    it('allows admin to list reports with filtering', async () => {
      vi.spyOn(reportRepository, 'findPaginatedReports').mockResolvedValue({
        docs: [mockReportDoc as IReportDoc],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });

      const res = await request(app)
        .get('/api/v1/admin/reports?status=OPEN&targetType=USER')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reports).toHaveLength(1);
      expect(reportRepository.findPaginatedReports).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'OPEN',
          targetType: 'USER',
        }),
      );
    });

    it('retrieves report detail with target user moderation history', async () => {
      vi.spyOn(reportRepository, 'findReportByIdPopulated').mockResolvedValue(
        mockReportDoc as IReportDoc,
      );
      vi.spyOn(auditLogRepository, 'findByTarget').mockResolvedValue([
        {
          id: 'log-1',
          adminUserId: adminId as unknown as Types.ObjectId,
          adminUsername: 'admin_user',
          action: 'USER_WARNED',
          targetId: reportedUserId,
          targetType: 'USER',
          createdAt: new Date(),
        } as unknown as IAuditLogDoc,
      ]);

      const res = await request(app)
        .get(`/api/v1/admin/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.report.id).toBe(reportId);
      expect(res.body.data.targetUserModerationHistory).toHaveLength(1);
      expect(auditLogRepository.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REPORT_VIEWED',
          targetId: reportId,
        }),
      );
    });

    it('resolves report with DISMISS action', async () => {
      vi.spyOn(reportRepository, 'findReportByIdPopulated').mockResolvedValue(
        mockReportDoc as IReportDoc,
      );
      vi.spyOn(reportRepository, 'resolveReport').mockResolvedValue({
        ...mockReportDoc,
        status: 'DISMISSED',
        resolutionAction: 'DISMISS',
      } as IReportDoc);

      const res = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'DISMISS',
          adminNotes: 'False positive report. No violation found.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DISMISSED');
      expect(reportRepository.resolveReport).toHaveBeenCalledWith(
        reportId,
        expect.objectContaining({
          status: 'DISMISSED',
          resolutionAction: 'DISMISS',
        }),
      );
      expect(auditLogRepository.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REPORT_DISMISS',
        }),
      );
    });

    it('resolves report with WARN action (dispatches warning notification)', async () => {
      vi.spyOn(reportRepository, 'findReportByIdPopulated').mockResolvedValue(
        mockReportDoc as IReportDoc,
      );
      vi.spyOn(reportRepository, 'resolveReport').mockResolvedValue({
        ...mockReportDoc,
        status: 'WARNED',
        resolutionAction: 'WARN',
      } as IReportDoc);

      const res = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'WARN',
          warningMessage: 'Please adhere to respectful communication in public chats.',
          adminNotes: 'First warning issued.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('WARNED');
      expect(reportRepository.resolveReport).toHaveBeenCalledWith(
        reportId,
        expect.objectContaining({
          status: 'WARNED',
          resolutionAction: 'WARN',
        }),
      );
    });

    it('resolves report with SUSPEND action (suspends user, revokes sessions, evicts sockets)', async () => {
      vi.spyOn(reportRepository, 'findReportByIdPopulated').mockResolvedValue(
        mockReportDoc as IReportDoc,
      );
      vi.spyOn(reportRepository, 'resolveReport').mockResolvedValue({
        ...mockReportDoc,
        status: 'SUSPENDED',
        resolutionAction: 'SUSPEND',
      } as IReportDoc);

      const res = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'SUSPEND',
          adminNotes: 'Suspended for 7 days due to repeated harassment.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(userRepository.updateAccountStatus).toHaveBeenCalledWith(reportedUserId, 'SUSPENDED');
      expect(sessionRepository.revokeAllUserSessions).toHaveBeenCalledWith(reportedUserId);
      expect(auditLogRepository.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REPORT_SUSPEND',
        }),
      );
    });

    it('resolves report with BAN action (bans user, revokes sessions, evicts sockets)', async () => {
      vi.spyOn(reportRepository, 'findReportByIdPopulated').mockResolvedValue(
        mockReportDoc as IReportDoc,
      );
      vi.spyOn(reportRepository, 'resolveReport').mockResolvedValue({
        ...mockReportDoc,
        status: 'BANNED',
        resolutionAction: 'BAN',
      } as IReportDoc);

      const res = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'BAN',
          adminNotes: 'Permanently banned for severe harassment.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(userRepository.updateAccountStatus).toHaveBeenCalledWith(reportedUserId, 'BANNED');
      expect(sessionRepository.revokeAllUserSessions).toHaveBeenCalledWith(reportedUserId);
      expect(auditLogRepository.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REPORT_BAN',
        }),
      );
    });
  });
});
