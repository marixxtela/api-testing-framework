# Security policy

## Supported versions

| Version        | Security support |
| -------------- | ---------------- |
| 0.1.x          | Yes              |
| Older than 0.1 | No               |

Security patches are published only against the latest version line. Keeping the project up to date is recommended.

## How to report a vulnerability

Do not open a public issue. Report privately through one of these channels:

- Email: `security@example.com` (replace with the real email when publishing the repo).
- GitHub Security Advisory: `Security` tab > `Report a vulnerability`.

Include in the report:

- Technical description of the problem.
- Reproducible steps (preferably with curl or a script).
- Affected version and commit.
- Observed impact (leak, privilege escalation, DoS, etc.).
- Suggested fix, if any.

## Response SLA

- Acknowledgement of receipt: 2 business days.
- Initial triage and severity classification: 5 business days.
- Mitigation plan communicated: 10 business days.
- Fix published for critical vulnerabilities: 30 days.

Severity follows CVSS 3.1. Vulnerabilities classified as `Critical` or `High` are prioritized over the regular roadmap.

## Scope

In scope:

- Target Fastify API in `src/api/`.
- Direct dependencies listed in `package.json`.
- Auth, rate limit, helmet, and CORS configuration.
- GitHub Actions workflows in `.github/workflows/`.
- Dockerfiles and docker-compose in `docker/`.

## Out of scope

- Vulnerabilities in demo environments or seed data.
- Attacks that depend on prior theft of developer credentials.
- Vulnerabilities in transitive dependencies already fixed upstream and awaiting a Dependabot bump.
- Social engineering against maintainers.
- Reports without a reproducible proof of concept.

## Disclosure

After the fix is published, the reporter is credited in CHANGELOG.md and in the GitHub advisory, unless they request otherwise.

## Hall of fame

Researchers who reported valid vulnerabilities:

- `(empty until the first report)`

## Security automation

The `.github/workflows/security.yml` pipeline consolidates several complementary scans. CodeQL and Semgrep cover static analysis (SAST) of the TypeScript code with OWASP Top Ten and security-audit rules, npm audit and dependency-review handle Software Composition Analysis (direct and transitive deps, including license checks), Trivy scans the filesystem and the alpine image built by `docker/Dockerfile`, gitleaks performs secret scanning across the full history, and the SBOM job produces an SPDX JSON via Anchore that also feeds a Grype scan. SARIF results show up under the `Security > Code scanning` tab on GitHub, the SBOM is published as an artifact on every run and also attached to the release by `release.yml`.

Cadence combines event and time triggers: every pull request against `main` runs dependency-review and the code scans, every push to `main` revalidates the baseline, and a weekly schedule on Mondays at 04:00 UTC reruns every job to catch CVEs published after the last change. `HIGH` and `CRITICAL` severity in dependency-review blocks the merge, while npm audit, Trivy, and Grype run in informational mode (warning) to avoid blocking on false positives, leaving the triage explicit in the job summary. Operational details in [`docs/security-automation.md`](./docs/security-automation.md).
