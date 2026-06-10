import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Dedicated config for the Postgres integration suite. These tests spin up a
// real Postgres via testcontainers and require the Prisma client generated from
// prisma/schema.postgres.prisma (run `prisma generate --schema
// prisma/schema.postgres.prisma` first — the npm script handles it).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/postgres/**/*.{spec,test}.ts'],
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: {
      junit: 'reports/junit/results.xml',
    },
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@api': path.resolve(__dirname, 'src/api'),
      '@clients': path.resolve(__dirname, 'src/clients'),
      '@schemas': path.resolve(__dirname, 'src/schemas'),
      '@builders': path.resolve(__dirname, 'src/builders'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@types': path.resolve(__dirname, 'src/types'),
    },
  },
});
