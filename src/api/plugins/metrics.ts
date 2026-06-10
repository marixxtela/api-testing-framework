import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { config } from '../config.js';

const plugin: FastifyPluginAsync = async (app) => {
  if (!config.METRICS_ENABLED) return;

  const registry = new Registry();
  registry.setDefaultLabels({ service: 'api-testing-framework' });
  collectDefaultMetrics({ register: registry });

  const requestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests by route, method, and status',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [registry],
  });

  const requestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const inflight = new Counter({
    name: 'http_requests_inflight_total',
    help: 'Cumulative counter of started requests',
    labelNames: ['method'] as const,
    registers: [registry],
  });

  app.addHook('onRequest', async (request: FastifyRequest) => {
    inflight.inc({ method: request.method });
    (request as FastifyRequest & { startHrTime: bigint }).startHrTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const route = request.routeOptions?.url ?? request.url;
    if (route === config.METRICS_PATH) return;
    const start = (request as FastifyRequest & { startHrTime?: bigint }).startHrTime;
    const seconds = start ? Number(process.hrtime.bigint() - start) / 1e9 : 0;
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    };
    requestsTotal.inc(labels);
    requestDuration.observe(labels, seconds);
  });

  app.get(
    config.METRICS_PATH,
    {
      logLevel: 'warn',
      schema: { hide: true },
    },
    async (_request, reply) => {
      reply.header('content-type', registry.contentType);
      return registry.metrics();
    },
  );

  app.decorate('metricsRegistry', registry);
};

declare module 'fastify' {
  interface FastifyInstance {
    metricsRegistry?: Registry;
  }
}

export default fp(plugin, { name: 'metrics' });
