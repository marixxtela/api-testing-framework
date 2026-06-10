import 'dotenv/config';
import { buildApp } from './app.js';
import { config } from './config.js';
import { prisma } from './prisma.js';

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

async function start(): Promise<void> {
  const app = await buildApp();

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'shutdown started');

    const timeout = setTimeout(() => {
      app.log.error(
        { timeoutMs: config.SHUTDOWN_TIMEOUT_MS },
        'shutdown exceeded timeout, forcing exit',
      );
      process.exit(1);
    }, config.SHUTDOWN_TIMEOUT_MS);
    timeout.unref();

    try {
      await app.close();
      await prisma.$disconnect();
      clearTimeout(timeout);
      app.log.info('shutdown complete');
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'shutdown failed');
      clearTimeout(timeout);
      process.exit(1);
    }
  };

  for (const signal of SHUTDOWN_SIGNALS) {
    process.on(signal, () => {
      void shutdown(signal);
    });
  }

  process.on('uncaughtException', (error) => {
    app.log.fatal({ err: error }, 'uncaughtException, exiting');
    void shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    app.log.fatal({ err: reason }, 'unhandledRejection, exiting');
    void shutdown('unhandledRejection');
  });

  try {
    await app.listen({ host: config.API_HOST, port: config.API_PORT });
  } catch (error) {
    app.log.error({ err: error }, 'failed to start API');
    process.exit(1);
  }
}

void start();
