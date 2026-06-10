# 0004. WireMock and MSW coexist by purpose

- Status: Accepted
- Date: 2026-05-25
- Deciders: QA team

## Context

The test suite needs to simulate HTTP dependencies in two distinct scenarios:

1. The target API needs, in some tests, to consume an external service (e.g., payment gateway, email provider). That service does not exist in the repo; we need a mock server to replace the real endpoint.
2. To validate contract testing from the consumer's perspective (e.g., simulate how a frontend SPA would consume the target API), intercepting calls at the Service Worker level gives the needed control without spinning up extra infrastructure.

The two scenarios have different characteristics. Scenario 1 wants a real server listening on a port, configurable via JSON. Scenario 2 wants transparent interception in the client.

## Decision

Keep WireMock and MSW as complementary tools, each in its appropriate scenario.

- WireMock 3.9 in `mocks/wiremock/mappings/`, running in a Docker container (`docker-compose.yml`). Used when the code under test makes a real HTTP call to an external URL configured by env.
- MSW 2.6 in `mocks/msw/handlers.ts`. Used in tests that simulate the consumer's perspective (e.g., HTTP client integration test) without starting a server.

## Consequences

Positive:

- WireMock is the industry standard for integration tests with external systems. JSON mappings are versionable and auditable. Record-and-replay support is available when we need to derive mocks from real traffic.
- MSW is the modern standard on the frontend. Intercepting at the Service Worker level enables reuse across unit tests, integration tests, and local development of the hypothetical frontend.
- Coexistence separates responsibilities: WireMock JSON does not pollute the TS code; MSW handlers stay typed alongside the suite.

Negative:

- Two technologies to maintain. Mitigated by the clear separation of use and by documentation in the README.
- WireMock is Java; it uses more memory than plain MSW. Acceptable: it runs in an isolated container.

## Alternatives considered

WireMock for everything: would force simulating Service Worker on the frontend, which defeats the point of MSW (realistic interception in the client). Rejected.

MSW for everything: does not work when the code under test calls an external URL via a real Node process outside the jsdom/Service Worker setup. It works in the Vitest scope but fails when the target API itself needs to call an external service. Rejected.

Nock: Node-specific HTTP interceptor, idiomatic and lightweight. Excellent in unit tests, but does not serve as an external mock server for the target API (which runs in another process). We keep nock as a possibility for specific cases, not as the main tool.

Mountebank: flexible virtual service, but its learning overhead is not justified when WireMock covers case 1 with simple JSON mappings.
