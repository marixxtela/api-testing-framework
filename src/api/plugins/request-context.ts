import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

const plugin: FastifyPluginAsync = async (app) => {
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });
};

export default fp(plugin, { name: 'request-context' });
