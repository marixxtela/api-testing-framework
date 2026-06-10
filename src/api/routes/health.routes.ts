import type { FastifyPluginAsync } from 'fastify';
import { HealthSchema } from '../schemas.js';
import { prisma } from '../prisma.js';

const startedAt = Date.now();
const version = process.env.npm_package_version ?? '0.0.0';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/health',
    {
      logLevel: 'warn',
      schema: {
        tags: ['health'],
        summary: 'Liveness probe',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok'] },
              uptime: { type: 'number' },
              version: { type: 'string' },
            },
            required: ['status', 'uptime', 'version'],
          },
        },
      },
    },
    async () => {
      return HealthSchema.parse({
        status: 'ok' as const,
        uptime: (Date.now() - startedAt) / 1000,
        version,
      });
    },
  );

  app.get(
    '/ready',
    {
      logLevel: 'warn',
      schema: {
        tags: ['health'],
        summary: 'Readiness probe with database check',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ready'] },
              checks: {
                type: 'object',
                properties: {
                  database: { type: 'string', enum: ['up'] },
                },
                required: ['database'],
              },
            },
            required: ['status', 'checks'],
          },
          503: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['not_ready'] },
              checks: {
                type: 'object',
                properties: {
                  database: { type: 'string', enum: ['up', 'down'] },
                },
                required: ['database'],
              },
            },
            required: ['status', 'checks'],
          },
        },
      },
    },
    async (_request, reply) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return reply.status(200).send({
          status: 'ready' as const,
          checks: { database: 'up' as const },
        });
      } catch {
        return reply.status(503).send({
          status: 'not_ready' as const,
          checks: { database: 'down' as const },
        });
      }
    },
  );
};
