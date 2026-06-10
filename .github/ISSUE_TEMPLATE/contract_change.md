---
name: Contract change (Pact)
about: Communicate a change in a consumer-driven contract
title: 'contract: '
labels: contract, pact
assignees: ''
---

## Affected consumer and provider

- Consumer:
- Provider:
- Affected pact (file under `pacts/`):

## Type of change

- [ ] Compatible (adds optional field, new endpoint, new scenario)
- [ ] Breaking (removes field, changes type, changes status code, renames route)

If breaking, justify the need and indicate the migration window.

## Change details

Summary diff of the contract (request, response, matchers, provider states).

```diff

```

## Expected impact

How the provider needs to respond. How other consumers are affected. State whether `can-i-deploy` should block.

## Migration plan

For breaking changes, describe:

1. Versioning (header, URL, new pacticipant)
2. Coexistence period for the two versions
3. Cut-off dates
4. Communication with consumer teams
5. Rollback

## Validation

- [ ] Consumer tests updated (`npm run test:pact:consumer`)
- [ ] Pact published on the feature branch
- [ ] Provider verification running on the new pact
- [ ] `can-i-deploy` executed and reviewed
- [ ] ADR created if the change is structural
