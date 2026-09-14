import type { Request, Response } from 'express';
import type {
  ApiResponse,
  AdminDashboardData,
  AdminUserListItem,
  AdminUserDetail,
  AdminAuditLogItem,
  AdminReportItem,
  AdminGroupItem,
  AdminMediaItem,
  AdminSettingsData,
} from '@chatlock/shared-types';
import type {
  AdminUserQueryInput,
  AdminStatusUpdateInput,
  AdminAuditLogQueryInput,
  AdminReportQueryInput,
  ResolveReportInput,
} from '@chatlock/validation';
import { adminService, type AdminService } from '../services/admin.service.js';
import { UnauthorizedError } from '../errors/app-error.js';

export class AdminController {
  constructor(private readonly admin: AdminService = adminService) {}

  private extractContext(req: Request) {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    return {
      adminUserId: req.user.id,
      adminUsername: req.user.username,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }

  public getDashboard = async (
    _req: Request,
    res: Response<ApiResponse<AdminDashboardData>>,
  ): Promise<void> => {
    const data = await this.admin.getDashboard();
    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  };

  public listUsers = async (
    req: Request<unknown, unknown, unknown, AdminUserQueryInput>,
    res: Response<
      ApiResponse<{
        users: AdminUserListItem[];
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
          hasNextPage: boolean;
          hasPrevPage: boolean;
        };
      }>
    >,
  ): Promise<void> => {
    const data = await this.admin.listUsers(req.query);
    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  };

  public getUserDetail = async (
    req: Request<{ userId: string }>,
    res: Response<ApiResponse<AdminUserDetail>>,
  ): Promise<void> => {
    const context = this.extractContext(req);
    const data = await this.admin.getUserDetail(req.params.userId, context);
    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  };

  public suspendUser = async (
    req: Request<{ userId: string }, unknown, AdminStatusUpdateInput>,
    res: Response<ApiResponse<AdminUserListItem>>,
  ): Promise<void> => {
    const context = this.extractContext(req);
    const data = await this.admin.suspendUser(req.params.userId, req.body.reason, context);
    res.status(200).json({
      success: true,
      message: 'User account has been suspended',
      data,
      timestamp: new Date().toISOString(),
    });
  };

  public unsuspendUser = async (
    req: Request<{ userId: string }, unknown, AdminStatusUpdateInput>,
    res: Response<ApiResponse<AdminUserListItem>>,
  ): Promise<void> => {
    const context = this.extractContext(req);
    const data = await this.admin.unsuspendUser(req.params.userId, req.body.reason, context);
    res.status(200).json({
      success: true,
      message: 'User account has been unsuspended',
      data,
      timestamp: new Date().toISOString(),
    });
  };

  public banUser = async (
    req: Request<{ userId: string }, unknown, AdminStatusUpdateInput>,
    res: Response<ApiResponse<AdminUserListItem>>,
  ): Promise<void> => {
    const context = this.extractContext(req);
    const data = await this.admin.banUser(req.params.userId, req.body.reason, context);
    res.status(200).json({
      success: true,
      message: 'User account has been permanently banned',
      data,
      timestamp: new Date().toISOString(),
    });
  };

  public unbanUser = async (
    req: Request<{ userId: string }, unknown, AdminStatusUpdateInput>,
    res: Response<ApiResponse<AdminUserListItem>>,
  ): Promise<void> => {
    const context = this.extractContext(req);
    const data = await this.admin.unbanUser(req.params.userId, req.body.reason, context);
    res.status(200).json({
      success: true,
      message: 'User account has been unbanned',
      data,
      timestamp: new Date().toISOString(),
    });
  };

  public listAuditLogs = async (
    req: Request<unknown, unknown, unknown, AdminAuditLogQueryInput>,
    res: Response<
      ApiResponse<{
        logs: AdminAuditLogItem[];
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
          hasNextPage: boolean;
          hasPrevPage: boolean;
        };
      }>
    >,
  ): Promise<void> => {
    const data = await this.admin.listAuditLogs(req.query);
    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  };

  public listReports = async (
    req: Request<unknown, unknown, unknown, { page?: number; limit?: number; status?: string }>,
    res: Response<
      ApiResponse<{
        reports: AdminReportItem[];
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
          hasNextPage: boolean;
          hasPrevPage: boolean;
        };
      }>
    >,
  ): Promise<void> => {
    const data = await this.admin.listReports(req.query as AdminReportQueryInput);
    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  };

  public getReportDetail = async (
    req: Request<{ id: string }>,
    res: Response<
      ApiResponse<{
        report: AdminReportItem;
        targetUserModerationHistory: AdminAuditLogItem[];
      }>
    >,
  ): Promise<void> => {
    const context = this.extractContext(req);
    const data = await this.admin.getReportDetail(req.params.id, context);
    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  };

  public resolveReport = async (
    req: Request<{ id: string }, unknown, ResolveReportInput>,
    res: Response<ApiResponse<AdminReportItem>>,
  ): Promise<void> => {
    const context = this.extractContext(req);
    const data = await this.admin.resolveReport(req.params.id, req.body, context);
    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  };

  public listGroups = async (
    req: Request<unknown, unknown, unknown, { page?: number; limit?: number }>,
    res: Response<
      ApiResponse<{
        groups: AdminGroupItem[];
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
          hasNextPage: boolean;
          hasPrevPage: boolean;
        };
      }>
    >,
  ): Promise<void> => {
    const data = await this.admin.listGroups(req.query);
    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  };

  public listMedia = async (
    req: Request<unknown, unknown, unknown, { page?: number; limit?: number }>,
    res: Response<
      ApiResponse<{
        media: AdminMediaItem[];
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
          hasNextPage: boolean;
          hasPrevPage: boolean;
        };
      }>
    >,
  ): Promise<void> => {
    const data = await this.admin.listMedia(req.query);
    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  };

  public getSettings = async (
    _req: Request,
    res: Response<ApiResponse<AdminSettingsData>>,
  ): Promise<void> => {
    const data = this.admin.getSystemSettings();
    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  };
}

export const adminController = new AdminController();
