import mongoose from 'mongoose';
import { BaseRepository, type PaginatedResult } from './base.repository.js';
import { ReportModel, type IReportDoc } from '../models/report.model.js';
import type { ReportStatus, ReportTargetType, ModerationAction } from '@chatlock/shared-types';

export interface ReportPaginationOptions {
  page: number;
  limit: number;
  status?: string;
  targetType?: string;
  reason?: string;
  reporterId?: string;
  reportedUserId?: string;
}

export class ReportRepository extends BaseRepository<IReportDoc> {
  constructor() {
    super(ReportModel);
  }

  public async countPending(): Promise<number> {
    return this.count({ status: { $in: ['OPEN', 'UNDER_REVIEW', 'PENDING'] } });
  }

  /**
   * Find any active report by reporter on target to prevent spam/duplicate reporting.
   */
  public async findActiveReport(
    reporterId: string,
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<IReportDoc | null> {
    return this.findOne({
      reporterId: new mongoose.Types.ObjectId(reporterId),
      targetType,
      targetId,
      status: { $in: ['OPEN', 'UNDER_REVIEW', 'PENDING'] },
    });
  }

  /**
   * Find user's own submitted reports.
   */
  public async findUserReports(
    reporterId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResult<IReportDoc>> {
    return this.paginate(
      { reporterId: new mongoose.Types.ObjectId(reporterId) },
      {
        page,
        limit,
        sort: { createdAt: -1 },
      },
    );
  }

  /**
   * Admin paginated reports with populated actor references and filtering.
   */
  public async findPaginatedReports(
    options: ReportPaginationOptions,
  ): Promise<PaginatedResult<IReportDoc>> {
    const filter: Record<string, unknown> = {};

    if (options.status && options.status !== 'ALL') {
      filter['status'] = options.status;
    }
    if (options.targetType) {
      filter['targetType'] = options.targetType;
    }
    if (options.reason) {
      filter['reason'] = options.reason;
    }
    if (options.reporterId) {
      filter['reporterId'] = new mongoose.Types.ObjectId(options.reporterId);
    }
    if (options.reportedUserId) {
      filter['reportedUserId'] = new mongoose.Types.ObjectId(options.reportedUserId);
    }

    const page = Math.max(1, options.page);
    const limit = Math.min(100, Math.max(1, options.limit));
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      ReportModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reporterId', 'username name avatarUrl')
        .populate('reportedUserId', 'username name avatarUrl accountStatus')
        .populate('resolvedBy', 'username name')
        .exec(),
      ReportModel.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      docs,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  /**
   * Get single report fully populated.
   */
  public async findReportByIdPopulated(reportId: string): Promise<IReportDoc | null> {
    if (!mongoose.Types.ObjectId.isValid(reportId)) return null;
    return ReportModel.findById(reportId)
      .populate('reporterId', 'username name avatarUrl email')
      .populate('reportedUserId', 'username name avatarUrl accountStatus email')
      .populate('resolvedBy', 'username name email')
      .exec();
  }

  /**
   * Resolve report with action, notes, admin ID, and timestamp.
   */
  public async resolveReport(
    reportId: string,
    data: {
      status: ReportStatus;
      resolutionAction?: ModerationAction;
      resolutionNotes?: string;
      resolvedBy: string;
      resolvedAt: Date;
    },
  ): Promise<IReportDoc | null> {
    return ReportModel.findByIdAndUpdate(
      reportId,
      {
        $set: {
          status: data.status,
          resolutionAction: data.resolutionAction,
          resolutionNotes: data.resolutionNotes,
          resolvedBy: new mongoose.Types.ObjectId(data.resolvedBy),
          resolvedAt: data.resolvedAt,
        },
      },
      { new: true },
    )
      .populate('reporterId', 'username name avatarUrl')
      .populate('reportedUserId', 'username name avatarUrl accountStatus')
      .populate('resolvedBy', 'username name')
      .exec();
  }
}

export const reportRepository = new ReportRepository();
