import type { Request, Response } from 'express';
import type { ApiResponse } from '@chatlock/shared-types';
import type { CreateReportInput } from '@chatlock/validation';
import { reportService, type ReportService } from '../services/report.service.js';
import { UnauthorizedError } from '../errors/app-error.js';

export class ReportController {
  constructor(private readonly reports: ReportService = reportService) {}

  public createReport = async (
    req: Request<unknown, unknown, CreateReportInput>,
    res: Response<ApiResponse<unknown>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const report = await this.reports.createReport(req.user.id, req.body);

    res.status(201).json({
      success: true,
      data: report,
      message: 'Report submitted successfully. Our moderation team will review it.',
      timestamp: new Date().toISOString(),
    });
  };

  public getMyReports = async (
    req: Request<unknown, unknown, unknown, { page?: string; limit?: string }>,
    res: Response<ApiResponse<unknown>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));

    const result = await this.reports.getUserReports(req.user.id, page, limit);

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  };
}

export const reportController = new ReportController();
