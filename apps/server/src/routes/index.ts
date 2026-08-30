import { Router } from 'express';
import healthRoutes from './health.routes.js';
import v1Router from './v1/index.js';
import { config } from '../config/index.js';

export function createApiRouter(): Router {
  const router = Router();

  // Root /health endpoints (for external load balancers and container orchestrators)
  router.use('/health', healthRoutes);

  // Prefixed API routes (/api/v1)
  router.use(config.app.apiPrefix, v1Router);

  return router;
}

export default createApiRouter;
