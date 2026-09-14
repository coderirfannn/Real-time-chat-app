import { BaseRepository, type PaginatedResult } from './base.repository.js';
import { AuditLogModel, type IAuditLogDoc } from '../models/audit-log.model.js';

export interface RecordAuditLogParams {
  adminUserId: string;
  adminUsername: string;
  action: string;
  targetId?: string;
  targetType?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogPaginationOptions {
  page: number;
  limit: number;
  action?: string;
  adminId?: string;
  targetId?: string;
}

export class AuditLogRepository extends BaseRepository<IAuditLogDoc> {
  constructor() {
    super(AuditLogModel);
  }

  public async recordLog(params: RecordAuditLogParams): Promise<IAuditLogDoc> {
    // Strictly ensure no sensitive fields are saved in metadata
    const safeMetadata = { ...params.metadata };
    delete safeMetadata['password'];
    delete safeMetadata['passwordHash'];
    delete safeMetadata['token'];
    delete safeMetadata['accessToken'];
    delete safeMetadata['refreshToken'];
    delete safeMetadata['secret'];

    return this.create({
      adminUserId: params.adminUserId as unknown as IAuditLogDoc['adminUserId'],
      adminUsername: params.adminUsername,
      action: params.action,
      targetId: params.targetId,
      targetType: params.targetType || 'USER',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      requestId: params.requestId,
      metadata: safeMetadata,
    });
  }

  public async findPaginatedLogs(
    options: AuditLogPaginationOptions,
  ): Promise<PaginatedResult<IAuditLogDoc>> {
    const filter: Record<string, unknown> = {};

    if (options.action) {
      filter['action'] = options.action;
    }
    if (options.adminId) {
      filter['adminUserId'] = options.adminId;
    }
    if (options.targetId) {
      filter['targetId'] = options.targetId;
    }

    return this.paginate(filter, {
      page: options.page,
      limit: options.limit,
      sort: { createdAt: -1 },
    });
  }

  public async findRecentLogs(limit = 10): Promise<IAuditLogDoc[]> {
    return this.model.find({}).sort({ createdAt: -1 }).limit(limit).exec();
  }

  public async findByTarget(targetId: string, limit = 20): Promise<IAuditLogDoc[]> {
    return this.model.find({ targetId }).sort({ createdAt: -1 }).limit(limit).exec();
  }
}

export const auditLogRepository = new AuditLogRepository();
