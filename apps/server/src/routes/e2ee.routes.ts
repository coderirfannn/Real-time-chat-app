import { Router } from 'express';
import { e2eeController } from '../controllers/e2ee.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router: Router = Router();

// Strict zero-trust authentication requirement for all E2EE endpoints
router.use(requireAuth);

// Key bundle registration & retrieval
router.post('/keys/register', asyncHandler(e2eeController.registerKeys));
router.get('/keys/:userId', asyncHandler(e2eeController.getPeerBundle));

// Pre-key replenishment & signed pre-key rotation
router.post('/prekeys/replenish', asyncHandler(e2eeController.replenishPreKeys));
router.post('/signed-prekey/rotate', asyncHandler(e2eeController.rotateSignedPreKey));

// Device status, enumeration, and revocation
router.get('/devices/me', asyncHandler(e2eeController.getMyDeviceStatus));
router.get('/users/:userId/devices', asyncHandler(e2eeController.getUserDevices));
router.patch('/devices/:deviceId/revoke', asyncHandler(e2eeController.revokeDevice));

export default router;
