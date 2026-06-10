import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startPgEnv, type PgTestEnv } from './setup.js';

const sha = (value: string): string => createHash('sha256').update(value).digest('hex');

describe('auth flow against real Postgres', () => {
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

  it('creates a user with sha256 passwordHash, looks up by email, and validates comparison', async () => {
    const password = 'pa55w0rd!';
    const expectedHash = sha(password);

    await env.prisma.user.create({
      data: {
        email: 'login@example.com',
        name: 'Login User',
        passwordHash: expectedHash,
      },
    });

    const found = await env.prisma.user.findUnique({ where: { email: 'login@example.com' } });

    expect(found).not.toBeNull();
    expect(found?.passwordHash).toBe(expectedHash);
    expect(found?.passwordHash).toBe(sha(password));
    expect(found?.passwordHash).not.toBe(sha('wrong-password'));
  });

  it('updating lastLoginAt and incrementing loginCount happen atomically', async () => {
    const user = await env.prisma.user.create({
      data: {
        email: 'atomic@example.com',
        name: 'Atomic',
        passwordHash: sha('z'),
      },
    });

    expect(user.loginCount).toBe(0);
    expect(user.lastLoginAt).toBeNull();

    const before = Date.now();
    const updated = await env.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
      },
    });

    expect(updated.loginCount).toBe(1);
    expect(updated.lastLoginAt).toBeInstanceOf(Date);
    expect(updated.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(before - 1);

    const second = await env.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
      },
    });

    expect(second.loginCount).toBe(2);
  });
});
