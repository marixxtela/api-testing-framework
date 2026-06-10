# 0002. Pact JS for contract testing

- Status: Accepted
- Date: 2026-05-25
- Deciders: QA team

## Context

Contract testing is the framework's differentiator. We need a tool that:

1. Implements the consumer-driven model with expressive matchers.
2. Has a free self-hosted broker for local and CI use.
3. Integrates with the pipeline to block releases via `can-i-deploy`.
4. Works well in the JavaScript/TypeScript ecosystem.
5. Is well known in the market, enough to show up naturally in senior QA job descriptions.

The two serious options evaluated were Pact (Pact Foundation) and Spring Cloud Contract.

## Decision

Adopt Pact JS 13 with a self-hosted Pact Broker on Docker (Postgres as storage).

Implications:

- Generated pacts live in `pacts/` and are published to the broker via `pact-cli`.
- Provider verification runs against the real API started in the background, with `stateHandlers` populating the database.
- The pipeline has two separate workflows: `contract-publish.yml` (consumer) and `contract-verify.yml` (provider), the second one with the `can-i-deploy` gate.

## Consequences

Positive:

- Idiomatic JS API, no need for Ruby subprocesses (modern Pact uses an embedded Rust core).
- Rich matchers (`like`, `eachLike`, `uuid`, `iso8601DateTime`, `regex`) cover real scenarios without relying on fragile literals.
- Official broker in a container, with a dedicated Postgres. 1:1 reproducibility between dev and CI.
- `can-i-deploy` provides a deterministic gate for promotion between environments, a feature absent from simpler alternatives like API snapshot testing.
- Active community, extensive official documentation, examples for many providers.

Negative:

- Learning curve: the provider state concept confuses newcomers. Documented in `docs/contract-testing-guide.md`.
- The Verifier requires the real API to be running, increasing the provider job's duration. Mitigated with a health check before verify.
- Migration to Pactflow (managed service) is straightforward but paid. We keep a self-hosted broker while feasible.

## Alternatives considered

Spring Cloud Contract: mature standard in the JVM ecosystem. On Node projects, it requires running consumer stubs as Maven/Gradle artifacts, adding an entire parallel build stack. Rejected as a poor fit for the project's ecosystem.

Mountebank: creates configurable virtual services, useful for advanced stubs, but does not implement the consumer-driven cycle with a broker. Lacks contract versioning and `can-i-deploy`. Rejected because it does not cover the central use case.

Pure snapshot testing (`tape` or Jest response snapshots): trivial to implement, no deploy gate, no broker visibility, no semantic matchers. Useful as a complement, not a substitute.

Schema-first via OpenAPI without a broker: guarantees that the provider respects the spec but does not guarantee that the real consumer uses the spec. Bi-directional feedback is missing. We keep OpenAPI validation as a complementary suite in `tests/schema/` without replacing Pact.
