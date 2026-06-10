import type { FastifyPluginAsync } from 'fastify';
import { LoginBodySchema } from '../schemas.js';
import { usersService } from '../services/users.service.js';
import { config } from '../config.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/auth/login',
    {
      schema: {
        tags: ['auth'],
        summary: 'Authenticate user by email and password',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['token', 'expiresIn', 'user'],
            properties: {
              token: { type: 'string' },
              expiresIn: { type: 'string' },
              user: { $ref: 'User#' },
            },
          },
          401: { $ref: 'ErrorBody#' },
        },
      },
    },
    async (request, reply) => {
      const body = LoginBodySchema.parse(request.body);
      const user = await usersService.authenticate(body.email, body.password);

      const token = app.jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return reply.status(200).send({
        token,
        expiresIn: config.JWT_EXPIRES_IN,
        user,
      });
    },
  );

  app.get(
    '/auth/me',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['auth'],
        summary: 'Return the authenticated user',
        security: [{ bearerAuth: [] }],
        response: {
          200: { $ref: 'User#' },
          401: { $ref: 'ErrorBody#' },
        },
      },
    },
    async (request) => {
      return usersService.getById(request.user.sub);
    },
  );
};
