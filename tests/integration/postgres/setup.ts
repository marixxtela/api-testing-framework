import { execSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';

export interface PgTestEnv {
  url: string;
  prisma: PrismaClient;
  stop(): Promise<void>;
}

const POSTGRES_IMAGE = 'postgres:16-alpine';
const SCHEMA_PATH = 'prisma/schema.postgres.prisma';

// db push instead of migrate deploy: the migrations versioned in
// prisma/migrations are from the SQLite schema and break on Postgres.
// TODO: generate a postgres-first migration trail once the schema stops
// changing (internal issue: PLAT-142).
export async function startPgEnv(): Promise<PgTestEnv> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase('apidb')
    .withUsername('test')
    .withPassword('test')
    .start();

  const url = container.getConnectionUri();

  execSync(`npx prisma db push --schema ${SCHEMA_PATH} --skip-generate --accept-data-loss`, {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });

  const prisma = new PrismaClient({
    datasources: { db: { url } },
    log: [],
  });

  return {
    url,
    prisma,
    async stop() {
      try {
        await prisma.$disconnect();
      } finally {
        await container.stop();
      }
    },
  };
}
