import { startServer } from './server.js';
import { logger } from './utils/logger.js';
import { config } from './config/index.js';

const appLogger = logger.child('Bootstrap');

async function bootstrap(): Promise<void> {
  try {
    const running = await startServer({
      port: config.app.port,
      connectDatabase: true,
      connectRedis: true,
    });

    let isShuttingDown = false;

    const handleShutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      appLogger.info(`Received ${signal}. Initiating graceful termination sequence...`);

      const forceExitTimeout = setTimeout(() => {
        appLogger.error('Graceful shutdown timed out. Forcing process exit.');
        process.exit(1);
      }, 10000);

      try {
        await running.stop();
        clearTimeout(forceExitTimeout);
        appLogger.info('All subsystems shut down cleanly. Exiting.');
        process.exit(0);
      } catch (err) {
        clearTimeout(forceExitTimeout);
        appLogger.error('Error during shutdown sequence', err as Error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    process.on('uncaughtException', (err: Error) => {
      appLogger.fatal('Uncaught Exception detected', err);
      void handleShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason: unknown) => {
      appLogger.fatal(
        'Unhandled Promise Rejection detected',
        reason instanceof Error ? reason : new Error(String(reason)),
      );
      void handleShutdown('unhandledRejection');
    });
  } catch (error) {
    appLogger.fatal('Fatal error during application startup', error as Error);
    process.exit(1);
  }
}

void bootstrap();
