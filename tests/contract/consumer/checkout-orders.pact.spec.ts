import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { OrdersClient } from '../../../src/clients/OrdersClient.js';

const { like, uuid, datetime, integer, eachLike, regex } = MatchersV3;

const ISO_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSSX";

const PACTS_DIR = path.resolve(process.cwd(), 'pacts');

const AUTH_USER_ID = '00000000-0000-0000-0000-000000000002';
const PAID_ORDER_ID = '10000000-0000-0000-0000-000000000001';
const PENDING_ORDER_ID = '10000000-0000-0000-0000-000000000002';

const orderItemExample = {
  id: uuid('20000000-0000-0000-0000-000000000001'),
  sku: like('SKU-001'),
  description: like('A5 notebook'),
  quantity: integer(2),
  priceCents: integer(8990),
};

const orderExample = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: uuid(PAID_ORDER_ID),
  userId: uuid(AUTH_USER_ID),
  status: regex(/^(pending|paid|shipped|cancelled)$/, 'paid'),
  totalCents: integer(25990),
  currency: regex(/^[A-Z]{3}$/, 'BRL'),
  createdAt: datetime(ISO_FORMAT, '2025-01-10T12:00:00.000Z'),
  items: eachLike(orderItemExample, 1),
  ...overrides,
});

describe('Pact consumer: CheckoutApp -> OrdersAPI', () => {
  const provider = new PactV3({
    consumer: 'CheckoutApp',
    provider: 'OrdersAPI',
    dir: PACTS_DIR,
    logLevel: 'warn',
  });

  it('GET /orders/:id returns the paid order with items', async () => {
    provider
      .given('paid order exists')
      .uponReceiving('fetch paid order by id')
      .withRequest({
        method: 'GET',
        path: `/orders/${PAID_ORDER_ID}`,
        headers: { accept: 'application/json' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: orderExample(),
      });

    await provider.executeTest(async (mockServer) => {
      const client = new OrdersClient(mockServer.url);
      client.withHeader('accept', 'application/json');
      const response = await client.getById(PAID_ORDER_ID);

      expect(response.status).toBe(200);
      expect(response.data.items.length).toBeGreaterThan(0);
      expect(response.data.status).toBe('paid');
    });
  });

  it('POST /orders creates the order when the user is authenticated', async () => {
    const createPayload = {
      userId: AUTH_USER_ID,
      currency: 'BRL',
      items: [
        { sku: 'SKU-001', description: 'A5 notebook', quantity: 2, priceCents: 8990 },
        { sku: 'SKU-014', description: 'Gel pen', quantity: 1, priceCents: 4005 },
      ],
    };

    provider
      .given('authenticated user')
      .uponReceiving('create order with valid items')
      .withRequest({
        method: 'POST',
        path: '/orders',
        headers: {
          'content-type': 'application/json',
          authorization: regex(/^Bearer [\w.-]+$/, 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature'),
        },
        body: createPayload,
      })
      .willRespondWith({
        status: 201,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          location: regex(/^\/orders\/[0-9a-f-]{36}$/, `/orders/${PAID_ORDER_ID}`),
        },
        body: orderExample({
          status: regex(/^(pending|paid|shipped|cancelled)$/, 'pending'),
          totalCents: integer(21985),
        }),
      });

    await provider.executeTest(async (mockServer) => {
      const client = new OrdersClient(mockServer.url);
      // Example token. The provider injects a real JWT via requestFilter during verification.
      client.withAuth('eyJhbGciOiJIUzI1NiJ9.payload.signature');
      const response = await client.create(createPayload);

      expect(response.status).toBe(201);
      expect(response.headers.location).toMatch(/^\/orders\/[0-9a-f-]{36}$/);
      expect(response.data.userId).toBeDefined();
    });
  });

  it('GET /orders?status=paid returns a paginated list of paid orders', async () => {
    provider
      .given('paid orders exist')
      .uponReceiving('list orders with status paid')
      .withRequest({
        method: 'GET',
        path: '/orders',
        query: { status: 'paid', page: '1', perPage: '20' },
        headers: { accept: 'application/json' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: {
          data: eachLike(orderExample(), 1),
          pagination: {
            page: integer(1),
            perPage: integer(20),
            total: integer(2),
          },
        },
      });

    await provider.executeTest(async (mockServer) => {
      const client = new OrdersClient(mockServer.url);
      client.withHeader('accept', 'application/json');
      const response = await client.list({ status: 'paid', page: 1, perPage: 20 });

      expect(response.status).toBe(200);
      expect(response.data.data.every((order) => order.status === 'paid')).toBe(true);
      expect(response.data.pagination.total).toBeGreaterThan(0);
    });
  });

  it('PATCH /orders/:id/status updates a pending order to paid', async () => {
    provider
      .given('pending order exists')
      .uponReceiving('update pending order status to paid')
      .withRequest({
        method: 'PATCH',
        path: `/orders/${PENDING_ORDER_ID}/status`,
        headers: {
          'content-type': 'application/json',
          authorization: regex(/^Bearer [\w.-]+$/, 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature'),
        },
        body: { status: 'paid' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: orderExample({
          id: uuid(PENDING_ORDER_ID),
          status: regex(/^(pending|paid|shipped|cancelled)$/, 'paid'),
        }),
      });

    await provider.executeTest(async (mockServer) => {
      const client = new OrdersClient(mockServer.url);
      client.withAuth('eyJhbGciOiJIUzI1NiJ9.payload.signature');
      const response = await client.updateStatus(PENDING_ORDER_ID, 'paid');

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('paid');
    });
  });
});
