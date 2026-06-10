# Mutation testing with Stryker

Mutation testing applies small automatic changes to the production code (mutants) and runs the test suite against each variant. If no test fails after the mutation, the mutant "survives" and indicates an assertion gap: the code covered by the line exists, but the real behavior is not being verified. This complements the line coverage reported by Vitest, which measures execution, not assertion. High coverage with many surviving mutants is a classic sign of weak tests.

## How to run locally

```bash
npm run test:mutation
```

The run takes a few minutes. Stryker compiles the project, generates the mutants, runs the Vitest suite against each mutant using the official `@stryker-mutator/vitest-runner` runner, and produces a report. Concurrency is capped at 2 workers in `stryker.config.json` to avoid saturating CPU on modest machines and CI runners. For faster iteration during diagnosis, temporarily narrow the `mutate` array to a single file.

## How to read the report

After the run, the HTML is in `reports/mutation/index.html`. Open it in the browser. The per-file view shows each mutant with status: killed (a test failed, behavior locked in), survived (the mutation slipped through, assertions are missing), no coverage (the line was not even exercised), timeout (the mutant caused a loop or hang), and runtime error (the mutant broke the code structurally). The JSON in `reports/mutation/mutation.json` feeds dashboards and can be compared between branches.

## Chosen target

The configuration focuses mutation on code where tests add real value: `src/api/services/**`, `src/builders/**`, and `src/utils/retry.ts`. Services concentrate business rules (pagination, uniqueness validation, hashing, status transitions). Builders are test collaborators with defaults that need to stay stable. `retry` has backoff branches and stop logic that deserves behavioral coverage. Files like `src/api/server.ts`, `src/api/app.ts`, and `src/api/config.ts` stay out: they are bootstrap and declarative Zod validation, where mutants produce noise without value. Zod schemas also stay out for the same reason, they are declarations, not logic.

## Thresholds

`stryker.config.json` sets `high: 85`, `low: 70`, and `break: 60`. Above 85% the report marks the project as healthy. Below 60% the process returns a non-zero exit code, failing the local run. In the scheduled workflow the job has `continue-on-error: true` deliberately to avoid blocking releases while the baseline stabilizes, but the report is attached as an artifact and the summary shows up in the GitHub Step Summary.

## Known limitations

The execution is slow by nature: each mutant demands a full suite run. The Vitest runner has a known case of instability with tests that lean heavily on global mocks or side effects between files. The current suite uses `pool: 'forks'` with `singleFork: true` in `vitest.config.ts`, which makes the Stryker run more predictable but also reduces natural parallelism. If many timeouts show up, adjust `timeoutMS` in `stryker.config.json` before diving into fine-grained diagnosis. Results should be treated as a directional signal: the goal is not to hit 100%, it is to understand why mutants survive and harden assertions where it makes sense.
