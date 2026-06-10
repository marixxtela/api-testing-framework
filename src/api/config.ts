import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().default('file:./prisma/dev.db'),
  JWT_SECRET: z.string().min(16).default('test-only-secret-do-not-use-in-prod'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  CORS_ORIGINS: z.string().default('*'),
  TRUST_PROXY: z.coerce.boolean().default(false),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  METRICS_ENABLED: z.coerce.boolean().default(true),
  METRICS_PATH: z.string().default('/metrics'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1_048_576),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
