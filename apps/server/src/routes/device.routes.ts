import { Router } from 'express';
import { deviceController } from '../controllers/device.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router: Router = Router();

// Require authentication for all device endpoints
router.use(requireAuth);

router.post('/push-token', asyncHandler(deviceController.registerPushToken));

export default router;
