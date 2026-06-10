# 0005. SQLite in development, Postgres in production

- Status: Accepted
- Date: 2026-05-25
- Deciders: QA and platform team

## Context

The framework needs a database to persist users, orders, and tokens. In a real scenario, that would be managed Postgres or MySQL. For the repo to work as an executable example, the barrier to entry must be zero: clone, install deps, run.

Three paths were evaluated:

1. Postgres in a container required for any command.
2. SQLite via Prisma with no external dependency.
3. In-memory (sqljs or Postgres-like `pg-mem`) only for tests.

Each path has trade-offs over fidelity to the real environment, setup time, and CI complexity.

## Decision

Use SQLite via Prisma as the default database in development and CI. Document that real production should use Postgres, with migration via Prisma directly (switch `provider` in the schema and adjust column types that differ).

Implications:

- `DATABASE_URL=file:./prisma/dev.db` by default.
- In tests, `DATABASE_URL=file:./prisma/test.db` isolated.
- Migrations live in `prisma/migrations/` and are applied with `prisma migrate deploy` both in dev and in CI.
- Seed in `prisma/seed.ts` populates reproducible example data.

## Consequences

Positive:

- Setup in seconds. Does not require Docker to run functional tests or consumer Pact tests.
- CI does not need a Postgres service in the main job, reducing startup time.
- Prisma abstracts most SQL differences. Service code does not change when swapping providers.

Negative:

- SQLite has no native JSON type. Structured metadata is serialized as a string (within the current scope we do not need that; it was considered when designing the schema).
- Enums are strings with an external check. Acceptable: `role`, `status`, and `currency` are validated via the route schema.
- Write concurrency is lower than Postgres. Irrelevant for test volume.
- Advanced full-text search, functional indexes, and Postgres custom types are out. Not used here.

## Alternatives considered

Postgres in Docker required: increases fidelity to the real environment but adds a barrier to anyone who just wants to run the suite once. Goes against the framework's goal as an executable example. Kept as an explicit option in `docker-compose.yml` (`pact-postgres` already runs; trivial to add `app-postgres` if needed).

`pg-mem`: runs Postgres in memory inside the Node process. Useful for unit tests but not for integration with native Prisma migrate deploy. Rejected for incompatibility with the migration flow.

SQLite in-memory database (`file::memory:?cache=shared`): skipped to avoid losing state across processes during debug. Disk is cheap.

Duplicated schema for dev and prod: introduces drift between environments. Rejected.
