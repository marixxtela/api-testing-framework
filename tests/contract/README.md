# Contract testing with Pact

This suite covers two consumer/provider pairs:

- `FrontendApp` consuming `UsersAPI`
- `CheckoutApp` consuming `OrdersAPI`

The consumer tests generate JSON contracts under `pacts/` (a git-ignored folder). The provider tests start the local API, apply the state handlers, and validate that each interaction described in the contract is still honored.

## Commands

| Action                              | Command                                                  |
| ----------------------------------- | -------------------------------------------------------- |
| Generate pacts (consumer side)      | `npm run test:pact:consumer`                             |
| Verify provider against local pacts | `npm run test:pact:provider`                             |
| Publish pacts to the broker         | `npm run pact:publish`                                   |
| Ask the broker `can-i-deploy`       | `npm run pact:can-i-deploy`                              |
| Start the local broker in Docker    | `docker compose -f docker/docker-compose.pact.yml up -d` |

## Local end-to-end flow

1. Run `npm run db:reset && npm run db:seed` to start from a clean database.
2. Run `npm run test:pact:consumer`. The `FrontendApp-UsersAPI.json` and `CheckoutApp-OrdersAPI.json` files appear under `pacts/`.
3. Run `npm run test:pact:provider`. The API is started on an ephemeral port via `listenApp()` and the `Verifier` applies each state handler before the matching interaction.

## Recognized environment variables

- `PACT_BROKER_URL`, `PACT_BROKER_TOKEN`: when both are set, the provider publishes the result to the broker and fetches pacts via `consumerVersionSelectors` (`mainBranch` + `deployedOrReleased`). Without them, it reads directly from `pacts/*.json`.
- `GIT_SHA`, `GIT_BRANCH`: used as `providerVersion` and `providerVersionBranch`. Default: `local`.
- `JWT_SECRET`: the API itself uses this secret to sign tokens; the orders provider performs a real login to `/auth/login` to get a valid JWT and injects it via `requestFilter`.

## Consumer-driven vs provider-driven

The consumer-driven school (which Pact implements) is based on the premise that whoever knows the API is the one who consumes it. Each consumer writes a contract reflecting only the subset they actually use: fields read, values accepted, status codes they can handle. The provider, upon receiving that contract, proves it can still satisfy it. Changes no consumer depends on remain free; changes that would break a consumer show up in CI before merge.

The provider-driven school flips it: the provider publishes a spec (OpenAPI, JSON Schema, IDL) and each consumer has to conform. That is the natural model for public APIs with many unknown consumers. The downside is that spec changes require coordination through explicit versioning, and the provider only finds out who broke after deploy.

In this project we use consumer-driven because the simulated scenario is a company with a few well-identified internal consumers. Each consumer writes its expectations, the provider verifies the files, and the broker centralizes the compatibility state so that `can-i-deploy` can answer in CI.

Two points trip up newcomers to Pact: contract testing does not replace functional tests (it does not validate business rules, only the shape of the conversation) and it does not test the real consumer against the real provider together. Each side tests against a controlled mock and the broker acts as a contract bridge. If you want to catch end-to-end integration bugs, keep a small smoke test above the contract testing.
