# 0006. Rate limit and security headers from the first commit

- Status: Accepted
- Date: 2026-05-25
- Deciders: QA team

## Context

Real APIs rarely go to production without rate limiting and security headers (HSTS, X-Content-Type-Options, X-Frame-Options, etc.). In example projects, these controls are often deferred or removed to simplify setup. That creates two distortions:

1. The test suite does not exercise rate limit or security headers, leaving a large gap in coverage.
2. Anyone cloning the repo learns the wrong pattern: a minimal API with no hardening.

The framework needs to demonstrate real security tests (`tests/security/rate-limit.spec.ts`, `tests/security/auth.spec.ts`). For that, the controls have to exist in the code.

## Decision

Register `@fastify/helmet`, `@fastify/cors`, and `@fastify/rate-limit` in `src/api/app.ts` from the first commit, with configuration parameterizable by env and by `buildApp({ rateLimitMax })`.

Implications:

- Default rate limit: 100 requests per 1-minute window. Adjustable via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW`.
- In functional tests, `buildApp({ rateLimitMax: 10000 })` effectively disables the limit so it does not induce flakiness.
- In `tests/security/rate-limit.spec.ts`, an instance of the app is created with `rateLimitMax: 5` to validate the 429 behavior and `retry-after` header.
- Helmet in default mode with `contentSecurityPolicy: false` (an advanced CSP would interfere with the Swagger UI at `/docs`).
- CORS open with `origin: true, credentials: true` because this is an example API; a future ADR may restrict it.

## Consequences

Positive:

- The security suite tests real behavior, not a behavior mock.
- Headers checked with Supertest serve as a concrete hardening assertion.
- Parameterized configuration removes the false dilemma between protecting production and not breaking tests.
- When using the repo as a reference, the reader learns the correct pattern from the start.

Negative:

- Fastify configuration grows in `src/api/app.ts`. Mitigated by injection via individual plugins and parameters in `buildApp`.
- Tests that fire many requests in parallel need to be aware of the rate limit. Documented in `tests/helpers/build-app.ts`.

## Alternatives considered

Rate limit only in production via NGINX: removes the responsibility from the application but makes it impossible to test 429 behavior without spinning up extra infrastructure. Rejected.

Helmet only when `NODE_ENV=production`: common in small projects, but removes the headers from the test suite. Goes against the goal. Rejected.

Per-user rate limit bucket in the database: more sophisticated, but huge complexity overhead for the scope. We keep rate limit in memory via the official plugin. Can evolve in another ADR when more than one API instance is running.
