import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { UsersClient } from '../../src/clients/UsersClient.js';
import { errorBodySchema } from '../../src/schemas/error.schema.js';
import { listenApp } from '../helpers/app-context.js';
import { resetDatabase, seedMinimal } from '../helpers/database.js';
import { clearAuthCache, login, userCredentials } from '../../src/utils/auth.js';

// The secret here has to match src/api/config.ts and tests/helpers/setup.ts.
// Signing with any other key produces a token rejected by @fastify/jwt.
const JWT_SECRET = process.env.JWT_SECRET ?? 'test-only-secret-do-not-use-in-prod';

describe('Security: authentication and authorization', () => {
  let baseURL: string;
  let close: () => Promise<void>;
  let seeded: { adminId: string; userId: string; orderId: string };

  beforeAll(async () => {
    const handle = await listenApp();
    baseURL = handle.url;
    close = handle.close;
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    clearAuthCache();
    await resetDatabase();
    seeded = await seedMinimal();
  });

  describe('GET /auth/me without a valid token', () => {
    it('returns 401 with code UNAUTHORIZED when the Authorization header is missing', async () => {
      const client = new UsersClient(baseURL);
      const response = await client.me();

      expect(response.status).toBe(401);
      const parsed = errorBodySchema.safeParse(response.data);
      expect(parsed.success, JSON.stringify(parsed)).toBe(true);
      expect(parsed.data!.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when the token is malformed (does not have three segments)', async () => {
      const client = new UsersClient(baseURL).withAuth('this-is-not-a-valid-jwt');
      const response = await client.me();

      expect(response.status).toBe(401);
      expect(response.data).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    });

    it('returns 401 when the token was signed with the wrong key', async () => {
      const forged = jwt.sign(
        { sub: seeded.userId, email: 'mariana.castro@acme.test', role: 'user' },
        'attacker-key-completely-different',
        { expiresIn: '1h' },
      );
      const client = new UsersClient(baseURL).withAuth(forged);
      const response = await client.me();

      expect(response.status).toBe(401);
      expect(response.data).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    });

    it('returns 401 when the token is expired', async () => {
      // negative expiresIn produces a token whose exp has already passed
      const expired = jwt.sign(
        { sub: seeded.userId, email: 'mariana.castro@acme.test', role: 'user' },
        JWT_SECRET,
        { expiresIn: -60 },
      );
      const client = new UsersClient(baseURL).withAuth(expired);
      const response = await client.me();

      expect(response.status).toBe(401);
      expect(response.data).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    });

    it('returns 401 when the Authorization header comes without the Bearer prefix', async () => {
      const valid = jwt.sign(
        { sub: seeded.userId, email: 'mariana.castro@acme.test', role: 'user' },
        JWT_SECRET,
        { expiresIn: '1h' },
      );
      // attaches the token directly, without Bearer; the client's withAuth adds Bearer,
      // so we use a manual fetch request to force the scenario.
      const response = await fetch(`${baseURL}/auth/me`, {
        headers: { Authorization: valid },
      });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    });
  });

  describe('Role-based access control', () => {
    it('PATCH /users/:id without a token returns 401', async () => {
      const client = new UsersClient(baseURL);
      const response = await client.update(seeded.userId, { name: 'New Name' });

      expect(response.status).toBe(401);
      expect(response.data).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    });

    it('DELETE /users/:id with role user returns 403 with code FORBIDDEN', async () => {
      const session = await login(baseURL, userCredentials);
      const authed = new UsersClient(baseURL).withAuth(session.token);

      const response = await authed.remove(seeded.userId);

      expect(response.status).toBe(403);
      const parsed = errorBodySchema.safeParse(response.data);
      expect(parsed.success).toBe(true);
      expect(parsed.data!.error.code).toBe('FORBIDDEN');
    });

    it('DELETE /users/:id with a guest-role token also returns 403', async () => {
      const guestToken = jwt.sign(
        { sub: seeded.userId, email: 'visitor@acme.test', role: 'guest' },
        JWT_SECRET,
        { expiresIn: '1h' },
      );
      const authed = new UsersClient(baseURL).withAuth(guestToken);

      const response = await authed.remove(seeded.userId);

      expect(response.status).toBe(403);
      expect(response.data).toMatchObject({ error: { code: 'FORBIDDEN' } });
    });
  });

  describe('POST /auth/login does not leak the difference between unknown email and wrong password', () => {
    it('returns the same status and message for unknown email and wrong password', async () => {
      const client = new UsersClient(baseURL);

      const wrongPassword = await client.login(userCredentials.email, 'totally-wrong-password');
      const unknownEmail = await client.login('missing@example.com', 'anything');

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);

      const wrongPasswordBody = errorBodySchema.parse(wrongPassword.data);
      const unknownEmailBody = errorBodySchema.parse(unknownEmail.data);

      // The same code and the same message avoid user enumeration via login.
      expect(wrongPasswordBody.error.code).toBe('INVALID_CREDENTIALS');
      expect(unknownEmailBody.error.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPasswordBody.error.message).toBe(unknownEmailBody.error.message);
    });
  });

  describe('Tokens must not leak in error responses', () => {
    it('GET /auth/me with a forged token does not echo the token in the response body', async () => {
      const forged = jwt.sign(
        { sub: seeded.userId, email: 'mariana.castro@acme.test', role: 'user' },
        'some-other-key',
        { expiresIn: '1h' },
      );
      const client = new UsersClient(baseURL).withAuth(forged);
      const response = await client.me();

      expect(response.status).toBe(401);
      const body = JSON.stringify(response.data);
      expect(body).not.toContain(forged);
    });
  });
});
