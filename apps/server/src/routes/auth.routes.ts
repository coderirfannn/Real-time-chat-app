import { Router } from 'express';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
} from '@chatlock/validation';
import { authController } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rate-limit.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router: Router = Router();

// Public routes with rate limiting
router.post(
  '/register',
  authRateLimiter,
  validate({ body: registerSchema }),
  asyncHandler(authController.register),
);

router.post(
  '/login',
  authRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(authController.login),
);

router.post(
  '/refresh',
  validate({ body: refreshTokenSchema }),
  asyncHandler(authController.refreshToken),
);

// Logout (can be called with refreshToken body and/or Bearer token)
router.post(
  '/logout',
  optionalAuth,
  validate({ body: logoutSchema }),
  asyncHandler(authController.logout),
);

// Protected routes requiring valid Bearer JWT
router.post('/logout-all', requireAuth, asyncHandler(authController.logoutAll));
router.get('/me', requireAuth, asyncHandler(authController.getMe));

export default router;
