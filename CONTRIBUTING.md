# Contributing

Thanks for considering a contribution. This document describes the expected workflow for issues, PRs, and contract changes.

## Before you start

1. Make sure you have Node 20.18 (`.nvmrc` pins the version).
2. Install dependencies with `npm ci`.
3. Run `make setup` to generate Prisma, apply migrations, and seed data.
4. Run `make test` at least once to confirm the suite passes on your machine.

## Opening issues

Use the templates in `.github/ISSUE_TEMPLATE/`.

- `bug_report.md` for reproducible defects.
- `feature_request.md` for new capabilities or improvements.
- `contract_change.md` when the change involves a Pact contract (consumer or provider).

Always include: the exact command run, observed output, expected behavior, Node version, and base commit.

## Branches and commits

- Branch from `main`. Name in the format `type/short-description` (e.g., `feat/users-soft-delete`, `fix/rate-limit-headers`).
- Messages follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat:` new capability
  - `fix:` bug fix
  - `chore:` infra, deps
  - `docs:` documentation
  - `test:` test-only changes
  - `refactor:` no behavior change
  - `perf:` measurable performance improvement
- Small atomic commits are preferred over one giant commit.

## Commit hooks

The project uses Husky 9 to automate local checks. Hooks live in `.husky/` and are installed by the `prepare` script after `npm ci`.

- `pre-commit`: runs `lint-staged`, which applies ESLint with `--fix --max-warnings 0` on `.ts` and `.js` files and Prettier on supported files.
- `commit-msg`: runs `commitlint` with the `@commitlint/config-conventional` preset and the extra rules defined in `commitlint.config.cjs` (header up to 100 characters, subject in `sentence-case` or `lower-case`).
- `pre-push`: runs `npm run typecheck` and `npm run test:functional` before the push, making sure types check and the functional suite passes.

To write a commit guided by the conventional standard, use `npm run commit`, which opens the commitizen prompt.

## Releases

Releases are produced by `semantic-release` in the `release.yml` workflow, triggered on every push to `main`. The version is decided by the commits since the last tag, using the `conventionalcommits` preset:

- `fix:` produces a patch bump (e.g., 1.2.3 to 1.2.4).
- `feat:` produces a minor bump (e.g., 1.2.3 to 1.3.0).
- A `BREAKING CHANGE:` footer or `!` suffix on the type (`feat!:`) produces a major bump.
- `chore:`, `docs:`, `test:`, `refactor:`, `perf:`, `ci:`, `build:` do not produce a release on their own.

The workflow updates `CHANGELOG.md`, creates the `vX.Y.Z` tag, publishes the release on GitHub, and attaches the generated OpenAPI spec. To validate the outcome without publishing, run `npm run release:dry` locally.

## Before the PR

Run locally, in order:

```bash
npm run lint
npm run typecheck
npm run test:functional
npm run test:schema
npm run test:security
npm run test:pact:consumer
```

If you changed routes or schemas, regenerate the OpenAPI spec:

```bash
npm run openapi:export
```

Update `CHANGELOG.md` in the next version's section. Use direct, third-person language.

## Code style

- ESLint (`npm run lint`) with `--max-warnings 0`. Warnings are treated as errors.
- Prettier (`npm run format`) handles formatting.
- Strict TypeScript. No loose `any`; prefer `unknown` + narrow.
- Relative imports with the `.js` extension (native ESM). See examples in `src/api/app.ts`.
- Tests follow the AAA pattern (Arrange, Act, Assert) and use Test Data Builders instead of literals.

## Proposing an ADR

Changes that affect architecture, library choice, public contract, module boundaries, or testing strategy need an ADR.

1. Copy the template from the most recent ADR in `docs/adr/`.
2. Create `docs/adr/000N-short-title.md`. Number sequentially.
3. Use the simplified MADR format: Status, Context, Decision, Consequences, Alternatives.
4. Set the initial status to `Proposed`. After merge, update it to `Accepted` in the same PR.
5. Link the ADR in the PR's Context section.

## Pact contract change

Contracts are consumer-driven. Changes follow this flow:

1. Open an issue using the `contract_change.md` template, classifying the change as `Compatible` or `Breaking`.
2. On the consumer (`tests/contract/consumer/`):
   - Update the interaction (matchers, provider state, request, response).
   - Run `npm run test:pact:consumer`. Confirm the JSON in `pacts/` reflects the expected change.
3. Publish the branch:
   - Local: `npm run pact:publish` with `GIT_SHA`, `GIT_BRANCH`, `PACT_BROKER_URL`, and `PACT_BROKER_TOKEN` set.
   - CI: the `contract-publish.yml` workflow publishes automatically when the PR runs.
4. On the provider (`tests/contract/provider/`):
   - Make sure `stateHandlers` covers the new provider state.
   - Run `npm run test:pact:provider` pointing at the local API.
5. Before promoting to production, run `npm run pact:can-i-deploy`. If it returns `no`, fix consumer or provider before the merge.
6. Breaking changes require an ADR and an explicit migration plan in the PR.

## Review

Every PR needs at least one approval and a green pipeline. Reviewers check:

- Coverage of the change in existing or new tests.
- Coherence with current ADRs.
- Doc updates (`docs/`, `CHANGELOG.md`, README when applicable).
- No secrets in diff, fixtures, or logs.

## Code of conduct

Treat every interaction with respect. Focus on the code, not the person. Criticism should be technical, specific, and paired with a suggestion.
