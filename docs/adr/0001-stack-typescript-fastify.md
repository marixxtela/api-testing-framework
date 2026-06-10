# 0001. Stack TypeScript, Fastify, and Vitest

- Status: Accepted
- Date: 2026-05-25
- Deciders: QA and platform team

## Context

The project needs a realistic target API to exercise functional tests, contract testing, security, and performance. The stack choice directly affects what can be demonstrated: JSON Schema serialization, ready-made security plugins, native ESM in the tests, Pact and k6 integration.

Constraints considered:

1. The language must be familiar to the QA team and widely known in the market. JavaScript/TypeScript fits.
2. The HTTP framework needs a mature plugin ecosystem for auth, rate limit, helmet, swagger, and GraphQL.
3. The test runner needs to run TypeScript ESM without transformation hacks and provide a Jest-like API to reduce the learning curve.

## Decision

Adopt Node.js 20 LTS with TypeScript 5.6 in native ESM, Fastify 5 as the HTTP framework, and Vitest 2 as the test runner.

Concrete implications:

- `package.json` declares `"type": "module"`. Relative imports use `.js` even when pointing to `.ts` files (TS NodeNext rule).
- Fastify loads plugins via `await app.register(...)` in `src/api/app.ts`. Each plugin (helmet, cors, rate-limit, jwt, swagger, mercurius) is isolated and testable.
- Vitest runs with `vitest.config.ts` and does not need Babel or ts-jest. Watch mode uses the Vite dev server under the hood.

## Consequences

Positive:

- Response serialization via Fastify's JSON Schema reduces response time by an order of magnitude compared to Express + `res.json()`.
- Official plugins cover 100% of the security and observability needs of this scope.
- Vitest speeds up the TDD loop; startup is noticeably lower than an equivalent Jest setup.
- TypeScript catches schema errors at compile time when combined with Zod (`z.infer`).

Negative:

- Native ESM still has occasional friction with older CommonJS libraries. Solved case by case with dynamic `import`.
- Fastify requires an initial learning curve to understand plugin registration order and hook lifecycle.
- Vitest has a smaller ecosystem than Jest, although it is API-compatible in most cases.

## Alternatives considered

Express + Jest: older stack, plugins via middleware instead of first-class plugins. No built-in JSON Schema. Jest has heavy startup and ESM support via experimental flags. Rejected for inferior speed and ergonomics.

NestJS: opinionated framework with full DI and decorators. Excellent for large teams, but adds indirection (modules, providers, controllers, services) that pollutes the example code and makes it harder to read for someone unfamiliar with the framework. Rejected due to pedagogical overhead.

Hono: minimalist, focused on edge runtimes. Auth and rate limit plugins are still less mature than Fastify's. Rejected due to ecosystem immaturity at decision time.

Deno: modern runtime with native TS. Prisma support and several Node ecosystem libraries are still partial. Rejected to avoid friction with Pact JS and Mercurius.
