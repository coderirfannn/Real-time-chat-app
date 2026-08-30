import { Router } from 'express';
import { healthController } from '../controllers/health.controller.js';
import { asyncHandler } from '../utils/async-handler.js';

const router: Router = Router();

router.get('/', asyncHandler(healthController.getHealth));
router.get('/live', asyncHandler(healthController.getLiveness));
router.get('/ready', asyncHandler(healthController.getReadiness));

export default router;
