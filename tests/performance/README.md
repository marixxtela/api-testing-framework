# Performance tests with k6

Four scenarios cover the situations that matter for a QA portfolio: smoke for sanity check, load to validate SLO, stress to find the breaking point, spike to verify recovery after a peak. The scripts are in plain JS (k6 does not run TS) and share helpers in `lib/helpers.js`.

## How to run

Prerequisite: the target API up with the seed applied (`npm run db:seed`). With k6 installed locally:

```bash
k6 run tests/performance/smoke.js
k6 run tests/performance/load.js
k6 run tests/performance/stress.js
k6 run tests/performance/spike.js
```

To point at another host just pass `BASE_URL`:

```bash
BASE_URL=https://staging.example.com k6 run tests/performance/smoke.js
```

The login credentials in `load.js` come from `ADMIN_EMAIL` and `ADMIN_PASSWORD` (default `admin@example.com` / `admin123`, same as the seed).

## Export results

To feed dashboards or attach to a PR:

```bash
k6 run --summary-export=results/load-summary.json tests/performance/load.js
k6 run --out json=results/load-raw.json tests/performance/load.js
```

The `--summary-export` flag produces an aggregated view (averages, percentiles, counters). The `--out json` flag produces the full stream of samples, useful for plotting in Grafana or in k6 Cloud itself (`--out cloud`).

## Run via Docker

Without k6 installed, use the official image. The container runs on the host network to reach the local API at `localhost:3000`:

```bash
docker run --rm -i --network host \
  -v "$PWD/tests/performance:/scripts" \
  grafana/k6:0.54.0 run /scripts/smoke.js
```

On macOS, where `--network host` does not work, use `host.docker.internal` in the `BASE_URL`:

```bash
docker run --rm -i \
  -e BASE_URL=http://host.docker.internal:3000 \
  -v "$PWD/tests/performance:/scripts" \
  grafana/k6:0.54.0 run /scripts/smoke.js
```

## Thresholds

Each script declares `thresholds` in `options`. When a threshold fails, k6 exits with a non-zero exit code, which makes CI block the merge. Current calibration:

- Smoke: `http_req_failed < 1%`, `p95 < 400ms`. Failing here means the environment is degraded before any load.
- Load: `http_req_failed < 2%`, `p95 < 800ms`, `p99 < 1500ms`. Per-endpoint thresholds via tags (`http_req_duration{endpoint:users_list}`) ensure a slow route is not masked by the average.
- Stress: thresholds deliberately loose (`p95 < 3s`, failures up to 20%). The signal here is not pass/fail, it is to see from which VU count the system starts struggling.
- Spike: tolerates up to 10% failures and p95 up to 2s. Status 429 counts as success because rate limit firing means the defense worked.

Tune the numbers to the target environment. In CI it is worth running only smoke on PR and load on a nightly job.
