import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, SEEDED_USER_IDS, defaultHeaders, randomItem } from './lib/helpers.js';

// Stress test: aggressive ramp up to 200 VUs in 2min, sustain 1min,
// ramp down. Thresholds intentionally loose: the goal here is to
// discover when the API breaks (errors, timeouts, p95 explodes),
// not to validate SLO.
export const options = {
  stages: [
    { duration: '2m', target: 200 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.20'],
    http_req_duration: ['p(95)<3000'],
  },
  tags: { scenario: 'stress' },
};

export default function () {
  const id = randomItem(SEEDED_USER_IDS);
  const choice = Math.random();
  const url = choice < 0.6 ? `${BASE_URL}/users?perPage=20` : `${BASE_URL}/users/${id}`;

  const res = http.get(url, {
    headers: defaultHeaders(),
    tags: { endpoint: choice < 0.6 ? 'users_list' : 'users_by_id' },
  });

  check(res, {
    'status not 5xx': (r) => r.status < 500,
  });
}
