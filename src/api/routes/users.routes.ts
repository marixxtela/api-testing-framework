import type { FastifyPluginAsync } from 'fastify';
import { CreateUserBodySchema, ListQuerySchema, UpdateUserBodySchema } from '../schemas.js';
import { usersService } from '../services/users.service.js';

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/users',
    {
      schema: {
        tags: ['users'],
        summary: 'List paginated users',
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            role: { type: 'string', enum: ['admin', 'user', 'guest'] },
            q: { type: 'string' },
          },
        },
        response: {
          200: { $ref: 'UserList#' },
        },
      },
    },
    async (request) => {
      const query = ListQuerySchema.parse(request.query);
      return usersService.list(query);
    },
  );

  app.get(
    '/users/:id',
    {
      schema: {
        tags: ['users'],
        summary: 'Get user by id',
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: { $ref: 'User#' },
          404: { $ref: 'ErrorBody#' },
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return usersService.getById(id);
    },
  );

  app.post(
    '/users',
    {
      schema: {
        tags: ['users'],
        summary: 'Create user',
        body: {
          type: 'object',
          required: ['email', 'name', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            name: { type: 'string', minLength: 1, maxLength: 120 },
            password: { type: 'string', minLength: 8, maxLength: 72 },
            role: { type: 'string', enum: ['admin', 'user', 'guest'] },
          },
        },
        response: {
          201: { $ref: 'User#' },
          409: { $ref: 'ErrorBody#' },
        },
      },
    },
    async (request, reply) => {
      const body = CreateUserBodySchema.parse(request.body);
      const created = await usersService.create(body);
      reply.header('location', `/users/${created.id}`);
      return reply.status(201).send(created);
    },
  );

  app.patch(
    '/users/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['users'],
        summary: 'Update user',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 120 },
            role: { type: 'string', enum: ['admin', 'user', 'guest'] },
          },
        },
        response: {
          200: { $ref: 'User#' },
          404: { $ref: 'ErrorBody#' },
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = UpdateUserBodySchema.parse(request.body);
      return usersService.update(id, body);
    },
  );

  app.delete(
    '/users/:id',
    {
      preHandler: [app.authenticate, app.requireRole('admin')],
      schema: {
        tags: ['users'],
        summary: 'Delete user',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          204: { type: 'null' },
          403: { $ref: 'ErrorBody#' },
          404: { $ref: 'ErrorBody#' },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await usersService.delete(id);
      return reply.status(204).send();
    },
  );
};
