import { Router } from 'express';
import healthRoutes from '../health.routes.js';
import authRoutes from '../auth.routes.js';
import conversationRoutes from '../conversation.routes.js';
import userRoutes from '../user.routes.js';
import mediaRoutes from '../media.routes.js';
import deviceRoutes from '../device.routes.js';
import adminRoutes from '../admin.routes.js';
import e2eeRoutes from '../e2ee.routes.js';
import reportRoutes from '../report.routes.js';
import docsRoutes from '../docs.routes.js';

const v1Router: Router = Router();

// Mount health, auth, conversation, user, media, device, admin, e2ee, report, and docs routes under API v1 prefix
v1Router.use('/health', healthRoutes);
v1Router.use('/auth', authRoutes);
v1Router.use('/conversations', conversationRoutes);
v1Router.use('/users', userRoutes);
v1Router.use('/media', mediaRoutes);
v1Router.use('/devices', deviceRoutes);
v1Router.use('/admin', adminRoutes);
v1Router.use('/e2ee', e2eeRoutes);
v1Router.use('/reports', reportRoutes);
v1Router.use('/docs', docsRoutes);

export default v1Router;
