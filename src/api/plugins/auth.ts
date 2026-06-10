import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';
import { ApiError } from '../errors.js';

type Role = 'admin' | 'user' | 'guest';
type RoleGuard = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: RoleGuard;
    requireRole: (...roles: Role[]) => RoleGuard;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string; role: Role };
    user: { sub: string; email: string; role: Role };
  }
}

const plugin: FastifyPluginAsync = async (app) => {
  await app.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN },
  });

  app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      throw ApiError.unauthorized();
    }
  });

  app.decorate('requireRole', (...roles: Role[]): RoleGuard => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      if (!request.user || !roles.includes(request.user.role)) {
        throw ApiError.forbidden(`Requires one of the roles: ${roles.join(', ')}`);
      }
    };
  });
};

export default fp(plugin, { name: 'auth' });
