# API Testing Framework

[![CI](https://img.shields.io/github/actions/workflow/status/marixxtela/api-testing-framework/ci.yml?label=CI)](./.github/workflows/ci.yml)
[![Security](https://img.shields.io/github/actions/workflow/status/marixxtela/api-testing-framework/security.yml?label=security)](./.github/workflows/security.yml)
[![Contract verify](https://img.shields.io/github/actions/workflow/status/marixxtela/api-testing-framework/contract-verify.yml?label=contract-verify)](./.github/workflows/contract-verify.yml)
[![Integration Postgres](https://img.shields.io/github/actions/workflow/status/marixxtela/api-testing-framework/integration-postgres.yml?label=integration-postgres)](./.github/workflows/integration-postgres.yml)
[![Release](https://img.shields.io/github/actions/workflow/status/marixxtela/api-testing-framework/release.yml?label=release)](./.github/workflows/release.yml)
[![Node](https://img.shields.io/badge/node-20.18-339933?logo=node.js&logoColor=white)](./.nvmrc)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](./tsconfig.json)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)](https://fastify.dev)
[![Vitest](https://img.shields.io/badge/Vitest-2-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)
[![Pact](https://img.shields.io/badge/contracts-Pact%20JS%2013-1F8AC0)](./tests/contract)
[![k6](https://img.shields.io/badge/perf-k6-7D64FF?logo=k6&logoColor=white)](./tests/performance)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)](./prisma/schema.prisma)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

A self-contained sandbox for testing REST and GraphQL APIs in TypeScript. The target API (Fastify 5 with Mercurius and Prisma) and its test suites live in the same repository on purpose, so the project can demonstrate the full spectrum of modern API quality engineering against a real, runnable service without depending on an external system. It demonstrates an end-to-end, CI-enforced testing strategy (including breaking-change and can-i-deploy gates) layered over one cohesive codebase.

## What it covers

- Self-contained target API (Fastify 5) plus tests in one repo, so contract, schema, and performance testing run with no external dependency.
- REST and GraphQL surface: Fastify routes (users, orders, auth, health) plus a Mercurius GraphQL schema and resolvers.
- OpenAPI spec generated and served by Fastify (`@fastify/swagger` with Swagger UI at `/docs`), exported via `scripts/export-openapi.ts` and validated in tests.
- Zod schemas in `src/schemas/` as the single source of truth for response shapes, consumed by typed clients in `src/clients/` used in tests.
- Consumer-driven and provider contract testing with Pact for two pairs (FrontendApp to UsersAPI, CheckoutApp to OrdersAPI), plus can-i-deploy and bi-directional (BDCT) checks.
- External-scenario mocking with both WireMock (mappings and `__files`) and MSW handlers and server.
- Prisma data layer with SQLite for dev and a separate Postgres schema and config exercised via testcontainers in CI.
- Security hardening in the API itself: `@fastify/helmet`, CORS, JWT auth, rate limiting, and under-pressure, plus a dedicated security test suite.
- Observability built in: Pino logging, a request-context plugin, and Prometheus metrics via `prom-client` (`/metrics`) with health and ready endpoints.
- Performance testing with k6 (smoke, load, stress, and spike scenarios).
- Mutation testing with Stryker (TypeScript checker plus Vitest runner).
- OpenAPI breaking-change gate on PRs via oasdiff with an `[allow-breaking]` bypass.
- Supply-chain security automation: CodeQL, Semgrep, Trivy, npm audit, Gitleaks, SPDX SBOM with Grype.
- Conventional commits enforced via Husky, commitlint, and commitizen, with automated releases via semantic-release.
- Postman and Newman collection and environment for manual and exploratory API runs.
- Architecture Decision Records in `docs/adr/` and additional guides in `docs/`.

## Tech stack

| Area              | Tools                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| Runtime           | Node.js 20.18, TypeScript 5.6                                                                         |
| API               | Fastify 5, Mercurius (GraphQL 16), Zod 3                                                              |
| Data              | Prisma 5 (SQLite in dev, Postgres in prod and CI)                                                     |
| Observability     | Pino logging, prom-client (Prometheus metrics)                                                        |
| Testing core      | Vitest 2, Supertest, graphql-request, Ajv and openapi-schema-validator                                |
| Contract testing  | Pact JS 13 (`@pact-foundation/pact`)                                                                  |
| Mocking           | WireMock 3, MSW 2                                                                                     |
| Performance       | k6                                                                                                    |
| API runs          | Newman and Postman                                                                                    |
| Mutation testing  | Stryker 8                                                                                             |
| Integration infra | testcontainers with `@testcontainers/postgresql`, Docker and docker-compose                           |
| Tooling           | ESLint 9, Prettier 3, Husky, lint-staged, commitlint, commitizen, semantic-release, `@faker-js/faker` |

## Architecture

The target API lives in `src/api/`, split into routes, services, plugins, repositories, and GraphQL. Typed clients in `src/clients/` are consumed by the tests in `tests/`, ensuring that the Zod schemas in `src/schemas/` are the only place where response shapes are defined. WireMock and MSW cover external scenarios that the target API does not expose. The OpenAPI spec is generated and served by Fastify itself at `/docs`, exported by `scripts/export-openapi.ts`, and validated by the schema tests.

For the complete contract testing flow (consumer publishes, provider verifies, can-i-deploy before deploy), see [`docs/contract-testing-guide.md`](./docs/contract-testing-guide.md).

## Getting started

### Prerequisites

- Node.js 20.18.0 (managed via `.nvmrc`; run `nvm install`).
- npm 10.
- Docker, for WireMock, the Pact Broker, the docker-compose stack, and Postgres testcontainers.
- k6 installed locally, only needed to run performance tests locally.

### Install and run

```bash
cd api-testing-framework
cp .env.example .env
make setup         # npm ci + prisma generate + migrate + seed
make api           # starts the API in watch mode
make test          # runs the Vitest suite in another terminal
```

For the full stack in containers, run `make up` (API, WireMock, and Pact Broker) and `make down` to tear it down. For commits following conventional commits, run `npm run commit` (commitizen).

## Usage and running tests

The default `make test` (Vitest) excludes the Postgres integration suite, which is CI-only. Slow or optional suites (mutation testing, k6 load, Newman) are kept out of `make test` so fast feedback stays fast.

### Make targets

| Target                  | Does                                                 |
| ----------------------- | ---------------------------------------------------- |
| `make setup`            | install, prisma generate, migrate, and seed          |
| `make api`              | API in watch mode (tsx)                              |
| `make up` / `make down` | Bring up or tear down API, WireMock, and Pact Broker |
| `make test`             | Main Vitest suite                                    |
| `make test-functional`  | Only `tests/functional`                              |
| `make test-contract`    | Consumer plus provider Pact verification             |
| `make test-security`    | Security suite                                       |
| `make test-perf`        | k6 smoke test                                        |
| `make test-heavy`       | Vitest, k6 smoke, and Newman (slow, optional)        |
| `make lint`             | ESLint with zero warnings                            |
| `make typecheck`        | `tsc --noEmit`                                       |

### npm scripts by test type

| Script                              | Does                                                              |
| ----------------------------------- | ----------------------------------------------------------------- |
| `npm run test`                      | Full Vitest suite; excludes Postgres integration                  |
| `npm run test:functional`           | Functional REST tests (`tests/functional`)                        |
| `npm run test:graphql`              | GraphQL tests (`tests/graphql`)                                   |
| `npm run test:schema`               | OpenAPI schema-validation tests (`tests/schema`)                  |
| `npm run test:security`             | Security tests (`tests/security`)                                 |
| `npm run test:integration`          | Integration tests (`tests/integration`), for example MSW consumer |
| `npm run test:integration:postgres` | Postgres repository tests via testcontainers (CI focused)         |
| `npm run test:pact:consumer`        | Pact consumer tests, generating contracts under `pacts/`          |
| `npm run test:pact:provider`        | Pact provider verification                                        |
| `npm run test:perf:smoke`           | k6 smoke test (`tests/performance/smoke.js`)                      |
| `npm run test:perf:load`            | k6 load test (`tests/performance/load.js`)                        |
| `npm run test:postman`              | Postman collection via Newman (requires the API running)          |
| `npm run test:coverage`             | Vitest with coverage (`@vitest/coverage-v8`)                      |
| `npm run test:mutation`             | Stryker mutation testing                                          |

### Test types

| Type                  | Tooling                                                     | Location                                       |
| --------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| Functional REST       | Vitest plus Supertest (includes observability)              | `tests/functional/`                            |
| GraphQL               | Vitest plus graphql-request                                 | `tests/graphql/`                               |
| Schema (OpenAPI)      | Vitest plus Ajv and openapi-schema-validator                | `tests/schema/`                                |
| Security              | Vitest (auth, injection, rate limit, headers)               | `tests/security/`                              |
| Contract consumer     | Pact JS (FrontendApp to UsersAPI, CheckoutApp to OrdersAPI) | `tests/contract/consumer/`                     |
| Contract provider     | Pact JS (verify-users-api, verify-orders-api)               | `tests/contract/provider/`                     |
| Integration with MSW  | Vitest plus MSW                                             | `tests/integration/`                           |
| Postgres repository   | testcontainers (CI focused)                                 | `tests/integration/postgres/`                  |
| Performance           | k6 (smoke, load, stress, spike)                             | `tests/performance/`                           |
| Postman and Newman    | Newman                                                      | `postman/`                                     |
| Mutation              | Stryker (optional, outside the default run)                 | `npm run test:mutation`                        |
| Bi-directional (BDCT) | oasdiff and swagger-mock-validator (CI)                     | `.github/workflows/contract-bidirectional.yml` |

The endpoint by test-type matrix lives in [`docs/api-coverage-matrix.md`](./docs/api-coverage-matrix.md).

### Other scripts

| Script                      | Does                                                                 |
| --------------------------- | -------------------------------------------------------------------- |
| `npm run api:dev`           | Run the API in watch mode (`tsx watch src/api/server.ts`)            |
| `npm run api:build`         | Compile the API to `dist` via `tsconfig.build.json`                  |
| `npm run api:start`         | Run the compiled API (`node dist/api/server.js`)                     |
| `npm run openapi:export`    | Export the OpenAPI spec to `openapi/`                                |
| `npm run db:migrate`        | Run `prisma migrate dev`                                             |
| `npm run db:reset`          | Reset the database                                                   |
| `npm run db:seed`           | Seed the database                                                    |
| `npm run mocks:wiremock`    | Run a WireMock 3.9.1 container serving `mocks/wiremock` on port 8089 |
| `npm run pact:publish`      | Publish pacts to a Pact Broker                                       |
| `npm run pact:can-i-deploy` | Query the broker can-i-deploy before promoting a release             |
| `npm run release`           | Run semantic-release (`release:dry` for a dry run)                   |

## Continuous integration

| Workflow                     | Gates                                                                                                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ci.yml`                     | Lint and typecheck, functional and GraphQL tests, schema and security tests, coverage artifact, production build with a built-binary smoke test (health, ready, metrics), multi-arch Docker build (alpine and distroless), and a k6 smoke job (continue-on-error). |
| `openapi-diff.yml`           | On PRs touching the API or spec, exports head and base OpenAPI specs, runs oasdiff, posts a sticky PR comment, and fails on breaking changes unless the commit message contains `[allow-breaking]`.                                                                |
| `security.yml`               | CodeQL and Semgrep SAST, dependency-review, npm audit, Trivy filesystem and image scans, SPDX SBOM with Grype scan, and Gitleaks. Runs on push, PRs, weekly schedule, and manual.                                                                                  |
| `contract-publish.yml`       | Runs Pact consumer tests, uploads pacts as an artifact, and (on main, if a broker is configured) publishes pacts and the OpenAPI provider contract (BDCT).                                                                                                         |
| `contract-verify.yml`        | Builds and seeds the DB, starts the API, runs Pact provider verification, and runs can-i-deploy on pushes to main when a broker is configured.                                                                                                                     |
| `contract-bidirectional.yml` | Cross-checks the OpenAPI spec against consumer pacts, publishing provider contracts to the broker when configured, otherwise running local validation with swagger-mock-validator.                                                                                 |
| `integration-postgres.yml`   | Runs Prisma repository integration tests against a real Postgres database spun up via testcontainers.                                                                                                                                                              |
| `mutation.yml`               | Stryker mutation testing on a weekly schedule and manual dispatch; uploads the HTML report and a score summary. Marked continue-on-error while the baseline stabilizes.                                                                                            |
| `release.yml`                | On push to main, builds the API, exports the OpenAPI spec, generates an SBOM, runs semantic-release, and attaches the SBOM to the GitHub release.                                                                                                                  |

## Project structure

```
src/        Target API and shared code: api/ (routes, services, plugins,
            repositories, graphql), clients/, schemas/, builders/, utils/, types/
tests/      functional, graphql, schema, security, contract/{consumer,provider},
            integration/{,postgres}, performance, helpers
prisma/     SQLite and Postgres schemas, seed, migrations
mocks/      wiremock (mappings, __files) and msw (handlers, server)
postman/    Postman collection and environment
pacts/      Sample contracts
openapi/    Exported OpenAPI spec
scripts/    OpenAPI export tooling
docs/       Architecture, contract, security, mutation guides, and adr/ ADRs
docker/     Dockerfiles and compose files
.github/    CI and quality workflows
```

Tooling configs at the root cover Vitest, ESLint, Prettier, Stryker, Husky, commitlint, and semantic-release.

## Performance profiles

The k6 suite under `tests/performance/` covers four scenarios: `smoke.js`, `load.js`, `stress.js`, and `spike.js`. The smoke test runs in CI (continue-on-error) and via `make test-perf`. The others are run locally with `npm run test:perf:load` and the k6 CLI. k6 must be installed locally.

## Known limitations

These are honest notes worth reading before using this in production.

- `vitest.config.ts` uses `singleFork: true` because of SQLite contention under parallel runs.
- The initial migration in `prisma/migrations/` was generated against SQLite. The Postgres schema in `prisma/schema.postgres.prisma` is applied via `prisma db push` in tests, so there is no Postgres migration history yet.
- `config.ts` still has `JWT_SECRET` with a test default. Running `node dist/api/server.js` without an env defined comes up with a known secret.
- The coverage thresholds in `vitest.config.ts` (80 percent line, function, and statement; 75 percent branch) were not measured against the current code and may be optimistic. Run `npm run test:coverage` before treating them as a real gate.
- `mutation.yml` has `continue-on-error: true` until the mutation-score baseline stabilizes.

## Additional documentation

- [Architecture](./docs/architecture.md)
- [Contract testing guide](./docs/contract-testing-guide.md)
- [Coverage matrix by endpoint](./docs/api-coverage-matrix.md)
- [Security automation](./docs/security-automation.md)
- [Mutation testing](./docs/mutation-testing.md)
- [OpenAPI diff and BDCT](./docs/openapi-diff-bdct.md)
- [Postgres via testcontainers](./docs/integration-postgres.md)
- [Release workflow](./docs/release-workflow.md)
- ADRs in [`docs/adr/`](./docs/adr/)
- [How to contribute](./CONTRIBUTING.md), [Security policy](./SECURITY.md), [Changelog](./CHANGELOG.md)

## License

MIT. See [`LICENSE`](./LICENSE).
