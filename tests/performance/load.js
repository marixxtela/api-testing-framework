import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  BASE_URL,
  SEEDED_USER_IDS,
  defaultHeaders,
  loginPayload,
  randomItem,
} from './lib/helpers.js';

// Load test: ramp up to 30 VUs, sustain 60s, ramp down. The traffic
// mix represents the expected production usage (read-dominated).
// Thresholds tuned to respond well with the lightly seeded database.
export const options = {
  stages: [
    { duration: '30s', target: 30 },
    { duration: '60s', target: 30 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    'http_req_duration{endpoint:users_list}': ['p(95)<600'],
    'http_req_duration{endpoint:users_by_id}': ['p(95)<400'],
    'http_req_duration{endpoint:auth_login}': ['p(95)<1200'],
    checks: ['rate>0.98'],
  },
};

export default function () {
  const roll = Math.random();

  if (roll < 0.7) {
    const res = http.get(`${BASE_URL}/users?perPage=20`, {
      headers: defaultHeaders(),
      tags: { endpoint: 'users_list' },
    });
    check(res, {
      'users list 200': (r) => r.status === 200,
      'users list valid payload': (r) => {
        try {
          return Array.isArray(r.json('data'));
        } catch (_e) {
          return false;
        }
      },
    });
  } else if (roll < 0.9) {
    const id = randomItem(SEEDED_USER_IDS);
    const res = http.get(`${BASE_URL}/users/${id}`, {
      headers: defaultHeaders(),
      tags: { endpoint: 'users_by_id' },
    });
    check(res, {
      'users by id 200': (r) => r.status === 200,
    });
  } else {
    const res = http.post(`${BASE_URL}/auth/login`, loginPayload(), {
      headers: defaultHeaders(),
      tags: { endpoint: 'auth_login' },
    });
    check(res, {
      'login 200': (r) => r.status === 200,
      'login returns token': (r) => {
        try {
          return typeof r.json('token') === 'string';
        } catch (_e) {
          return false;
        }
      },
    });
  }

  sleep(Math.random() * 1 + 0.5);
}
