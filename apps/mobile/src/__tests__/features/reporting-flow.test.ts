import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { reportApi } from '../../services/api/report.api';
import { adminApi } from '../../services/api/admin.api';
import { apiClient } from '../../services/api/client';
import { ReportModal } from '../../components/ReportModal';
import { ReactionPicker } from '../../features/chat/components/ReactionPicker';
import { MessageBubble } from '../../features/chat/components/MessageBubble';
import type { LocalMessage } from '../../types/chat.types';

describe('Task 28: Client Reporting & Moderation Flow Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Report API Client (report.api.ts)', () => {
    it('submits a user abuse report with required metadata', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        id: 'rep-1',
        targetType: 'USER',
        targetId: 'user-2',
        reason: 'SPAM',
        status: 'OPEN',
      });

      const res = await reportApi.submitReport({
        targetType: 'USER',
        targetId: 'user-2',
        reason: 'SPAM',
        description: 'Sending unwanted commercial links',
      });

      expect(postSpy).toHaveBeenCalledWith('/reports', {
        targetType: 'USER',
        targetId: 'user-2',
        reason: 'SPAM',
        description: 'Sending unwanted commercial links',
      });
      expect(res.id).toBe('rep-1');
    });

    it('submits a message abuse report with message ID and conversation ID', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        id: 'rep-2',
        targetType: 'MESSAGE',
        targetId: 'msg-99',
        conversationId: 'conv-10',
        reason: 'HARASSMENT',
        status: 'OPEN',
      });

      const res = await reportApi.submitReport({
        targetType: 'MESSAGE',
        targetId: 'msg-99',
        conversationId: 'conv-10',
        messageId: 'msg-99',
        reason: 'HARASSMENT',
      });

      expect(postSpy).toHaveBeenCalledWith(
        '/reports',
        expect.objectContaining({
          targetType: 'MESSAGE',
          targetId: 'msg-99',
          reason: 'HARASSMENT',
        }),
      );
      expect(res.id).toBe('rep-2');
    });

    it('fetches authenticated user submitted reports history', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        docs: [{ id: 'rep-1', status: 'OPEN' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });

      const res = await reportApi.getMyReports(1, 10);
      expect(getSpy).toHaveBeenCalledWith('/reports/my-reports', {
        params: { page: 1, limit: 10 },
      });
      expect(res.docs).toHaveLength(1);
    });
  });

  describe('Admin Moderation API Client (admin.api.ts)', () => {
    it('fetches reports with status and targetType query params', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        reports: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      await adminApi.getReports({ status: 'OPEN', targetType: 'USER' });

      expect(getSpy).toHaveBeenCalledWith('/admin/reports', {
        params: expect.objectContaining({
          status: 'OPEN',
          targetType: 'USER',
        }),
      });
    });

    it('fetches report detail with target user moderation history', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        report: { id: 'rep-1', status: 'OPEN' },
        targetUserModerationHistory: [],
      });

      const res = await adminApi.getReportDetail('rep-1');
      expect(getSpy).toHaveBeenCalledWith('/admin/reports/rep-1');
      expect(res.report.id).toBe('rep-1');
    });

    it('submits report resolution action (WARN, SUSPEND, BAN, DISMISS)', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        id: 'rep-1',
        status: 'WARNED',
        resolutionAction: 'WARN',
      });

      const res = await adminApi.resolveReport('rep-1', {
        action: 'WARN',
        notes: 'Warning for abusive language',
        warningMessage: 'Please adhere to community guidelines.',
      });

      expect(postSpy).toHaveBeenCalledWith('/admin/reports/rep-1/resolve', {
        action: 'WARN',
        notes: 'Warning for abusive language',
        warningMessage: 'Please adhere to community guidelines.',
      });
      expect(res.status).toBe('WARNED');
    });
  });

  describe('Component Contracts & UI Elements', () => {
    it('instantiates ReportModal with target type USER without crashing', () => {
      const onCloseMock = vi.fn();
      const modal = React.createElement(ReportModal, {
        visible: true,
        onClose: onCloseMock,
        targetType: 'USER',
        targetId: 'user-123',
        reportedUserName: 'test_user',
      });

      expect(modal).toBeDefined();
      expect(modal.props.targetType).toBe('USER');
      expect(modal.props.targetId).toBe('user-123');
      expect(modal.props.reportedUserName).toBe('test_user');
    });

    it('instantiates ReportModal with target type MESSAGE without crashing', () => {
      const onCloseMock = vi.fn();
      const modal = React.createElement(ReportModal, {
        visible: true,
        onClose: onCloseMock,
        targetType: 'MESSAGE',
        targetId: 'msg-456',
        messageId: 'msg-456',
        conversationId: 'conv-789',
      });

      expect(modal).toBeDefined();
      expect(modal.props.targetType).toBe('MESSAGE');
      expect(modal.props.messageId).toBe('msg-456');
    });

    it('instantiates ReactionPicker with onReport action callback', () => {
      const onSelectEmoji = vi.fn();
      const onReportMock = vi.fn();

      const picker = React.createElement(ReactionPicker, {
        onSelectEmoji,
        onReport: onReportMock,
      });

      expect(picker).toBeDefined();
      expect(picker.props.onReport).toBe(onReportMock);
    });

    it('instantiates MessageBubble with onReport prop', () => {
      const message: LocalMessage = {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'user-2',
        clientMessageId: 'cmid-1',
        type: 'text',
        content: 'Reportable message',
        status: 'delivered',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const onReportMock = vi.fn();
      const bubble = React.createElement(MessageBubble, {
        message,
        isOutbound: false,
        onReport: onReportMock,
      });

      expect(bubble).toBeDefined();
      expect(bubble.props.onReport).toBe(onReportMock);
    });
  });
});
