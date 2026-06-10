import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();

const sha = (value: string): string => createHash('sha256').update(value).digest('hex');

async function main(): Promise<void> {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.user.deleteMany();

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

  await prisma.user.create({
    data: {
      id: '00000000-0000-0000-0000-000000000003',
      email: 'visitor@acme.test',
      name: 'External Visitor',
      role: 'guest',
      passwordHash: sha('Visitor.read-2026'),
    },
  });

  await prisma.order.create({
    data: {
      id: '10000000-0000-0000-0000-000000000001',
      userId: alice.id,
      status: 'paid',
      totalCents: 25990,
      currency: 'BRL',
      items: {
        create: [
          {
            sku: 'SKU-001',
            description: 'A5 hardcover notebook',
            quantity: 2,
            priceCents: 8990,
          },
          {
            sku: 'SKU-014',
            description: 'Black gel pen',
            quantity: 2,
            priceCents: 4005,
          },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      id: '10000000-0000-0000-0000-000000000002',
      userId: admin.id,
      status: 'pending',
      totalCents: 4990,
      currency: 'BRL',
      items: {
        create: [
          {
            sku: 'SKU-099',
            description: 'Permanent marker',
            quantity: 1,
            priceCents: 4990,
          },
        ],
      },
    },
  });

  console.info('seed complete: 3 users, 2 orders');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
