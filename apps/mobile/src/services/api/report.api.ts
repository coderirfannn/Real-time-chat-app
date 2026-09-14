import { apiClient } from './client';
import type { CreateReportPayload, IReport } from '@chatlock/shared-types';

export interface UserReportsResponse {
  docs: IReport[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export class ReportApi {
  /**
   * Submits a report for a user, message, or conversation.
   */
  public async submitReport(payload: CreateReportPayload): Promise<IReport> {
    return apiClient.post<IReport>('/reports', payload);
  }

  /**
   * Retrieves the authenticated user's submitted report history.
   */
  public async getMyReports(page: number = 1, limit: number = 20): Promise<UserReportsResponse> {
    return apiClient.get<UserReportsResponse>('/reports/my-reports', {
      params: { page, limit },
    });
  }
}

export const reportApi = new ReportApi();
