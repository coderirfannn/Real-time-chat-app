import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@chatlock/shared-types';
import { UnauthorizedError } from '../errors/app-error.js';
import { verifyAccessToken } from '../utils/token.js';
import type { IUserDoc } from '../models/user.model.js';

export interface AuthUserContext {
  id: string;
  email: string;
  username: string;
  role?: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUserContext;
      adminUser?: IUserDoc;
    }
  }
}

/**
 * Reusable authentication middleware that requires a valid Bearer JWT.
 * Attaches verified user context to req.user.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication token is required');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new UnauthorizedError('Authentication token is required');
  }

  const payload = verifyAccessToken(token);

  req.user = {
    id: payload.sub,
    email: payload.email,
    username: payload.username,
    role: payload.role,
  };

  next();
}

/**
 * Optional authentication middleware.
 * If a valid Bearer JWT is provided, attaches req.user; otherwise continues without error.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        req.user = {
          id: payload.sub,
          email: payload.email,
          username: payload.username,
          role: payload.role,
        };
      } catch {
        // Ignore errors in optional auth
      }
    }
  }

  next();
}
