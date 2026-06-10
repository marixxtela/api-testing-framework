import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, defaultHeaders } from './lib/helpers.js';

// Spike test: 5 VUs, abrupt jump to 100, back to 5. Simulates a sudden
// peak (campaign, viral, retry storm). Focus: verify the API recovers
// after the peak without staying degraded.
export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '10s', target: 100 },
    { duration: '30s', target: 100 },
    { duration: '10s', target: 5 },
    { duration: '30s', target: 5 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<2000'],
  },
  tags: { scenario: 'spike' },
};

export default function () {
  const res = http.get(`${BASE_URL}/users?perPage=10`, {
    headers: defaultHeaders(),
    tags: { endpoint: 'users_list' },
  });
  check(res, {
    'status 200 or 429': (r) => r.status === 200 || r.status === 429,
  });
}
