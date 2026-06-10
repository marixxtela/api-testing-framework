# Integration tests against real Postgres

This suite runs the Prisma repositories against a real Postgres, provisioned at runtime via testcontainers. The goal is to prove the stack works with Postgres, not just SQLite, and to catch type, cascade, and isolation incompatibilities before they reach production.

## Why run against Postgres

The main suite uses SQLite because it is fast and does not require Docker. SQLite, though, is too forgiving in areas that matter: no native `uuid` type, `timestamptz` treated as text, `ON DELETE CASCADE` handled by a different engine, no sequences, no isolation level differentiation, and it accepts certain numeric types Postgres would reject. A Prisma test that passes on SQLite can fail in production for any of those reasons. Running the same scenarios against real Postgres exercises the driver, the pool, and the schema the way they will actually exist.

## How to run locally

Requires Docker running on the machine. Then:

```
npm run test:integration:postgres
```

Each file starts its own ephemeral Postgres container, applies the schema declared in `prisma/schema.postgres.prisma`, and tears the container down at the end.

## What the setup does

The helper in `tests/integration/postgres/setup.ts` uses `@testcontainers/postgresql` to start a `postgres:16-alpine`, captures the generated connection URI, runs `prisma db push --schema prisma/schema.postgres.prisma --skip-generate --accept-data-loss` pointing at that URL, and instantiates a `PrismaClient` with `datasources.db.url` equal to the container. We picked `db push` over `migrate deploy` because the `prisma/migrations` folder contains migrations generated from the SQLite schema, incompatible with Postgres. On an ephemeral test database, applying the schema declaratively is the cleanest path.

## Why it is not in the main suite

Testcontainers requires Docker available, which not every developer has installed, and each container takes 5 to 15 seconds to start. Keeping these tests in a separate suite preserves the fast cycle (`npm test`) without external dependencies and isolates the Postgres verification into its own CI job, run on pull requests and on push to `main`.

## How to add new scenarios

Create a new file under `tests/integration/postgres/` following the existing pattern: a `beforeAll` with a generous timeout calling `startPgEnv()`, an `afterAll` invoking `env.stop()`, and a `beforeEach` that clears the tables in the correct order (children before parents). Always use `env.prisma` to access the database, never the singleton in `src/api/prisma.ts`, so that each file works against its own container with no leakage between suites.

## Limitations

The suite depends on Docker being installed and running, which adds a barrier to local contribution. The approximate overhead is 10 seconds per test file, summing the image pull on the first run plus the Postgres boot. In CI, the total job time usually lands between 1 and 3 minutes. If the machine lacks Docker, the tests fail in `beforeAll` with a clear testcontainers error.
