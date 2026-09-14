import { BaseRepository, type PaginatedResult } from './base.repository.js';
import { ReportModel, type IReportDoc } from '../models/report.model.js';

export interface ReportPaginationOptions {
  page: number;
  limit: number;
  status?: string;
  reportedUserId?: string;
}

export class ReportRepository extends BaseRepository<IReportDoc> {
  constructor() {
    super(ReportModel);
  }

  public async countPending(): Promise<number> {
    return this.count({ status: 'PENDING' });
  }

  public async findPaginatedReports(
    options: ReportPaginationOptions,
  ): Promise<PaginatedResult<IReportDoc>> {
    const filter: Record<string, unknown> = {};

    if (options.status && options.status !== 'ALL') {
      filter['status'] = options.status;
    }
    if (options.reportedUserId) {
      filter['reportedUserId'] = options.reportedUserId;
    }

    return this.paginate(filter, {
      page: options.page,
      limit: options.limit,
      sort: { createdAt: -1 },
    });
  }
}

export const reportRepository = new ReportRepository();
