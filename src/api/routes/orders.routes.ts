import type { FastifyPluginAsync } from 'fastify';
import { CreateOrderBodySchema, ListQuerySchema, UpdateOrderStatusBodySchema } from '../schemas.js';
import { ordersService } from '../services/orders.service.js';

export const ordersRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/orders',
    {
      schema: {
        tags: ['orders'],
        summary: 'List paginated orders',
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            status: { type: 'string', enum: ['pending', 'paid', 'shipped', 'cancelled'] },
            userId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: { $ref: 'OrderList#' },
        },
      },
    },
    async (request) => {
      const query = ListQuerySchema.parse(request.query);
      const userId = (request.query as { userId?: string }).userId;
      return ordersService.list({ ...query, ...(userId ? { userId } : {}) });
    },
  );

  app.get(
    '/orders/:id',
    {
      schema: {
        tags: ['orders'],
        summary: 'Get order by id',
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: { $ref: 'Order#' },
          404: { $ref: 'ErrorBody#' },
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return ordersService.getById(id);
    },
  );

  app.post(
    '/orders',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['orders'],
        summary: 'Create order',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['userId', 'items'],
          properties: {
            userId: { type: 'string', format: 'uuid' },
            currency: { type: 'string', minLength: 3, maxLength: 3, default: 'BRL' },
            items: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['sku', 'description', 'quantity', 'priceCents'],
                properties: {
                  sku: { type: 'string', minLength: 1 },
                  description: { type: 'string', minLength: 1 },
                  quantity: { type: 'integer', minimum: 1 },
                  priceCents: { type: 'integer', minimum: 0 },
                },
              },
            },
          },
        },
        response: {
          201: { $ref: 'Order#' },
          404: { $ref: 'ErrorBody#' },
        },
      },
    },
    async (request, reply) => {
      const body = CreateOrderBodySchema.parse(request.body);
      const created = await ordersService.create(body);
      reply.header('location', `/orders/${created.id}`);
      return reply.status(201).send(created);
    },
  );

  app.patch(
    '/orders/:id/status',
    {
      preHandler: [app.authenticate, app.requireRole('admin')],
      schema: {
        tags: ['orders'],
        summary: 'Update order status',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['pending', 'paid', 'shipped', 'cancelled'] },
          },
        },
        response: {
          200: { $ref: 'Order#' },
          403: { $ref: 'ErrorBody#' },
          404: { $ref: 'ErrorBody#' },
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = UpdateOrderStatusBodySchema.parse(request.body);
      return ordersService.updateStatus(id, body);
    },
  );

  app.delete(
    '/orders/:id',
    {
      preHandler: [app.authenticate, app.requireRole('admin')],
      schema: {
        tags: ['orders'],
        summary: 'Delete order',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          204: { type: 'null' },
          404: { $ref: 'ErrorBody#' },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await ordersService.delete(id);
      return reply.status(204).send();
    },
  );
};
