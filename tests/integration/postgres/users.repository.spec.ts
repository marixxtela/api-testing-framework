import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { startPgEnv, type PgTestEnv } from './setup.js';

const sha = (value: string): string => createHash('sha256').update(value).digest('hex');

describe('users repository against real Postgres', () => {
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

  it('creates a user and retrieves it by id with the same fields', async () => {
    const created = await env.prisma.user.create({
      data: {
        email: 'ana@example.com',
        name: 'Ana',
        passwordHash: sha('s3cret'),
      },
    });

    const fetched = await env.prisma.user.findUnique({ where: { id: created.id } });

    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.email).toBe('ana@example.com');
    expect(fetched?.name).toBe('Ana');
  });

  it('throws P2002 when violating the email unique constraint', async () => {
    await env.prisma.user.create({
      data: {
        email: 'dup@example.com',
        name: 'First',
        passwordHash: sha('x'),
      },
    });

    await expect(
      env.prisma.user.create({
        data: {
          email: 'dup@example.com',
          name: 'Second',
          passwordHash: sha('y'),
        },
      }),
    ).rejects.toMatchObject({
      constructor: Prisma.PrismaClientKnownRequestError,
      code: 'P2002',
    });
  });

  it('applies the "user" default role when the field is not provided', async () => {
    const created = await env.prisma.user.create({
      data: {
        email: 'default-role@example.com',
        name: 'No Role',
        passwordHash: sha('z'),
      },
    });

    expect(created.role).toBe('user');
  });

  it('loginCount default 0 and increments atomically via update', async () => {
    const user = await env.prisma.user.create({
      data: {
        email: 'counter@example.com',
        name: 'Counter',
        passwordHash: sha('z'),
      },
    });

    expect(user.loginCount).toBe(0);

    const after = await env.prisma.user.update({
      where: { id: user.id },
      data: { loginCount: { increment: 1 } },
    });

    expect(after.loginCount).toBe(1);

    const afterTwo = await env.prisma.user.update({
      where: { id: user.id },
      data: { loginCount: { increment: 1 } },
    });

    expect(afterTwo.loginCount).toBe(2);
  });

  it('accepts lastLoginAt as null and as a datetime', async () => {
    const user = await env.prisma.user.create({
      data: {
        email: 'login@example.com',
        name: 'LoginAt',
        passwordHash: sha('z'),
      },
    });

    expect(user.lastLoginAt).toBeNull();

    const now = new Date();
    const updated = await env.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now },
    });

    expect(updated.lastLoginAt).toBeInstanceOf(Date);
    expect(updated.lastLoginAt?.getTime()).toBe(now.getTime());
  });

  it('findMany respects role filter and pagination via skip and take', async () => {
    const seed = Array.from({ length: 7 }, (_, i) => ({
      email: `user${i}@example.com`,
      name: `User ${i}`,
      passwordHash: sha('z'),
      role: i % 2 === 0 ? 'admin' : 'user',
    }));

    await env.prisma.user.createMany({ data: seed });

    const admins = await env.prisma.user.findMany({
      where: { role: 'admin' },
      orderBy: { email: 'asc' },
    });
    expect(admins.length).toBe(4);

    const firstPage = await env.prisma.user.findMany({
      where: { role: 'admin' },
      orderBy: { email: 'asc' },
      skip: 0,
      take: 2,
    });
    const secondPage = await env.prisma.user.findMany({
      where: { role: 'admin' },
      orderBy: { email: 'asc' },
      skip: 2,
      take: 2,
    });

    expect(firstPage).toHaveLength(2);
    expect(secondPage).toHaveLength(2);
    expect(firstPage[0]!.id).not.toBe(secondPage[0]!.id);
  });

  it('count with where returns the correct number', async () => {
    await env.prisma.user.createMany({
      data: [
        { email: 'a@x.com', name: 'A', passwordHash: sha('z'), role: 'admin' },
        { email: 'b@x.com', name: 'B', passwordHash: sha('z'), role: 'user' },
        { email: 'c@x.com', name: 'C', passwordHash: sha('z'), role: 'user' },
      ],
    });

    const total = await env.prisma.user.count();
    const onlyUsers = await env.prisma.user.count({ where: { role: 'user' } });

    expect(total).toBe(3);
    expect(onlyUsers).toBe(2);
  });

  it('createdAt is populated automatically as a Date after the epoch', async () => {
    const created = await env.prisma.user.create({
      data: {
        email: 'time@example.com',
        name: 'Time',
        passwordHash: sha('z'),
      },
    });

    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.createdAt.getTime()).toBeGreaterThan(new Date(0).getTime());
  });
});
