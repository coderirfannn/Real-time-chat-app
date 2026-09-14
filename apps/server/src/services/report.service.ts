import mongoose from 'mongoose';
import { reportRepository, type ReportRepository } from '../repositories/report.repository.js';
import { userRepository, type UserRepository } from '../repositories/user.repository.js';
import { MessageModel } from '../models/message.model.js';
import { ConversationModel } from '../models/conversation.model.js';
import { type IReportDoc } from '../models/report.model.js';
import type { CreateReportPayload, ReportReason } from '@chatlock/shared-types';
import { BadRequestError, NotFoundError, ConflictError } from '../errors/app-error.js';
import { logger } from '../utils/logger.js';

const reportLogger = logger.child('ReportService');

export class ReportService {
  constructor(
    private readonly reportRepo: ReportRepository = reportRepository,
    private readonly userRepo: UserRepository = userRepository,
  ) {}

  /**
   * Creates a user-submitted moderation report.
   * STRICT SECURITY RULES:
   * - Reporter ID is derived from authenticated session context, never client input.
   * - Self-reporting is blocked.
   * - Duplicate active reports on the same target by the same reporter are rejected.
   * - E2EE plaintext is NOT requested, logged, or stored.
   */
  public async createReport(reporterId: string, payload: CreateReportPayload): Promise<IReportDoc> {
    const cleanReporterId = reporterId.trim();
    if (!Types.ObjectId.isValid(cleanReporterId)) {
      throw new BadRequestError('Invalid reporter ID');
    }

    let reportedUserId = payload.reportedUserId?.trim();
    let conversationId = payload.conversationId?.trim();
    let messageId = payload.messageId?.trim();

    // 1. Resolve and validate target
    if (payload.targetType === 'USER') {
      reportedUserId = payload.targetId.trim();
      if (!Types.ObjectId.isValid(reportedUserId)) {
        throw new BadRequestError('Invalid reported user ID');
      }
      const reportedUser = await this.userRepo.findById(reportedUserId);
      if (!reportedUser) {
        throw new NotFoundError('Reported user not found');
      }
    } else if (payload.targetType === 'MESSAGE') {
      const targetMsgId = payload.targetId.trim();
      if (!Types.ObjectId.isValid(targetMsgId)) {
        throw new BadRequestError('Invalid target message ID');
      }
      const message = await MessageModel.findById(targetMsgId).exec();
      if (!message) {
        throw new NotFoundError('Reported message not found');
      }
      reportedUserId = message.senderId.toString();
      conversationId = message.conversationId.toString();
      messageId = message._id.toString();
    } else if (payload.targetType === 'CONVERSATION') {
      const targetConvId = payload.targetId.trim();
      if (!Types.ObjectId.isValid(targetConvId)) {
        throw new BadRequestError('Invalid target conversation ID');
      }
      const conversation = await ConversationModel.findById(targetConvId).exec();
      if (!conversation) {
        throw new NotFoundError('Reported conversation not found');
      }
      conversationId = conversation._id.toString();
      if (!reportedUserId) {
        const otherParticipant = conversation.participants.find(
          (p) => p.toString() !== cleanReporterId,
        );
        if (otherParticipant) {
          reportedUserId = otherParticipant.toString();
        } else {
          throw new BadRequestError('Unable to identify target user for this conversation report');
        }
      }
    }

    if (!reportedUserId) {
      throw new BadRequestError('Target reported user could not be determined');
    }

    // 2. Anti-Abuse: Prevent self-reporting
    if (reportedUserId === cleanReporterId) {
      throw new BadRequestError('You cannot report yourself');
    }

    // 3. Anti-Abuse: Check for existing active report on target by reporter
    const existingActive = await this.reportRepo.findActiveReport(
      cleanReporterId,
      payload.targetType,
      payload.targetId.trim(),
    );
    if (existingActive) {
      throw new ConflictError(
        'You have already submitted a report for this item that is currently under review',
      );
    }

    // 4. Persist report
    const newReport = await this.reportRepo.create({
      reporterId: new Types.ObjectId(cleanReporterId),
      reportedUserId: new Types.ObjectId(reportedUserId),
      targetType: payload.targetType,
      targetId: payload.targetId.trim(),
      conversationId: conversationId ? new Types.ObjectId(conversationId) : undefined,
      messageId: messageId ? new Types.ObjectId(messageId) : undefined,
      reason: payload.reason as ReportReason,
      description: payload.description?.trim(),
      status: 'OPEN',
    });

    reportLogger.info('Abuse report submitted', {
      reportId: newReport.id,
      reporterId: cleanReporterId,
      reportedUserId,
      targetType: payload.targetType,
      reason: payload.reason,
    });

    return newReport;
  }

  /**
   * Retrieves report history submitted by the authenticated user.
   */
  public async getUserReports(reporterId: string, page: number = 1, limit: number = 20) {
    const cleanReporterId = reporterId.trim();
    return this.reportRepo.findUserReports(cleanReporterId, page, limit);
  }
}

const Types = mongoose.Types;
export const reportService = new ReportService();
