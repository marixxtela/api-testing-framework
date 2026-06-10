import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';
import { ApiError, type ErrorBody } from '../errors.js';

const plugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      const body: ErrorBody = {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      };
      return reply.status(error.statusCode).send(body);
    }

    if (error instanceof ZodError) {
      const body: ErrorBody = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid payload',
          details: error.flatten().fieldErrors,
        },
      };
      return reply.status(400).send(body);
    }

    if ((error as { validation?: unknown }).validation) {
      const body: ErrorBody = {
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: (error as { validation: unknown }).validation,
        },
      };
      return reply.status(400).send(body);
    }

    if (error.statusCode === 429) {
      const body: ErrorBody = {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests, try again shortly',
        },
      };
      return reply.status(429).send(body);
    }

    if (error.statusCode && error.statusCode < 500) {
      // TODO: map Prisma codes (P2002 unique, P2025 not found) to our own codes.
      // For now any 4xx that escapes without ApiError becomes VALIDATION_ERROR,
      // which is bad for the contract consumer.
      const body: ErrorBody = {
        error: { code: 'VALIDATION_ERROR', message: error.message },
      };
      return reply.status(error.statusCode).send(body);
    }

    request.log.error({ err: error }, 'unhandled error');
    const body: ErrorBody = {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    };
    return reply.status(500).send(body);
  });

  app.setNotFoundHandler((request, reply) => {
    const body: ErrorBody = {
      error: {
        code: 'INTERNAL_ERROR',
        message: `Route not found: ${request.method} ${request.url}`,
      },
    };
    reply.status(404).send(body);
  });
};

export default fp(plugin, { name: 'error-handler' });
