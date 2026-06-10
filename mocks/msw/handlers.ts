import { http, HttpResponse } from 'msw';
import type { User, UserList, LoginResponse } from '../../src/schemas/user.schema.js';
import type { ErrorBody } from '../../src/schemas/error.schema.js';

const BASE = 'http://localhost';

const fixtureUsers: User[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'ricardo.menezes@acme.test',
    name: 'Ricardo Menezes',
    role: 'admin',
    createdAt: '2025-01-01T00:00:00.000Z',
    metadata: { lastLogin: '2025-05-20T08:00:00.000Z', loginCount: 128 },
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'mariana.castro@acme.test',
    name: 'Mariana Castro',
    role: 'user',
    createdAt: '2025-01-05T09:15:00.000Z',
    metadata: { lastLogin: '2025-05-19T22:10:00.000Z', loginCount: 57 },
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'visitor@acme.test',
    name: 'External Visitor',
    role: 'guest',
    createdAt: '2025-01-10T11:45:00.000Z',
    metadata: { lastLogin: null, loginCount: 0 },
  },
];

const usersById = new Map(fixtureUsers.map((u) => [u.id, u]));

const notFound: ErrorBody = {
  error: { code: 'USER_NOT_FOUND', message: 'user not found' },
};

const invalidCreds: ErrorBody = {
  error: { code: 'INVALID_CREDENTIALS', message: 'invalid credentials' },
};

interface CreateUserPayload {
  email: string;
  name: string;
  password: string;
  role?: 'admin' | 'user' | 'guest';
}

interface LoginPayload {
  email: string;
  password: string;
}

export const handlers = [
  http.get(`${BASE}/users`, () => {
    const body: UserList = {
      data: fixtureUsers,
      pagination: { page: 1, perPage: 10, total: fixtureUsers.length },
    };
    return HttpResponse.json(body, { status: 200 });
  }),

  http.get(`${BASE}/users/:id`, ({ params }) => {
    const id = String(params.id);
    const user = usersById.get(id);
    if (!user) {
      return HttpResponse.json(notFound, { status: 404 });
    }
    return HttpResponse.json(user, { status: 200 });
  }),

  http.post(`${BASE}/users`, async ({ request }) => {
    const payload = (await request.json()) as CreateUserPayload;
    const created: User = {
      id: '11111111-1111-4111-8111-111111111111',
      email: payload.email,
      name: payload.name,
      role: payload.role ?? 'user',
      createdAt: new Date().toISOString(),
      metadata: { lastLogin: null, loginCount: 0 },
    };
    return HttpResponse.json(created, {
      status: 201,
      headers: { Location: `/users/${created.id}` },
    });
  }),

  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const { email, password } = (await request.json()) as LoginPayload;
    if (email === 'ricardo.menezes@acme.test' && password === 'Adm.7421!checkout') {
      const body: LoginResponse = {
        token:
          'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiYWRtaW4ifQ.msw-fake-signature',
        expiresIn: '1d',
        user: fixtureUsers[0]!,
      };
      return HttpResponse.json(body, { status: 200 });
    }
    return HttpResponse.json(invalidCreds, { status: 401 });
  }),
];
