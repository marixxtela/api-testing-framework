import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/api/app.js';

// Helmet applies several headers; here we validate the most relevant for a JSON API.
describe('Security: HTTP headers applied by helmet on GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false, rateLimitMax: 1_000_000 });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('includes X-Content-Type-Options: nosniff', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('includes X-Frame-Options or Content-Security-Policy to protect against clickjacking', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    const hasFrame = response.headers['x-frame-options'];
    const hasCsp = response.headers['content-security-policy'];
    // app.ts disables CSP, so we expect at least X-Frame-Options.
    expect(
      hasFrame ?? hasCsp,
      'expected at least one clickjacking protection header',
    ).toBeDefined();
  });

  it('includes X-DNS-Prefetch-Control', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.headers['x-dns-prefetch-control']).toBeDefined();
  });

  it('does not expose the X-Powered-By header', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    // helmet removes that header; the direct check avoids regression if someone reenables it.
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('responds with Content-Type application/json on JSON routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    const contentType = response.headers['content-type'];
    expect(contentType).toBeDefined();
    expect(String(contentType).toLowerCase()).toContain('application/json');
  });
});
