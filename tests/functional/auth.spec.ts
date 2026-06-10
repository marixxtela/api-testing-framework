import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UsersClient } from '../../src/clients/UsersClient.js';
import { loginResponseSchema, userSchema } from '../../src/schemas/user.schema.js';
import { errorBodySchema } from '../../src/schemas/error.schema.js';
import { listenApp } from '../helpers/app-context.js';
import { resetDatabase, seedMinimal } from '../helpers/database.js';
import { clearAuthCache, userCredentials } from '../../src/utils/auth.js';

const JWT_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

describe('Auth API', () => {
  let baseURL: string;
  let close: () => Promise<void>;
  let seeded: { adminId: string; userId: string; orderId: string };
  let client: UsersClient;

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
    client = new UsersClient(baseURL);
  });

  describe('POST /auth/login', () => {
    it('returns token, user, and expiresIn when credentials are correct', async () => {
      const response = await client.login(userCredentials.email, userCredentials.password);

      expect(response.status).toBe(200);
      const parsed = loginResponseSchema.safeParse(response.data);
      expect(parsed.success).toBe(true);
      expect(response.data.user.id).toBe(seeded.userId);
      expect(response.data.expiresIn).toBeTruthy();
    });

    it('returned token has the JWT format with three base64url segments separated by dots', async () => {
      const response = await client.login(userCredentials.email, userCredentials.password);

      expect(response.status).toBe(200);
      expect(response.data.token).toMatch(JWT_REGEX);
      expect(response.data.token.split('.')).toHaveLength(3);
    });

    it('returns 401 when the password is wrong', async () => {
      const response = await client.login(userCredentials.email, 'wrong-password');

      expect(response.status).toBe(401);
      const parsed = errorBodySchema.safeParse(response.data);
      expect(parsed.success).toBe(true);
      expect(parsed.data!.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 401 when the email does not exist', async () => {
      const response = await client.login('nobody@example.com', 'anything');

      expect(response.status).toBe(401);
      expect(response.data).toMatchObject({ error: { code: 'INVALID_CREDENTIALS' } });
    });

    it('returns 400 when the payload is invalid', async () => {
      const response = await client.login('invalid-email', '');

      expect(response.status).toBe(400);
      const parsed = errorBodySchema.safeParse(response.data);
      expect(parsed.success).toBe(true);
      expect(parsed.data!.error.code).toBe('VALIDATION_ERROR');
    });

    it('increments loginCount on every successful login', async () => {
      const before = await client.getById(seeded.userId);
      const initialCount = before.data.metadata.loginCount;

      await client.login(userCredentials.email, userCredentials.password);
      await client.login(userCredentials.email, userCredentials.password);

      const after = await client.getById(seeded.userId);
      expect(after.data.metadata.loginCount).toBe(initialCount + 2);
      expect(after.data.metadata.lastLogin).not.toBeNull();
    });
  });

  describe('GET /auth/me', () => {
    it('returns 401 when no token is sent', async () => {
      const response = await client.me();

      expect(response.status).toBe(401);
      const parsed = errorBodySchema.safeParse(response.data);
      expect(parsed.success).toBe(true);
      expect(parsed.data!.error.code).toBe('UNAUTHORIZED');
    });

    it('returns the authenticated user when the token is valid', async () => {
      const loginResponse = await client.login(userCredentials.email, userCredentials.password);
      const authed = new UsersClient(baseURL).withAuth(loginResponse.data.token);

      const response = await authed.me();

      expect(response.status).toBe(200);
      expect(() => userSchema.parse(response.data)).not.toThrow();
      expect(response.data.id).toBe(seeded.userId);
      expect(response.data.email).toBe(userCredentials.email);
    });
  });
});
