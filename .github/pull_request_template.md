## Context

Describe the problem or motivation behind this change. Include links to issues, ADRs, or relevant discussions.

## Changes

List objectively what was changed. One item per change.

-
-
-

## How to test

Reproducible steps to validate locally.

```bash
make setup
make test
```

## Risks

Points of attention, fragile areas touched, possible regressions. If none, write "none identified".

## Checklist

- [ ] `npm run lint` with no warnings
- [ ] `npm run typecheck` with no errors
- [ ] `npm run test:functional` passing
- [ ] `npm run test:schema` passing
- [ ] `npm run test:security` passing
- [ ] `npm run test:pact:consumer` passing when the contract changes
- [ ] ADR added or updated if the change affects architecture
- [ ] CHANGELOG.md updated
- [ ] Documentation under `docs/` updated when applicable
