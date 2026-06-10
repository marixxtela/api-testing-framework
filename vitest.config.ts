import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/helpers/setup.ts'],
    include: ['tests/**/*.{spec,test}.ts'],
    // Postgres integration runs in its own job/config (vitest.postgres.config.ts):
    // it needs the Prisma client generated from schema.postgres.prisma, which is
    // incompatible with the SQLite client the rest of the suite uses.
    exclude: ['node_modules', 'dist', 'pacts', 'tests/integration/postgres/**'],
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: {
      junit: 'reports/junit/results.xml',
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // FIXME: SQLite does not like parallel contention. singleFork is a workaround
    // until the heavy suites (contract, schema) migrate to Postgres via
    // testcontainers and we can parallelize by file again.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/api/server.ts', 'src/types/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
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
