import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { prisma } from '../../src/api/prisma.js';

const dbPath = path.resolve('prisma/test.db');

let migrated = false;

export async function ensureMigrations(): Promise<void> {
  if (migrated && existsSync(dbPath)) return;
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    stdio: 'ignore',
  });
  migrated = true;
}

export async function resetDatabase(): Promise<void> {
  await ensureMigrations();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.user.deleteMany();
}

export async function seedMinimal(): Promise<{ adminId: string; userId: string; orderId: string }> {
  const { createHash } = await import('node:crypto');
  const sha = (value: string): string => createHash('sha256').update(value).digest('hex');

  const admin = await prisma.user.create({
    data: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'ricardo.menezes@acme.test',
      name: 'Ricardo Menezes',
      role: 'admin',
      passwordHash: sha('Adm.7421!checkout'),
    },
  });

  const alice = await prisma.user.create({
    data: {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'mariana.castro@acme.test',
      name: 'Mariana Castro',
      role: 'user',
      passwordHash: sha('Mc.92!staging-key'),
    },
  });

  const order = await prisma.order.create({
    data: {
      id: '10000000-0000-0000-0000-000000000001',
      userId: alice.id,
      status: 'paid',
      totalCents: 25990,
      currency: 'BRL',
      items: {
        create: [
          { sku: 'SKU-001', description: 'A5 notebook', quantity: 2, priceCents: 8990 },
          { sku: 'SKU-014', description: 'Gel pen', quantity: 2, priceCents: 4005 },
        ],
      },
    },
  });

  return { adminId: admin.id, userId: alice.id, orderId: order.id };
}
