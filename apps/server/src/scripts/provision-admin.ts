/* eslint-disable no-console */
import { connectMongo, disconnectMongo } from '../database/connection.js';
import { userRepository } from '../repositories/user.repository.js';
import { auditLogRepository } from '../repositories/audit-log.repository.js';
import { logger } from '../utils/logger.js';

const scriptLogger = logger.child('AdminProvisionScript');

async function main() {
  const target = process.argv[2];

  if (!target) {
    console.error('Usage: pnpm run admin:promote <email-or-username>');
    process.exit(1);
  }

  const cleanTarget = target.toLowerCase().trim();
  console.log(`[ProvisionAdmin] Connecting to database...`);
  await connectMongo();

  try {
    const user =
      (await userRepository.findByEmail(cleanTarget)) ||
      (await userRepository.findByUsername(cleanTarget));

    if (!user) {
      console.error(`[ProvisionAdmin] Error: User '${cleanTarget}' not found in database.`);
      process.exit(1);
    }

    if (user.role === 'ADMIN') {
      console.log(`[ProvisionAdmin] User '${user.username}' (${user.email}) is already an ADMIN.`);
      return;
    }

    await userRepository.updateRole(user.id, 'ADMIN');

    await auditLogRepository.recordLog({
      adminUserId: user.id,
      adminUsername: 'SYSTEM_PROVISION_CLI',
      action: 'USER_PROMOTED_ADMIN',
      targetId: user.id,
      targetType: 'USER',
      metadata: {
        reason: 'Promoted via server-side CLI provision script',
        username: user.username,
        email: user.email,
      },
    });

    console.log(
      `[ProvisionAdmin] Success! User '${user.username}' (${user.email}) has been successfully promoted to ADMIN.`,
    );
    scriptLogger.info('User promoted to admin via CLI script', {
      userId: user.id,
      username: user.username,
    });
  } finally {
    await disconnectMongo();
  }
}

main().catch((err) => {
  console.error('[ProvisionAdmin] Fatal error:', err);
  process.exit(1);
});
