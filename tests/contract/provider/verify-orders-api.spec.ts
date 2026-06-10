import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { Verifier, type VerifierOptions } from '@pact-foundation/pact';
import { createHash } from 'node:crypto';
import { listenApp } from '../../helpers/app-context.js';
import { resetDatabase } from '../../helpers/database.js';
import { prisma } from '../../../src/api/prisma.js';
import { adminCredentials, login } from '../../../src/utils/auth.js';

const PACTS_DIR = path.resolve(process.cwd(), 'pacts');
const PROVIDER_NAME = 'OrdersAPI';
const PROVIDER_VERSION = process.env.GIT_SHA ?? 'local';
const PROVIDER_BRANCH = process.env.GIT_BRANCH ?? 'local';
const BROKER_URL = process.env.PACT_BROKER_URL;
const BROKER_TOKEN = process.env.PACT_BROKER_TOKEN;
const SHOULD_PUBLISH = Boolean(BROKER_URL && BROKER_TOKEN);

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const PAID_ORDER_ID = '10000000-0000-0000-0000-000000000001';
const PENDING_ORDER_ID = '10000000-0000-0000-0000-000000000002';

const sha = (value: string): string => createHash('sha256').update(value).digest('hex');

async function seedAdminAndUser(): Promise<void> {
  await prisma.user.upsert({
    where: { id: ADMIN_ID },
    update: {},
    create: {
      id: ADMIN_ID,
      email: 'ricardo.menezes@acme.test',
      name: 'Ricardo Menezes',
      role: 'admin',
      passwordHash: sha('Adm.7421!checkout'),
    },
  });
  await prisma.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: {
      id: USER_ID,
      email: 'mariana.castro@acme.test',
      name: 'Mariana Castro',
      role: 'user',
      passwordHash: sha('Mc.92!staging-key'),
    },
  });
}

async function seedPaidOrder(): Promise<void> {
  await resetDatabase();
  await seedAdminAndUser();
  await prisma.order.create({
    data: {
      id: PAID_ORDER_ID,
      userId: USER_ID,
      status: 'paid',
      totalCents: 25990,
      currency: 'BRL',
      createdAt: new Date('2025-01-10T12:00:00.000Z'),
      items: {
        create: [
          { sku: 'SKU-001', description: 'A5 notebook', quantity: 2, priceCents: 8990 },
          { sku: 'SKU-014', description: 'Gel pen', quantity: 2, priceCents: 4005 },
        ],
      },
    },
  });
}

async function seedMultiplePaidOrders(): Promise<void> {
  await resetDatabase();
  await seedAdminAndUser();
  for (let i = 0; i < 3; i += 1) {
    await prisma.order.create({
      data: {
        userId: USER_ID,
        status: 'paid',
        totalCents: 10000 + i * 1000,
        currency: 'BRL',
        items: {
          create: [
            {
              sku: `SKU-${i}`,
              description: `Item ${i}`,
              quantity: 1,
              priceCents: 10000 + i * 1000,
            },
          ],
        },
      },
    });
  }
}

async function seedPendingOrder(): Promise<void> {
  await resetDatabase();
  await seedAdminAndUser();
  await prisma.order.create({
    data: {
      id: PENDING_ORDER_ID,
      userId: ADMIN_ID,
      status: 'pending',
      totalCents: 4990,
      currency: 'BRL',
      items: {
        create: [
          { sku: 'SKU-099', description: 'Permanent marker', quantity: 1, priceCents: 4990 },
        ],
      },
    },
  });
}

describe('Pact provider verification: OrdersAPI', () => {
  let baseURL: string;
  let close: () => Promise<void>;
  // Token produced on demand by the app's own /auth/login: guarantees a valid signature with the active JWT_SECRET.
  let adminToken = '';

  beforeAll(async () => {
    const handle = await listenApp();
    baseURL = handle.url;
    close = handle.close;
  });

  afterAll(async () => {
    await close();
    await prisma.$disconnect();
  });

  it('honors every contract from the CheckoutApp consumer', async () => {
    const options: VerifierOptions = {
      provider: PROVIDER_NAME,
      providerBaseUrl: baseURL,
      providerVersion: PROVIDER_VERSION,
      providerVersionBranch: PROVIDER_BRANCH,
      logLevel: 'warn',
      timeout: 60_000,
      stateHandlers: {
        'paid order exists': async () => {
          await seedPaidOrder();
        },
        'authenticated user': async () => {
          await seedPaidOrder();
          const session = await login(baseURL, adminCredentials, false);
          adminToken = session.token;
        },
        'paid orders exist': async () => {
          await seedMultiplePaidOrders();
        },
        'pending order exists': async () => {
          await seedPendingOrder();
          const session = await login(baseURL, adminCredentials, false);
          adminToken = session.token;
        },
      },
      requestFilter: (req, _res, next) => {
        // The consumer test sends an Authorization placeholder. We replace it with a real JWT
        // signed by Fastify itself so protected routes accept the call.
        if (req.headers['authorization'] && adminToken) {
          req.headers['authorization'] = `Bearer ${adminToken}`;
        }
        next();
      },
    };

    if (SHOULD_PUBLISH) {
      options.pactBrokerUrl = BROKER_URL;
      options.pactBrokerToken = BROKER_TOKEN;
      options.publishVerificationResult = true;
      options.consumerVersionSelectors = [{ mainBranch: true }, { deployedOrReleased: true }];
    } else {
      if (!existsSync(PACTS_DIR)) {
        throw new Error(
          `Pacts directory not found at ${PACTS_DIR}. Run npm run test:pact:consumer first.`,
        );
      }
      const files = readdirSync(PACTS_DIR)
        .filter((file) => file.endsWith('.json') && file.toLowerCase().includes('-ordersapi'))
        .map((file) => path.join(PACTS_DIR, file));

      if (files.length === 0) {
        throw new Error(`No pact for ${PROVIDER_NAME} found in ${PACTS_DIR}.`);
      }
      options.pactUrls = files;
    }

    await new Verifier(options).verifyProvider();
  }, 120_000);
});
