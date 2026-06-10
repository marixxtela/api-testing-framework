# Security automation

This document describes the security scans running in CI, their cadence, where to consult results, and how to prioritize findings. The goal is to cover the main fronts expected in a mature pipeline: SAST, SCA, container scanning, secret scanning, license compliance, and SBOM.

## Overview

The whole pipeline lives in `.github/workflows/security.yml`. The workflow is triggered in four situations:

- Pull request against `main`: runs CodeQL, Semgrep, Trivy (fs and image), npm audit, gitleaks, SBOM, and dependency-review.
- Push to `main`: runs the same jobs without dependency-review (which only makes sense on PRs).
- Weekly schedule `0 4 * * 1` (Mondays, 04:00 UTC): reruns everything to catch new CVEs against the current code.
- `workflow_dispatch`: enables on-demand triage after publishing a security fix or a dependency bump.

The jobs are independent of each other and run in parallel, with no cyclic dependency. Each job that uploads SARIF explicitly declares `permissions: security-events: write`.

## Scan matrix

| Scan                | Tool                                                                            | Goal                                                                      | Where to view the result                                              | Blocks?                                             |
| ------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
| TypeScript SAST     | CodeQL (`security-extended`, `security-and-quality`)                            | Detect code vulnerabilities (injection, taint, prototype pollution, etc.) | Security > Code scanning, `javascript-typescript` category            | Yes on PR if it introduces an `error` alert         |
| Curated SAST rules  | Semgrep (`p/javascript`, `p/typescript`, `p/owasp-top-ten`, `p/security-audit`) | Extra coverage with OWASP rules and common insecure patterns              | Security > Code scanning, `semgrep` category                          | Warning (job does not fail)                         |
| Dependency SCA      | npm audit + audit signatures                                                    | Vulnerabilities in dependencies and npm supply chain integrity            | `npm-audit` job summary, `npm-audit.json` artifact                    | Warning for `--audit-level=high`; signatures blocks |
| SCA + license       | actions/dependency-review-action                                                | PR dependency diff, severity gate, and license                            | PR comment and job summary                                            | Yes for HIGH severity and GPL/AGPL/SSPL licenses    |
| Container scanning  | Trivy (image scan-type) over `docker/Dockerfile` target `runtime`               | CVEs in the base image and installed layers                               | Security > Code scanning, `trivy-image` category                      | Warning (`exit-code: 0`)                            |
| Filesystem scanning | Trivy (fs scan-type)                                                            | CVEs in manifests and repo files (lockfiles, dockerfiles, IaC)            | Security > Code scanning, `trivy-fs` category                         | Warning (`exit-code: 0`)                            |
| Secret scanning     | gitleaks-action over the full history                                           | Detect committed secrets (tokens, keys, real JWTs)                        | gitleaks job summary and PR comments                                  | Warning, config in `.gitleaks.toml`                 |
| SBOM                | anchore/sbom-action (SPDX JSON)                                                 | Component inventory for audit and compliance                              | `sbom-spdx` artifact, attached to the GitHub Release by `release.yml` | Does not block                                      |
| SBOM vuln scan      | anchore/scan-action (Grype)                                                     | Cross-references SBOM with the vulnerability database                     | Job summary                                                           | Warning (`fail-build: false`)                       |

## Triage by severity

The general severity rule follows CVSS 3.1, aligned with `SECURITY.md`.

- `CRITICAL` and `HIGH`: dependency-review blocks the PR. CodeQL marks as `error` and also blocks. Other scans produce warnings but should be addressed before release. Open an issue with the `security` label and high priority.
- `MEDIUM`: warning across all scans. Evaluate context (exploited path, production exposure). Typically goes into the tech backlog with a deadline.
- `LOW` and `INFO`: record only. Can be addressed in maintenance chores.

Severity is not the only criterion. Manual triage considers: attack vector, authentication required, whether the dependency is used at runtime or only in dev, and whether the vulnerable path is reachable from user input.

## Where to view results

- SARIF alerts (CodeQL, Semgrep, Trivy): `Security > Code scanning alerts` tab, filter by category (`trivy-fs`, `trivy-image`, `semgrep`, `/language:javascript-typescript`).
- Dependency audit: `Security > Dependabot alerts` for continuous alerts, plus the `npm-audit.json` artifact per run.
- Secret scanning: `Security > Secret scanning` tab (native GitHub alerts) and the `gitleaks` job output for custom history sweeps.
- SBOM: `sbom-spdx` artifact on every `security.yml` run, and the `sbom.spdx.json` file attached to the GitHub Release (generated by `release.yml`).
- Executive summary: each job writes to `$GITHUB_STEP_SUMMARY`, useful for reviewers who do not want to open every SARIF.

## Operation and exceptions

Common false positives in Trivy image scans (a base image with a CVE without an upstream fix) are mitigated with `ignore-unfixed: true`. When a real finding needs a temporary exception, record it in `.trivyignore` with a link to a tracking issue and a review date. For gitleaks, the allowlist for synthetic secrets and fixtures lives in `.gitleaks.toml`, keeping the test `JWT_SECRET` and example tokens out of the noise.

CodeQL is configured in `.github/codeql-config.yml` with the `security-extended` and `security-and-quality` query suites, and ignores `node_modules`, `dist`, `coverage`, `pacts`, `reports`, `mocks`, `postman`, `openapi`, all generated or data folders.

## Maintenance

- Pin actions to fixed tags (`@v3`, `@v4`, `@0.24.0`). Update via Dependabot or a dedicated bump PR.
- Review the Semgrep rule set and CodeQL queries monthly to add new categories.
- On each release, verify the SBOM was attached and that the Grype scan ran against the final version.
- When a vulnerability is triaged as accepted, document the decision in the PR that adds the exception, not in an isolated commit.
