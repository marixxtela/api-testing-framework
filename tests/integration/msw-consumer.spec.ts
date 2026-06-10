import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '../../mocks/msw/server.js';
import { UsersClient } from '../../src/clients/UsersClient.js';

const BASE = 'http://localhost';

describe('UsersClient against MSW handlers', () => {
  beforeAll(() => {
    mswServer.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    mswServer.resetHandlers();
  });

  afterAll(() => {
    mswServer.close();
  });

  it('GET /users returns the mocked list with pagination', async () => {
    const client = new UsersClient(BASE);
    const res = await client.list();

    expect(res.status).toBe(200);
    expect(res.data.data).toHaveLength(3);
    expect(res.data.data.map((u) => u.email)).toContain('ricardo.menezes@acme.test');
    expect(res.data.pagination).toEqual({ page: 1, perPage: 10, total: 3 });
  });

  it('GET /users/:id returns 200 for a known id', async () => {
    const client = new UsersClient(BASE);
    const res = await client.getById('00000000-0000-0000-0000-000000000002');

    expect(res.status).toBe(200);
    expect(res.data.email).toBe('mariana.castro@acme.test');
  });

  it('GET /users/:id returns 404 with errorBody for an unknown id', async () => {
    const client = new UsersClient(BASE);
    const res = await client.getById('ffffffff-ffff-4fff-8fff-ffffffffffff');

    expect(res.status).toBe(404);
    expect(res.data).toMatchObject({
      error: { code: 'USER_NOT_FOUND' },
    });
  });

  it('POST /users returns 201 with Location', async () => {
    const client = new UsersClient(BASE);
    const res = await client.create({
      email: 'new@example.com',
      name: 'New User',
      password: 'secret123',
      role: 'user',
    });

    expect(res.status).toBe(201);
    expect(res.headers.location).toMatch(/\/users\/[a-f0-9-]{36}$/);
    expect(res.data.email).toBe('new@example.com');
  });

  it('POST /auth/login returns a token when credentials are valid', async () => {
    const client = new UsersClient(BASE);
    const res = await client.login('ricardo.menezes@acme.test', 'Adm.7421!checkout');

    expect(res.status).toBe(200);
    expect(res.data.token).toMatch(/^eyJ/);
    expect(res.data.user.role).toBe('admin');
  });

  it('POST /auth/login returns 401 with invalid credentials', async () => {
    const client = new UsersClient(BASE);
    const res = await client.login('ricardo.menezes@acme.test', 'wrong-password');

    expect(res.status).toBe(401);
    expect(res.data).toMatchObject({ error: { code: 'INVALID_CREDENTIALS' } });
  });

  it('server.use overrides the handler only for this test', async () => {
    mswServer.use(
      http.get(`${BASE}/users`, () =>
        HttpResponse.json(
          {
            data: [],
            pagination: { page: 1, perPage: 10, total: 0 },
          },
          { status: 200 },
        ),
      ),
    );

    const client = new UsersClient(BASE);
    const res = await client.list();

    expect(res.status).toBe(200);
    expect(res.data.data).toEqual([]);
    expect(res.data.pagination.total).toBe(0);
  });
});
