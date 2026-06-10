// Helpers shared across the k6 scenarios. We keep everything in plain
// JS (no TS, no external deps) because k6 runs on its own goja runtime.

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const SEEDED_USER_IDS = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
];

export const SEEDED_ORDER_IDS = [
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
];

export function randomItem(array) {
  if (!array || array.length === 0) return undefined;
  const idx = Math.floor(Math.random() * array.length);
  return array[idx];
}

export function defaultHeaders(token) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export function loginPayload() {
  return JSON.stringify({
    email: __ENV.ADMIN_EMAIL || 'ricardo.menezes@acme.test',
    password: __ENV.ADMIN_PASSWORD || 'Adm.7421!checkout',
  });
}
