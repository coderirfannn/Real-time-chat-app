import http, { type Server } from 'http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { connectMongo, disconnectMongo } from './database/connection.js';
import { connectRedis, disconnectRedis } from './redis/client.js';
import { initSocketServer, closeSocketIO } from './socket/index.js';
import { logger } from './utils/logger.js';

const serverLogger = logger.child('Server');

export interface RunningServer {
  server: Server;
  stop: () => Promise<void>;
}

export interface ServerOptions {
  port?: number;
  connectDatabase?: boolean;
  connectRedis?: boolean;
}

export async function startServer(options: ServerOptions = {}): Promise<RunningServer> {
  const port = options.port ?? config.app.port;
  const shouldConnectDb = options.connectDatabase ?? true;
  const shouldConnectRedis = options.connectRedis ?? true;

  // 1. Initialize database connection if enabled
  if (shouldConnectDb) {
    try {
      await connectMongo();
    } catch (err) {
      serverLogger.error('Failed to establish initial MongoDB connection', err as Error);
      if (config.app.isProduction) {
        throw err;
      }
    }
  }

  // 2. Initialize Redis connection if enabled
  if (shouldConnectRedis) {
    try {
      await connectRedis();
    } catch (err) {
      serverLogger.error('Failed to establish initial Redis connection', err as Error);
      if (config.app.isProduction) {
        throw err;
      }
    }
  }

  // 3. Create Express app and HTTP server
  const app = createApp();
  const server = http.createServer(app);

  // 4. Attach Socket.IO gateway
  initSocketServer(server);

  return new Promise((resolve) => {
    server.listen(port, '0.0.0.0', () => {
      serverLogger.info(`Server running on port ${port} in [${config.app.env}] mode`, {
        port,
        env: config.app.env,
        pid: process.pid,
      });

      const stop = async (): Promise<void> => {
        serverLogger.info('Initiating graceful server shutdown...');

        // 1. Close Socket.IO server
        try {
          await closeSocketIO();
        } catch (err) {
          serverLogger.error('Error closing Socket.IO during shutdown', err as Error);
        }

        // 2. Close HTTP server
        await new Promise<void>((res, rej) => {
          server.close((err) => {
            if (err) rej(err);
            else {
              serverLogger.info('HTTP server stopped accepting connections');
              res();
            }
          });
        });

        // 3. Disconnect Redis
        try {
          await disconnectRedis();
        } catch (err) {
          serverLogger.error('Error disconnecting Redis during shutdown', err as Error);
        }

        // 4. Disconnect MongoDB
        try {
          await disconnectMongo();
        } catch (err) {
          serverLogger.error('Error disconnecting MongoDB during shutdown', err as Error);
        }

        serverLogger.info('Graceful shutdown completed');
      };

      resolve({ server, stop });
    });
  });
}
