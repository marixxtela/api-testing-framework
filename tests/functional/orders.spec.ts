import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OrdersClient } from '../../src/clients/OrdersClient.js';
import { OrderBuilder } from '../../src/builders/OrderBuilder.js';
import { orderListSchema, orderSchema } from '../../src/schemas/order.schema.js';
import { errorBodySchema } from '../../src/schemas/error.schema.js';
import { listenApp } from '../helpers/app-context.js';
import { resetDatabase, seedMinimal } from '../helpers/database.js';
import { adminCredentials, clearAuthCache, login, userCredentials } from '../../src/utils/auth.js';

describe('Orders API', () => {
  let baseURL: string;
  let close: () => Promise<void>;
  let seeded: { adminId: string; userId: string; orderId: string };
  let client: OrdersClient;

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
    client = new OrdersClient(baseURL);
  });

  async function authedClient(creds = adminCredentials): Promise<OrdersClient> {
    const session = await login(baseURL, creds);
    return new OrdersClient(baseURL).withAuth(session.token);
  }

  describe('GET /orders', () => {
    it('returns paginated orders with the expected structure', async () => {
      const response = await client.list();

      expect(response.status).toBe(200);
      const parsed = orderListSchema.safeParse(response.data);
      expect(parsed.success).toBe(true);
      expect(response.data.pagination).toMatchObject({ page: 1, perPage: 20, total: 1 });
      expect(response.data.data).toHaveLength(1);
    });

    it('filters orders by status', async () => {
      const paid = await client.list({ status: 'paid' });
      const pending = await client.list({ status: 'pending' });

      expect(paid.status).toBe(200);
      expect(paid.data.data).toHaveLength(1);
      expect(paid.data.data[0]!.status).toBe('paid');

      expect(pending.status).toBe(200);
      expect(pending.data.data).toHaveLength(0);
    });

    it('filters orders by userId', async () => {
      const aliceOrders = await client.list({ userId: seeded.userId });
      const adminOrders = await client.list({ userId: seeded.adminId });

      expect(aliceOrders.status).toBe(200);
      expect(aliceOrders.data.data).toHaveLength(1);
      expect(aliceOrders.data.data[0]!.userId).toBe(seeded.userId);

      expect(adminOrders.status).toBe(200);
      expect(adminOrders.data.data).toHaveLength(0);
    });
  });

  describe('GET /orders/:id', () => {
    it('returns the full order matching orderSchema', async () => {
      const response = await client.getById(seeded.orderId);

      expect(response.status).toBe(200);
      expect(() => orderSchema.parse(response.data)).not.toThrow();
      expect(response.data).toMatchObject({
        id: seeded.orderId,
        userId: seeded.userId,
        status: 'paid',
        currency: 'BRL',
      });
      expect(response.data.items.length).toBeGreaterThan(0);
    });

    it('returns 404 when the order does not exist', async () => {
      const response = await client.getById('10000000-0000-0000-0000-0000000000ff');

      expect(response.status).toBe(404);
      const parsed = errorBodySchema.safeParse(response.data);
      expect(parsed.success).toBe(true);
      expect(parsed.data!.error.code).toBe('ORDER_NOT_FOUND');
    });
  });

  describe('POST /orders', () => {
    it('rejects creation without a token, returning 401', async () => {
      const payload = new OrderBuilder(seeded.userId).build();
      const response = await client.create(payload);

      expect(response.status).toBe(401);
      expect(response.data).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    });

    it('creates the order with items and computes totalCents as the sum of quantity times priceCents', async () => {
      const authed = await authedClient(userCredentials);
      const payload = new OrderBuilder(seeded.userId)
        .withItem({ sku: 'SKU-A1', description: 'Item A', quantity: 2, priceCents: 1500 })
        .withItem({ sku: 'SKU-B2', description: 'Item B', quantity: 3, priceCents: 1000 })
        .build();
      // the builder starts with 1 random item; we compute the expected total from the final payload
      const expectedTotal = payload.items.reduce((sum, i) => sum + i.quantity * i.priceCents, 0);

      const response = await authed.create(payload);

      expect(response.status).toBe(201);
      expect(response.headers.location).toMatch(/^\/orders\/[0-9a-f-]{36}$/);
      expect(() => orderSchema.parse(response.data)).not.toThrow();
      expect(response.data.totalCents).toBe(expectedTotal);
      expect(response.data.items).toHaveLength(payload.items.length);
      expect(response.data.status).toBe('pending');
      expect(response.data.userId).toBe(seeded.userId);
    });

    it('returns 404 when the provided userId does not exist', async () => {
      const authed = await authedClient(userCredentials);
      const payload = new OrderBuilder('00000000-0000-0000-0000-0000000000aa').build();

      const response = await authed.create(payload);

      expect(response.status).toBe(404);
      const parsed = errorBodySchema.safeParse(response.data);
      expect(parsed.success).toBe(true);
      expect(parsed.data!.error.code).toBe('USER_NOT_FOUND');
    });

    it('returns 400 when items is empty', async () => {
      const authed = await authedClient(userCredentials);
      const payload = { userId: seeded.userId, currency: 'BRL', items: [] };

      const response = await authed.create(payload);

      expect(response.status).toBe(400);
      expect(response.data).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });

    it('returns 400 when priceCents is negative', async () => {
      const authed = await authedClient(userCredentials);
      const payload = {
        userId: seeded.userId,
        currency: 'BRL',
        items: [{ sku: 'SKU-NEG', description: 'invalid', quantity: 1, priceCents: -100 }],
      };

      const response = await authed.create(payload);

      expect(response.status).toBe(400);
      expect(response.data).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });
  });

  describe('PATCH /orders/:id/status', () => {
    it('admin can change the status to shipped', async () => {
      const authed = await authedClient(adminCredentials);

      const response = await authed.updateStatus(seeded.orderId, 'shipped');

      expect(response.status).toBe(200);
      expect(() => orderSchema.parse(response.data)).not.toThrow();
      expect(response.data.status).toBe('shipped');
    });

    it('regular user gets 403 when trying to change status', async () => {
      const authed = await authedClient(userCredentials);

      const response = await authed.updateStatus(seeded.orderId, 'cancelled');

      expect(response.status).toBe(403);
      expect(response.data).toMatchObject({ error: { code: 'FORBIDDEN' } });
    });
  });

  describe('DELETE /orders/:id', () => {
    it('admin removes order returning 204', async () => {
      const authed = await authedClient(adminCredentials);

      const removed = await authed.remove(seeded.orderId);
      expect(removed.status).toBe(204);

      const followUp = await client.getById(seeded.orderId);
      expect(followUp.status).toBe(404);
    });

    it('regular user gets 403 when trying to remove', async () => {
      const authed = await authedClient(userCredentials);

      const response = await authed.remove(seeded.orderId);

      expect(response.status).toBe(403);
      expect(response.data).toMatchObject({ error: { code: 'FORBIDDEN' } });
    });
  });
});
