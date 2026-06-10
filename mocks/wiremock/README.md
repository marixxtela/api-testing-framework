# WireMock mappings

HTTP mock server used to simulate API scenarios we do not want to depend on the real backend for: rate limit, high latency, upstream 500, huge payloads. It runs in a container and responds on the same routes as the target API, which lets us swap the client base URL without changing test code.

## How to start

The shortcut is in `package.json`:

```bash
npm run mocks:wiremock
```

It runs `docker run --rm -p 8089:8080 -v $PWD/mocks/wiremock:/home/wiremock wiremock/wiremock:3.9.1`. Files under `mappings/` become stubs and `__files/` serves large responses via `bodyFileName`. To point the tests at the mock, export `API_BASE_URL=http://localhost:8089` before running Vitest.

## Layout

Each file under `mappings/` is an independent stub in the official WireMock schema (`request`, `response`, `priority`). We keep one stub per scenario to make PR diffs easy and let us disable individual mappings when needed. Responses with more than twenty lines go into `__files/` and are referenced by `bodyFileName`, keeping the mapping readable.

## Adding a new mapping

Create `mappings/<scenario-name>.json` with a unique `id` uuid, a descriptive `name`, a `request` (method + `urlPath` or `urlPattern`), and a `response` (status, headers, `jsonBody` or `bodyFileName`). For body matching on POST/PUT use `bodyPatterns` with `equalToJson` + `ignoreExtraElements`. Reload via `POST http://localhost:8089/__admin/mappings/reset` or restart the container.

## Covered scenarios

- `users-list.json`: GET /users with 3 fixed users valid against the Zod `userListSchema`.
- `user-by-id.json`: GET of a specific id that always returns 200.
- `user-not-found.json`: GET of an id that always returns 404 with `errorBody`.
- `login-success.json`: POST /auth/login matching the admin body, returns a fake JWT with a valid base64 payload (fake signature, do not verify).
- `rate-limit.json`: 429 with `Retry-After` and `X-RateLimit-*` headers.
- `slow-response.json`: 200 with `fixedDelayMilliseconds: 3000` to test client timeout.
- `server-error.json`: 500 from the upstream to test error handling.
