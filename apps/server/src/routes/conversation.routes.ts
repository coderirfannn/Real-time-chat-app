import { Router } from 'express';
import {
  createDirectConversationSchema,
  conversationPaginationSchema,
  conversationIdParamsSchema,
  messageCursorPaginationSchema,
} from '@chatlock/validation';
import { conversationController } from '../controllers/conversation.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router: Router = Router();

// All conversation routes require authentication
router.use(requireAuth);

router.get(
  '/',
  validate({ query: conversationPaginationSchema }),
  asyncHandler(conversationController.listConversations),
);

router.post(
  '/',
  validate({ body: createDirectConversationSchema }),
  asyncHandler(conversationController.createConversation),
);

router.get(
  '/:id',
  validate({ params: conversationIdParamsSchema }),
  asyncHandler(conversationController.getConversation),
);

router.get(
  '/:id/messages',
  validate({
    params: conversationIdParamsSchema,
    query: messageCursorPaginationSchema,
  }),
  asyncHandler(conversationController.listMessages),
);

export default router;
