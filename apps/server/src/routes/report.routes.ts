import { Router } from 'express';
import { createReportSchema } from '@chatlock/validation';
import { requireAuth, validate, reportRateLimiter } from '../middleware/index.js';
import { reportController } from '../controllers/report.controller.js';
import { asyncHandler } from '../utils/async-handler.js';

const router: Router = Router();

// All report endpoints require user authentication
router.use(requireAuth);

// Submit report with validation and rate limiting
router.post(
  '/',
  reportRateLimiter,
  validate({ body: createReportSchema }),
  asyncHandler(reportController.createReport),
);

// View user's own submitted report history
router.get('/my-reports', asyncHandler(reportController.getMyReports));

export default router;
