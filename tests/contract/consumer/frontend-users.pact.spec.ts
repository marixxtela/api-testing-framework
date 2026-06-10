import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { UsersClient } from '../../../src/clients/UsersClient.js';

const { like, uuid, datetime, integer, eachLike, regex } = MatchersV3;

const ISO_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSSX";

const PACTS_DIR = path.resolve(process.cwd(), 'pacts');

const userExample = {
  id: uuid('00000000-0000-0000-0000-000000000002'),
  email: like('mariana.castro@acme.test'),
  name: like('Mariana Castro'),
  role: regex(/^(admin|user|guest)$/, 'user'),
  createdAt: datetime(ISO_FORMAT, '2025-01-15T10:30:00.000Z'),
  metadata: {
    lastLogin: datetime(ISO_FORMAT, '2025-01-20T08:15:00.000Z'),
    loginCount: integer(7),
  },
};

const errorBodyExample = (code: string, message: string) => ({
  error: {
    code: like(code),
    message: like(message),
  },
});

describe('Pact consumer: FrontendApp -> UsersAPI', () => {
  const provider = new PactV3({
    consumer: 'FrontendApp',
    provider: 'UsersAPI',
    dir: PACTS_DIR,
    logLevel: 'warn',
  });

  it('GET /users/:id returns the default user', async () => {
    provider
      .given('default user exists')
      .uponReceiving('fetch default user by id')
      .withRequest({
        method: 'GET',
        path: '/users/00000000-0000-0000-0000-000000000002',
        headers: { accept: 'application/json' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: userExample,
      });

    await provider.executeTest(async (mockServer) => {
      const client = new UsersClient(mockServer.url);
      client.withHeader('accept', 'application/json');
      const response = await client.getById('00000000-0000-0000-0000-000000000002');

      expect(response.status).toBe(200);
      expect(response.data.id).toBeDefined();
      expect(response.data.metadata.loginCount).toBeGreaterThanOrEqual(0);
    });
  });

  it('GET /users with pagination returns a paginated list', async () => {
    provider
      .given('users list exists')
      .uponReceiving('list users page 1 with 10 per page')
      .withRequest({
        method: 'GET',
        path: '/users',
        query: { page: '1', perPage: '10' },
        headers: { accept: 'application/json' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: {
          data: eachLike(userExample, 1),
          pagination: {
            page: integer(1),
            perPage: integer(10),
            total: integer(3),
          },
        },
      });

    await provider.executeTest(async (mockServer) => {
      const client = new UsersClient(mockServer.url);
      client.withHeader('accept', 'application/json');
      const response = await client.list({ page: 1, perPage: 10 });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.data.length).toBeGreaterThan(0);
      expect(response.data.pagination.page).toBe(1);
    });
  });

  it('POST /users creates a user when the email is not in use', async () => {
    const newUserPayload = {
      email: 'pact-new-user@example.com',
      name: 'New Pact User',
      password: 'super-secret-123',
      role: 'user' as const,
    };

    provider
      .given('no duplicate email for pact-new-user@example.com')
      .uponReceiving('create user with a novel email')
      .withRequest({
        method: 'POST',
        path: '/users',
        headers: { 'content-type': 'application/json' },
        body: newUserPayload,
      })
      .willRespondWith({
        status: 201,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          location: regex(
            /^\/users\/[0-9a-f-]{36}$/,
            '/users/00000000-0000-0000-0000-000000000999',
          ),
        },
        body: {
          id: uuid('00000000-0000-0000-0000-000000000999'),
          email: like('pact-new-user@example.com'),
          name: like('New Pact User'),
          role: regex(/^(admin|user|guest)$/, 'user'),
          createdAt: datetime(ISO_FORMAT, '2025-01-15T10:30:00.000Z'),
          metadata: {
            // A newly created user has lastLogin null and loginCount 0; the consumer must tolerate both.
            lastLogin: null,
            loginCount: integer(0),
          },
        },
      });

    await provider.executeTest(async (mockServer) => {
      const client = new UsersClient(mockServer.url);
      const response = await client.create(newUserPayload);

      expect(response.status).toBe(201);
      expect(response.headers.location).toMatch(/^\/users\/[0-9a-f-]{36}$/);
      expect(response.data.email).toBeDefined();
    });
  });

  it('GET /users/:id returns 404 when the user does not exist', async () => {
    provider
      .given('user does not exist')
      .uponReceiving('fetch missing user')
      .withRequest({
        method: 'GET',
        path: '/users/ffffffff-ffff-ffff-ffff-ffffffffffff',
        headers: { accept: 'application/json' },
      })
      .willRespondWith({
        status: 404,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: errorBodyExample(
          'USER_NOT_FOUND',
          'User ffffffff-ffff-ffff-ffff-ffffffffffff not found',
        ),
      });

    await provider.executeTest(async (mockServer) => {
      const client = new UsersClient(mockServer.url);
      client.withHeader('accept', 'application/json');
      const response = await client.getById('ffffffff-ffff-ffff-ffff-ffffffffffff');

      expect(response.status).toBe(404);
      const body = response.data as unknown as { error: { code: string; message: string } };
      expect(body.error.code).toBe('USER_NOT_FOUND');
      expect(typeof body.error.message).toBe('string');
    });
  });
});
