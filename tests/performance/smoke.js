import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, SEEDED_USER_IDS, defaultHeaders, randomItem } from './lib/helpers.js';

// Smoke test: 1 VU for 30s. Goal: ensure the API responds in minimal
// conditions before raising real load. A failure here means the
// environment is broken, not a performance bottleneck.
export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<400'],
    checks: ['rate>0.99'],
  },
  tags: { scenario: 'smoke' },
};

export default function () {
  const health = http.get(`${BASE_URL}/health`, { tags: { endpoint: 'health' } });
  check(health, {
    'health status 200': (r) => r.status === 200,
    'health body not empty': (r) => r.body && r.body.length > 0,
  });

  const list = http.get(`${BASE_URL}/users?perPage=10`, {
    headers: defaultHeaders(),
    tags: { endpoint: 'users_list' },
  });
  check(list, {
    'users list status 200': (r) => r.status === 200,
    'users list brings data array': (r) => {
      try {
        const body = r.json();
        return Array.isArray(body.data);
      } catch (_e) {
        return false;
      }
    },
  });

  const id = randomItem(SEEDED_USER_IDS);
  const byId = http.get(`${BASE_URL}/users/${id}`, {
    headers: defaultHeaders(),
    tags: { endpoint: 'users_by_id' },
  });
  check(byId, {
    'users by id status 200': (r) => r.status === 200,
    'users by id returns the correct id': (r) => {
      try {
        return r.json('id') === id;
      } catch (_e) {
        return false;
      }
    },
  });

  sleep(1);
}
