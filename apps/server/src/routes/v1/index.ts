import { Router } from 'express';
import healthRoutes from '../health.routes.js';
import authRoutes from '../auth.routes.js';
import conversationRoutes from '../conversation.routes.js';

const v1Router: Router = Router();

// Mount health, auth, and conversation routes under API v1 prefix
v1Router.use('/health', healthRoutes);
v1Router.use('/auth', authRoutes);
v1Router.use('/conversations', conversationRoutes);

export default v1Router;
