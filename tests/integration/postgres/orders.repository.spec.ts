import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startPgEnv, type PgTestEnv } from './setup.js';

const sha = (value: string): string => createHash('sha256').update(value).digest('hex');

async function makeUser(env: PgTestEnv, email = 'buyer@example.com') {
  return env.prisma.user.create({
    data: {
      email,
      name: 'Buyer',
      passwordHash: sha('z'),
    },
  });
}

describe('orders repository against real Postgres', () => {
  let env: PgTestEnv;

  beforeAll(async () => {
    env = await startPgEnv();
  }, 120_000);

  afterAll(async () => {
    if (env) {
      await env.stop();
    }
  }, 60_000);

  beforeEach(async () => {
    await env.prisma.orderItem.deleteMany();
    await env.prisma.order.deleteMany();
    await env.prisma.user.deleteMany();
  });

  it('creates an order with inline items and returns include items', async () => {
    const user = await makeUser(env);

    const order = await env.prisma.order.create({
      data: {
        userId: user.id,
        totalCents: 5000,
        items: {
          create: [
            { sku: 'SKU-1', description: 'Item 1', quantity: 2, priceCents: 1500 },
            { sku: 'SKU-2', description: 'Item 2', quantity: 1, priceCents: 2000 },
          ],
        },
      },
      include: { items: true },
    });

    expect(order.items).toHaveLength(2);
    expect(order.status).toBe('pending');
    expect(order.currency).toBe('BRL');
    expect(order.totalCents).toBe(5000);
    expect(order.items.map((i) => i.sku).sort()).toEqual(['SKU-1', 'SKU-2']);
  });

  it('cascade delete: removing a user removes orders and orderItems', async () => {
    const user = await makeUser(env, 'cascade@example.com');

    await env.prisma.order.create({
      data: {
        userId: user.id,
        totalCents: 100,
        items: { create: [{ sku: 'C-1', description: 'X', quantity: 1, priceCents: 100 }] },
      },
    });

    await env.prisma.user.delete({ where: { id: user.id } });

    const orders = await env.prisma.order.count();
    const items = await env.prisma.orderItem.count();

    expect(orders).toBe(0);
    expect(items).toBe(0);
  });

  it('status filter returns only matching orders', async () => {
    const user = await makeUser(env, 'status@example.com');

    await env.prisma.order.createMany({
      data: [
        { userId: user.id, totalCents: 100, status: 'pending' },
        { userId: user.id, totalCents: 200, status: 'paid' },
        { userId: user.id, totalCents: 300, status: 'paid' },
        { userId: user.id, totalCents: 400, status: 'cancelled' },
      ],
    });

    const paid = await env.prisma.order.findMany({ where: { status: 'paid' } });

    expect(paid).toHaveLength(2);
    expect(paid.every((o) => o.status === 'paid')).toBe(true);
  });

  it('userId filter returns only orders of the provided user', async () => {
    const userA = await makeUser(env, 'a@example.com');
    const userB = await makeUser(env, 'b@example.com');

    await env.prisma.order.createMany({
      data: [
        { userId: userA.id, totalCents: 10 },
        { userId: userA.id, totalCents: 20 },
        { userId: userB.id, totalCents: 30 },
      ],
    });

    const ofA = await env.prisma.order.findMany({ where: { userId: userA.id } });
    const ofB = await env.prisma.order.findMany({ where: { userId: userB.id } });

    expect(ofA).toHaveLength(2);
    expect(ofB).toHaveLength(1);
    expect(ofA.every((o) => o.userId === userA.id)).toBe(true);
  });

  it('status update changes the value and returns the full order', async () => {
    const user = await makeUser(env, 'update@example.com');

    const created = await env.prisma.order.create({
      data: {
        userId: user.id,
        totalCents: 999,
        items: { create: [{ sku: 'U-1', description: 'U', quantity: 1, priceCents: 999 }] },
      },
    });

    const updated = await env.prisma.order.update({
      where: { id: created.id },
      data: { status: 'paid' },
      include: { items: true },
    });

    expect(updated.status).toBe('paid');
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0]!.sku).toBe('U-1');
  });

  it('totalCents int accepts large values near the int4 limit', async () => {
    const user = await makeUser(env, 'bigtotal@example.com');

    const big = 2_000_000_000;

    const created = await env.prisma.order.create({
      data: {
        userId: user.id,
        totalCents: big,
      },
    });

    expect(created.totalCents).toBe(big);

    const fetched = await env.prisma.order.findUnique({ where: { id: created.id } });
    expect(fetched?.totalCents).toBe(big);
  });
});
