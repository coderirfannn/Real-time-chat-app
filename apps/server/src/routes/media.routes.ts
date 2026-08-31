import express, { Router } from 'express';
import { mediaController } from '../controllers/media.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { requestUploadUrlSchema } from '@chatlock/validation';
import { asyncHandler } from '../utils/async-handler.js';

const router: Router = Router();

// 1. Request signed upload URL (Protected)
router.post(
  '/upload-url',
  requireAuth,
  validate({ body: requestUploadUrlSchema }),
  asyncHandler(mediaController.requestUploadUrl),
);

// 2. Direct binary upload handler (Local storage driver)
router.put(
  '/upload/*',
  express.raw({ type: '*/*', limit: '30mb' }),
  asyncHandler(mediaController.uploadLocalFile),
);

// 3. Public static file serve with security headers (Local storage driver)
router.get('/files/*', asyncHandler(mediaController.serveLocalFile));

export default router;
