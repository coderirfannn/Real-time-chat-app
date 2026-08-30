import type { Server } from 'http';
import { createApp } from './app.js';
import { config } from './config/index.js';

export interface RunningServer {
  server: Server;
  stop: () => Promise<void>;
}

export function startServer(port: number = config.app.port): Promise<RunningServer> {
  const app = createApp();

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.info(
        `[${config.app.appName}] Server running on port ${port} in ${config.app.env} mode`,
      );
      // eslint-disable-next-line no-console
      console.info(`[${config.app.appName}] Health check: http://localhost:${port}/health`);

      const stop = (): Promise<void> => {
        return new Promise((res, rej) => {
          server.close((err) => {
            if (err) rej(err);
            else res();
          });
        });
      };

      resolve({ server, stop });
    });
  });
}
