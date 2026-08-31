import { Router } from 'express';
import { userController } from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  userSearchQuerySchema,
  conversationIdParamsSchema,
  updateProfileSchema,
} from '@chatlock/validation';
import { asyncHandler } from '../utils/async-handler.js';

const router: Router = Router();

// Require authentication for all user endpoints
router.use(requireAuth);

router.get('/me', asyncHandler(userController.getMe));

router.patch('/me', validate({ body: updateProfileSchema }), asyncHandler(userController.updateMe));

router.get(
  '/search',
  validate({ query: userSearchQuerySchema }),
  asyncHandler(userController.searchUsers),
);

router.get(
  '/:id',
  validate({ params: conversationIdParamsSchema }),
  asyncHandler(userController.getUserById),
);

export default router;
