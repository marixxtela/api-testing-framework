import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import compress from '@fastify/compress';
import underPressure from '@fastify/under-pressure';
import mercurius from 'mercurius';
import { config } from './config.js';
import authPlugin from './plugins/auth.js';
import errorHandler from './plugins/error-handler.js';
import metricsPlugin from './plugins/metrics.js';
import requestContext from './plugins/request-context.js';
import { healthRoutes } from './routes/health.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { usersRoutes } from './routes/users.routes.js';
import { ordersRoutes } from './routes/orders.routes.js';
import { schema as gqlSchema } from './graphql/schema.js';
import { resolvers as gqlResolvers } from './graphql/resolvers.js';

export interface BuildOptions {
  logger?: boolean | object;
  rateLimitMax?: number;
}

const parseOrigins = (raw: string): boolean | string[] => {
  if (raw === '*' || raw === '') return true;
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
};

const isProd = config.NODE_ENV === 'production';

export async function buildApp(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: config.TRUST_PROXY,
    bodyLimit: config.BODY_LIMIT_BYTES,
    connectionTimeout: config.REQUEST_TIMEOUT_MS,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
    genReqId: (req) => {
      const headerId = req.headers['x-request-id'] ?? req.headers['x-correlation-id'];
      if (typeof headerId === 'string' && headerId.length > 0) return headerId;
      return randomUUID();
    },
    logger:
      opts.logger ??
      (config.NODE_ENV === 'test'
        ? false
        : {
            level: config.LOG_LEVEL,
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-api-key"]',
                'res.headers["set-cookie"]',
                '*.password',
                '*.passwordHash',
                '*.token',
              ],
              remove: true,
            },
            transport:
              config.NODE_ENV === 'development'
                ? {
                    target: 'pino-pretty',
                    options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
                  }
                : undefined,
          }),
    disableRequestLogging: config.NODE_ENV === 'test',
    ajv: {
      customOptions: { removeAdditional: 'all', useDefaults: true, coerceTypes: true },
    },
  });

  await app.register(requestContext);

  await app.register(helmet, {
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(cors, {
    origin: parseOrigins(config.CORS_ORIGINS),
    credentials: true,
  });

  await app.register(compress, {
    encodings: ['br', 'gzip', 'deflate'],
    threshold: 1024,
  });

  await app.register(rateLimit, {
    max: opts.rateLimitMax ?? config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    addHeadersOnExceeding: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true },
    addHeaders: { 'retry-after': true, 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true },
  });

  if (config.NODE_ENV !== 'test') {
    await app.register(underPressure, {
      maxEventLoopDelay: 1000,
      maxHeapUsedBytes: 512 * 1024 * 1024,
      maxRssBytes: 768 * 1024 * 1024,
      maxEventLoopUtilization: 0.98,
      retryAfter: 50,
      exposeStatusRoute: false,
    });
  }

  app.addSchema({
    $id: 'User',
    type: 'object',
    required: ['id', 'email', 'name', 'role', 'createdAt', 'metadata'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email' },
      name: { type: 'string', minLength: 1, maxLength: 120 },
      role: { type: 'string', enum: ['admin', 'user', 'guest'] },
      createdAt: { type: 'string', format: 'date-time' },
      metadata: {
        type: 'object',
        required: ['lastLogin', 'loginCount'],
        properties: {
          lastLogin: { type: 'string', format: 'date-time', nullable: true },
          loginCount: { type: 'integer', minimum: 0 },
        },
      },
    },
  });

  app.addSchema({
    $id: 'UserList',
    type: 'object',
    required: ['data', 'pagination'],
    properties: {
      data: { type: 'array', items: { $ref: 'User#' } },
      pagination: {
        type: 'object',
        required: ['page', 'perPage', 'total'],
        properties: {
          page: { type: 'integer', minimum: 1 },
          perPage: { type: 'integer', minimum: 1 },
          total: { type: 'integer', minimum: 0 },
        },
      },
    },
  });

  app.addSchema({
    $id: 'OrderItem',
    type: 'object',
    required: ['id', 'sku', 'description', 'quantity', 'priceCents'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      sku: { type: 'string' },
      description: { type: 'string' },
      quantity: { type: 'integer', minimum: 1 },
      priceCents: { type: 'integer', minimum: 0 },
    },
  });

  app.addSchema({
    $id: 'Order',
    type: 'object',
    required: ['id', 'userId', 'status', 'totalCents', 'currency', 'createdAt', 'items'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: ['pending', 'paid', 'shipped', 'cancelled'] },
      totalCents: { type: 'integer', minimum: 0 },
      currency: { type: 'string', minLength: 3, maxLength: 3 },
      createdAt: { type: 'string', format: 'date-time' },
      items: { type: 'array', items: { $ref: 'OrderItem#' } },
    },
  });

  app.addSchema({
    $id: 'OrderList',
    type: 'object',
    required: ['data', 'pagination'],
    properties: {
      data: { type: 'array', items: { $ref: 'Order#' } },
      pagination: {
        type: 'object',
        required: ['page', 'perPage', 'total'],
        properties: {
          page: { type: 'integer', minimum: 1 },
          perPage: { type: 'integer', minimum: 1 },
          total: { type: 'integer', minimum: 0 },
        },
      },
    },
  });

  app.addSchema({
    $id: 'ErrorBody',
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: {},
        },
      },
    },
  });

  await app.register(swagger, {
    hideUntagged: true,
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'API Testing Framework Reference API',
        description:
          'Reference REST API to exercise functional tests, contract testing, security, and performance.',
        version: '0.1.0',
      },
      servers: [{ url: `http://${config.API_HOST}:${config.API_PORT}`, description: 'local' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      tags: [
        { name: 'health', description: 'Liveness and readiness' },
        { name: 'auth', description: 'JWT authentication' },
        { name: 'users', description: 'User CRUD' },
        { name: 'orders', description: 'Orders linked to users' },
      ],
    },
  });

  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(errorHandler);
  await app.register(authPlugin);
  await app.register(metricsPlugin);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(usersRoutes);
  await app.register(ordersRoutes);

  await app.register(mercurius, {
    schema: gqlSchema,
    resolvers: gqlResolvers,
    graphiql: config.NODE_ENV !== 'production',
    path: '/graphql',
  });

  return app;
}
