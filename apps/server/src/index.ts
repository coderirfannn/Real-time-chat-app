import { startServer } from './server.js';
import { config } from './config/index.js';

async function bootstrap(): Promise<void> {
  try {
    const running = await startServer(config.app.port);

    const shutdown = async (signal: string) => {
      // eslint-disable-next-line no-console
      console.info(`\nReceived ${signal}. Shutting down gracefully...`);
      try {
        await running.stop();
        // eslint-disable-next-line no-console
        console.info('Server stopped gracefully. Exiting process.');
        process.exit(0);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error during graceful shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

void bootstrap();
