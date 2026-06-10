import 'dotenv/config';
import path from 'node:path';

if (!process.env.API_BASE_URL) {
  process.env.API_BASE_URL = 'http://localhost:3000';
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-only-secret-do-not-use-in-prod';
}

if (process.env.NODE_ENV === 'test' || !process.env.DATABASE_URL) {
  const absolute = path.resolve(process.cwd(), 'prisma/test.db');
  process.env.DATABASE_URL = `file:${absolute}`;
}
