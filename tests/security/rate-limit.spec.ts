import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/api/app.js';
import { errorBodySchema } from '../../src/schemas/error.schema.js';
import { resetDatabase, seedMinimal } from '../helpers/database.js';

const LIMIT = 5;

describe('Security: rate limiting on GET /users with a low limit', () => {
  let app: FastifyInstance;

  // Fresh app per test so the @fastify/rate-limit counter starts at zero.
  // Since the default key is the IP and inject() always uses 127.0.0.1, without this
  // tests would contaminate each other inside the same 1-minute window.
  beforeEach(async () => {
    app = await buildApp({ logger: false, rateLimitMax: LIMIT });
    await app.ready();
    await resetDatabase();
    await seedMinimal();
  });

  afterEach(async () => {
    await app.close();
  });

  it(`allows ${LIMIT} requests in sequence returning 200`, async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      const response = await app.inject({ method: 'GET', url: '/users' });
      expect(response.statusCode, `request ${i + 1} should pass`).toBe(200);
    }
  });

  it(`blocks request ${LIMIT + 1} with 429 and code RATE_LIMITED`, async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      await app.inject({ method: 'GET', url: '/users' });
    }

    const blocked = await app.inject({ method: 'GET', url: '/users' });

    expect(blocked.statusCode).toBe(429);
    const body = errorBodySchema.parse(blocked.json());
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('429 response carries retry-after, x-ratelimit-limit, and x-ratelimit-remaining headers', async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      await app.inject({ method: 'GET', url: '/users' });
    }

    const blocked = await app.inject({ method: 'GET', url: '/users' });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.headers['x-ratelimit-limit']).toBeDefined();
    expect(blocked.headers['x-ratelimit-remaining']).toBeDefined();
    expect(Number(blocked.headers['x-ratelimit-limit'])).toBe(LIMIT);
    expect(Number(blocked.headers['x-ratelimit-remaining'])).toBe(0);
  });

  it('rate limit treats distinct IPs as independent counters', async () => {
    // Exhaust the limit from 10.0.0.1
    for (let i = 0; i < LIMIT; i += 1) {
      await app.inject({ method: 'GET', url: '/users', remoteAddress: '10.0.0.1' });
    }
    const blockedA = await app.inject({ method: 'GET', url: '/users', remoteAddress: '10.0.0.1' });
    expect(blockedA.statusCode).toBe(429);

    // Another IP still has its counter at zero
    const allowedB = await app.inject({ method: 'GET', url: '/users', remoteAddress: '10.0.0.2' });
    expect(allowedB.statusCode).toBe(200);
  });
});
