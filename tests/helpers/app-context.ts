import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/api/app.js';
import { prisma } from '../../src/api/prisma.js';

let cachedApp: FastifyInstance | null = null;

export async function getApp(): Promise<FastifyInstance> {
  if (cachedApp) return cachedApp;
  cachedApp = await buildApp({ logger: false, rateLimitMax: 1_000_000 });
  await cachedApp.ready();
  return cachedApp;
}

export async function closeApp(): Promise<void> {
  if (cachedApp) {
    await cachedApp.close();
    cachedApp = null;
  }
  await prisma.$disconnect();
}

export interface ListenedApp {
  url: string;
  app: FastifyInstance;
  close: () => Promise<void>;
}

export async function listenApp(port = 0): Promise<ListenedApp> {
  const app = await buildApp({ logger: false, rateLimitMax: 1_000_000 });
  const address = await app.listen({ host: '127.0.0.1', port });
  return {
    url: typeof address === 'string' ? address : `http://127.0.0.1:${port}`,
    app,
    close: async () => {
      await app.close();
    },
  };
}
