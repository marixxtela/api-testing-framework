import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UsersClient } from '../../src/clients/UsersClient.js';
import { UserBuilder } from '../../src/builders/UserBuilder.js';
import { userListSchema, userSchema } from '../../src/schemas/user.schema.js';
import { errorBodySchema } from '../../src/schemas/error.schema.js';
import { listenApp } from '../helpers/app-context.js';
import { resetDatabase, seedMinimal } from '../helpers/database.js';
import { adminCredentials, clearAuthCache, login, userCredentials } from '../../src/utils/auth.js';

const LOCATION_REGEX = /^\/users\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('Users API', () => {
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

  describe('GET /users', () => {
    it('applies default pagination when no parameter is provided', async () => {
      const response = await client.list();

      expect(response.status).toBe(200);
      const parsed = userListSchema.safeParse(response.data);
      expect(parsed.success).toBe(true);
      expect(response.data.pagination).toEqual({ page: 1, perPage: 20, total: 2 });
      expect(response.data.data).toHaveLength(2);
    });

    it('respects the provided page and perPage', async () => {
      const extra = new UserBuilder().withRandomEmail().build();
      await client.create(extra);

      const firstPage = await client.list({ page: 1, perPage: 2 });
      const secondPage = await client.list({ page: 2, perPage: 2 });

      expect(firstPage.status).toBe(200);
      expect(firstPage.data.data).toHaveLength(2);
      expect(firstPage.data.pagination).toMatchObject({ page: 1, perPage: 2, total: 3 });

      expect(secondPage.status).toBe(200);
      expect(secondPage.data.data).toHaveLength(1);
      expect(secondPage.data.pagination).toMatchObject({ page: 2, perPage: 2, total: 3 });

      const idsFirst = firstPage.data.data.map((u) => u.id);
      const idsSecond = secondPage.data.data.map((u) => u.id);
      // ensure pages do not overlap
      expect(idsFirst.some((id) => idsSecond.includes(id))).toBe(false);
    });

    it('filters users by the provided role', async () => {
      const response = await client.list({ role: 'admin' });

      expect(response.status).toBe(200);
      expect(response.data.data).toHaveLength(1);
      expect(response.data.data[0]).toMatchObject({ role: 'admin', id: seeded.adminId });
    });

    it('searches by partial text in the name via the q parameter', async () => {
      const response = await client.search({ q: 'Mariana' });

      expect(response.status).toBe(200);
      expect(response.data.data).toHaveLength(1);
      expect(response.data.data[0]!.email).toBe('mariana.castro@acme.test');
    });

    it('searches by partial text in the email via the q parameter', async () => {
      const response = await client.search({ q: 'ricardo.menezes' });

      expect(response.status).toBe(200);
      expect(response.data.data).toHaveLength(1);
      expect(response.data.data[0]!.id).toBe(seeded.adminId);
    });
  });

  describe('GET /users/:id', () => {
    it('returns the user with payload matching userSchema', async () => {
      const response = await client.getById(seeded.userId);

      expect(response.status).toBe(200);
      expect(() => userSchema.parse(response.data)).not.toThrow();
      expect(response.data).toMatchObject({
        id: seeded.userId,
        email: 'mariana.castro@acme.test',
        role: 'user',
      });
    });

    it('returns 404 with errorBodySchema when the id does not exist', async () => {
      const response = await client.getById('00000000-0000-0000-0000-0000000000ff');

      expect(response.status).toBe(404);
      const parsed = errorBodySchema.safeParse(response.data);
      expect(parsed.success).toBe(true);
      expect(parsed.data!.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('POST /users', () => {
    it('creates a user, returns 201, Location header, and a valid body', async () => {
      const payload = new UserBuilder().withRandomEmail().build();
      const response = await client.create(payload);

      expect(response.status).toBe(201);
      expect(response.headers.location).toMatch(LOCATION_REGEX);
      expect(() => userSchema.parse(response.data)).not.toThrow();
      expect(response.data).toMatchObject({
        email: payload.email,
        name: payload.name,
        role: 'user',
      });
      expect(response.data.metadata).toEqual({ lastLogin: null, loginCount: 0 });
    });

    it('rejects creation with 409 when the email is already in use', async () => {
      const payload = new UserBuilder().withEmail('mariana.castro@acme.test').build();
      const response = await client.create(payload);

      expect(response.status).toBe(409);
      const parsed = errorBodySchema.safeParse(response.data);
      expect(parsed.success).toBe(true);
      expect(parsed.data!.error.code).toBe('EMAIL_TAKEN');
    });

    it('returns 400 when the email is malformed', async () => {
      const payload = new UserBuilder().withEmail('not-an-email').build();
      const response = await client.create(payload);

      expect(response.status).toBe(400);
      const parsed = errorBodySchema.safeParse(response.data);
      expect(parsed.success).toBe(true);
      expect(parsed.data!.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when the password is too short', async () => {
      const payload = new UserBuilder().withWeakPassword().build();
      const response = await client.create(payload);

      expect(response.status).toBe(400);
      expect(response.data).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });
  });

  describe('PATCH /users/:id', () => {
    it('returns 401 when the request arrives without a token', async () => {
      const response = await client.update(seeded.userId, { name: 'New Name' });

      expect(response.status).toBe(401);
      const parsed = errorBodySchema.safeParse(response.data);
      expect(parsed.success).toBe(true);
      expect(parsed.data!.error.code).toBe('UNAUTHORIZED');
    });

    it('updates the name when authenticated', async () => {
      const session = await login(baseURL, userCredentials);
      const authed = new UsersClient(baseURL).withAuth(session.token);

      const response = await authed.update(seeded.userId, { name: 'Alice Updated' });

      expect(response.status).toBe(200);
      expect(() => userSchema.parse(response.data)).not.toThrow();
      expect(response.data.name).toBe('Alice Updated');
    });
  });

  describe('DELETE /users/:id', () => {
    it('returns 403 when the caller is not admin', async () => {
      const session = await login(baseURL, userCredentials);
      const authed = new UsersClient(baseURL).withAuth(session.token);

      const response = await authed.remove(seeded.userId);

      expect(response.status).toBe(403);
      const parsed = errorBodySchema.safeParse(response.data);
      expect(parsed.success).toBe(true);
      expect(parsed.data!.error.code).toBe('FORBIDDEN');
    });

    it('returns 204 and removes the user when admin calls', async () => {
      const session = await login(baseURL, adminCredentials);
      const authed = new UsersClient(baseURL).withAuth(session.token);

      const removed = await authed.remove(seeded.userId);
      expect(removed.status).toBe(204);

      const followUp = await client.getById(seeded.userId);
      expect(followUp.status).toBe(404);
    });
  });
});
