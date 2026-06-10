# MSW handlers

MSW intercepts HTTP requests inside the Node runtime (via the undici/fetch interceptor), which makes the mock invisible to the code under test. No container, no port: `mswServer.listen()` inside `beforeAll` is enough. We use this for "how does the consumer react to X responses" tests without needing the Fastify backend or the database.

## When to use MSW versus WireMock

WireMock is a real HTTP process running in a container. It is worth it when the test crosses the network or when we need the same mock serving a client in another language (k6, Postman). MSW lives inside the Node process, which makes it ideal for unit and integration tests of the HTTP client, where we want to control the response per test with `server.use(...)` and zero boot overhead.

Rule of thumb: if the test is a `*.spec.ts` running on Vitest and what matters is the client logic, prefer MSW. If the scenario also needs to be exercised by k6 or Newman, or if we want to validate client behavior under real latency, go WireMock.

## Layout

`handlers.ts` defines the stubs in the MSW v2 `http.get/http.post` schema, returning `HttpResponse.json`. `server.ts` exports `mswServer = setupServer(...handlers)`. Every test follows the standard cycle: `listen()` in `beforeAll`, `resetHandlers()` in `afterEach`, `close()` in `afterAll`. To override a handler only for the current test, use `mswServer.use(http.get(...))` inside the `it`.

## Minimal example

```ts
import { beforeAll, afterAll, afterEach, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '../../mocks/msw/server.js';
import { UsersClient } from '../../src/clients/UsersClient.js';

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

it('per-test override', async () => {
  mswServer.use(
    http.get('http://localhost/users', () =>
      HttpResponse.json({ data: [], pagination: { page: 1, perPage: 10, total: 0 } }),
    ),
  );
  const client = new UsersClient('http://localhost');
  const res = await client.list();
  expect(res.data.data).toHaveLength(0);
});
```
