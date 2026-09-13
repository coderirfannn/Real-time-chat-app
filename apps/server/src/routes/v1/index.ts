import { Router } from 'express';
import healthRoutes from '../health.routes.js';
import authRoutes from '../auth.routes.js';
import conversationRoutes from '../conversation.routes.js';
import userRoutes from '../user.routes.js';
import mediaRoutes from '../media.routes.js';
import deviceRoutes from '../device.routes.js';

const v1Router: Router = Router();

// Mount health, auth, conversation, user, media, and device routes under API v1 prefix
v1Router.use('/health', healthRoutes);
v1Router.use('/auth', authRoutes);
v1Router.use('/conversations', conversationRoutes);
v1Router.use('/users', userRoutes);
v1Router.use('/media', mediaRoutes);
v1Router.use('/devices', deviceRoutes);

export default v1Router;
