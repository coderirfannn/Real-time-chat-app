import { UserModel } from '../models/user.model.js';
import { hashPassword } from '../utils/password.js';
import { auditLogRepository } from '../repositories/audit-log.repository.js';
import { logger } from '../utils/logger.js';

const bootstrapLogger = logger.child('BootstrapAdmin');

export const DEFAULT_ADMIN = {
  email: 'admin@chatlock.com',
  username: 'admin',
  displayName: 'Administrator',
  password: 'admin@11920',
};

/**
 * Ensures the default administrator account exists with ACTIVE status and ADMIN role.
 * If the user already exists, updates password, role to ADMIN, and status to ACTIVE.
 * If the user does not exist, creates the account.
 */
export async function bootstrapDefaultAdmin(): Promise<void> {
  try {
    const existing = await UserModel.findOne({
      $or: [{ email: DEFAULT_ADMIN.email }, { username: DEFAULT_ADMIN.username }],
    }).exec();

    const passwordHash = await hashPassword(DEFAULT_ADMIN.password);

    if (existing) {
      existing.email = DEFAULT_ADMIN.email;
      existing.role = 'ADMIN';
      existing.accountStatus = 'ACTIVE';
      existing.passwordHash = passwordHash;
      existing.isEmailVerified = true;
      await existing.save();

      bootstrapLogger.info('Default admin account synchronized', {
        userId: existing.id,
        email: existing.email,
        role: existing.role,
      });
      return;
    }

    const newAdmin = await UserModel.create({
      email: DEFAULT_ADMIN.email,
      username: DEFAULT_ADMIN.username,
      displayName: DEFAULT_ADMIN.displayName,
      passwordHash,
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      status: 'offline',
      isEmailVerified: true,
      twoFactorEnabled: false,
    });

    await auditLogRepository.recordLog({
      adminUserId: newAdmin.id,
      adminUsername: 'SYSTEM_BOOTSTRAP',
      action: 'ADMIN_BOOTSTRAPPED',
      targetId: newAdmin.id,
      targetType: 'USER',
      metadata: {
        email: newAdmin.email,
        username: newAdmin.username,
        role: 'ADMIN',
      },
    });

    bootstrapLogger.info('Default admin account created successfully', {
      userId: newAdmin.id,
      email: newAdmin.email,
      username: newAdmin.username,
    });
  } catch (err) {
    bootstrapLogger.error('Failed to bootstrap default admin user', err as Error);
  }
}
