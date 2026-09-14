import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../errors/app-error.js';
import { userRepository, type UserRepository } from '../repositories/user.repository.js';
import { logger } from '../utils/logger.js';

const adminLogger = logger.child('AdminMiddleware');

/**
 * Server-side Admin Authorization Middleware.
 *
 * Enforces zero-trust RBAC:
 * 1. Verifies the request is authenticated via Bearer JWT (req.user).
 * 2. Fetches the live User record directly from MongoDB (single source of truth).
 *    Never trusts client-supplied roles in body, query, headers, local storage, or sockets.
 * 3. Enforces account status: rejects SUSPENDED and BANNED users immediately with HTTP 403.
 * 4. Enforces role: strictly requires user.role === 'ADMIN'. Non-admin users receive HTTP 403.
 * 5. Attaches the verified admin user document to req.adminUser.
 */
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
  userRepo: UserRepository = userRepository,
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedError('Authentication token is required');
    }

    const user = await userRepo.findById(req.user.id);
    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    if (user.accountStatus === 'SUSPENDED') {
      adminLogger.warn('Suspended user attempted admin access', {
        userId: user.id,
        email: user.email,
      });
      throw new ForbiddenError('Your account has been suspended');
    }

    if (user.accountStatus === 'BANNED') {
      adminLogger.warn('Banned user attempted admin access', {
        userId: user.id,
        email: user.email,
      });
      throw new ForbiddenError('Your account has been banned');
    }

    if (user.role !== 'ADMIN') {
      adminLogger.warn('Unauthorized admin access attempt by non-admin user', {
        userId: user.id,
        username: user.username,
        role: user.role,
        path: req.originalUrl,
        ip: req.ip,
      });
      throw new ForbiddenError('Administrative privileges required');
    }

    req.adminUser = user;
    next();
  } catch (error) {
    next(error);
  }
}
