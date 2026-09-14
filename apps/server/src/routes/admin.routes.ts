import { Router } from 'express';
import {
  adminUserQuerySchema,
  adminStatusUpdateSchema,
  adminAuditLogQuerySchema,
  adminReportQuerySchema,
  resolveReportSchema,
} from '@chatlock/validation';
import { requireAuth, requireAdmin, validate } from '../middleware/index.js';
import { adminController } from '../controllers/admin.controller.js';
import { asyncHandler } from '../utils/async-handler.js';

const router: Router = Router();

// Enforce both Authentication and Admin RBAC on all admin routes
router.use(requireAuth);
router.use(requireAdmin);

// Admin Dashboard Overview
router.get('/dashboard', asyncHandler(adminController.getDashboard));

// User Management
router.get(
  '/users',
  validate({ query: adminUserQuerySchema }),
  asyncHandler(adminController.listUsers),
);
router.get('/users/:userId', asyncHandler(adminController.getUserDetail));
router.patch(
  '/users/:userId/suspend',
  validate({ body: adminStatusUpdateSchema }),
  asyncHandler(adminController.suspendUser),
);
router.patch(
  '/users/:userId/unsuspend',
  validate({ body: adminStatusUpdateSchema }),
  asyncHandler(adminController.unsuspendUser),
);
router.patch(
  '/users/:userId/ban',
  validate({ body: adminStatusUpdateSchema }),
  asyncHandler(adminController.banUser),
);
router.patch(
  '/users/:userId/unban',
  validate({ body: adminStatusUpdateSchema }),
  asyncHandler(adminController.unbanUser),
);

// Audit Logging
router.get(
  '/audit-logs',
  validate({ query: adminAuditLogQuerySchema }),
  asyncHandler(adminController.listAuditLogs),
);

// Reports Management & Abuse Moderation
router.get(
  '/reports',
  validate({ query: adminReportQuerySchema }),
  asyncHandler(adminController.listReports),
);
router.get('/reports/:id', asyncHandler(adminController.getReportDetail));
router.post(
  '/reports/:id/resolve',
  validate({ body: resolveReportSchema }),
  asyncHandler(adminController.resolveReport),
);

// Group Chats Moderation (Task 34 extension point)
router.get('/groups', asyncHandler(adminController.listGroups));

// Media Moderation (Task 35 extension point)
router.get('/media', asyncHandler(adminController.listMedia));

// Platform System Settings
router.get('/settings', asyncHandler(adminController.getSettings));

export default router;
