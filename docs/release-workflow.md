# Release workflow

Releases in this project are automated by `semantic-release`. The `release.yml` workflow triggers on every push to `main` and decides whether there is anything to publish by looking at commits since the last tag.

## Bump decision

The `@semantic-release/commit-analyzer` plugin uses the `conventionalcommits` preset to classify commits. The preset reads the type (`feat`, `fix`, etc.), the optional scope, and the footer. If no relevant commit exists since the last tag, the workflow ends without creating a release, without a tag, and without changing `CHANGELOG.md`.

## Conventional commits mapping

The current rule follows the preset's default:

- `fix:` produces a patch bump.
- `feat:` produces a minor bump.
- A commit with a `BREAKING CHANGE:` footer or a type ending in `!` (e.g., `refactor!:`) produces a major bump, even if the base type was patch.
- Auxiliary types (`chore`, `docs`, `test`, `refactor`, `perf`, `ci`, `build`, `style`) do not produce a release on their own. These commits still show up in the changelog when grouped with a release triggered by another commit.

## Skipping release

To force the workflow to ignore a push, include `[skip ci]` in the commit title. The release commit itself, made by `@semantic-release/git`, already uses that marker (`chore(release): X.Y.Z [skip ci]`), preventing an infinite loop.

## Attached assets

The release job runs `npm run openapi:export` before `semantic-release`. The `@semantic-release/github` plugin attaches `openapi/spec.yaml` to the published release with the `OpenAPI spec` label. If the file does not exist, the export step fails before the release, keeping state consistent.

## Local dry run

To inspect what `semantic-release` would do without publishing anything, run `npm run release:dry` at the project root. The command needs a valid Git repository with full history and uses the current branch. The output lists the next version number, the generated notes, and the files that would be updated.

## Pre-push

The `.husky/pre-push` hook runs `npm run typecheck` and `npm run test:functional` before any push. Both steps are fast (a few seconds for typecheck, a few minutes for the functional suite) and cover the most common error: code with invalid types or a functional regression heading to the remote. Heavier suites (contract, security, mutation, performance) continue to run only in CI, so they do not penalize the local development loop.
