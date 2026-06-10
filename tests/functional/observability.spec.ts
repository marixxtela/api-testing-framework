import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { listenApp, type ListenedApp } from '../helpers/app-context.js';
import { resetDatabase, seedMinimal } from '../helpers/database.js';

describe('Observability and probes', () => {
  let app: ListenedApp;

  beforeAll(async () => {
    app = await listenApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedMinimal();
  });

  it('GET /health responds 200 with status, uptime, and version', async () => {
    const response = await fetch(`${app.url}/health`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { status: string; uptime: number; version: string };
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(typeof body.version).toBe('string');
  });

  it('GET /ready responds 200 when the database is reachable', async () => {
    const response = await fetch(`${app.url}/ready`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { status: string; checks: { database: string } };
    expect(body.status).toBe('ready');
    expect(body.checks.database).toBe('up');
  });

  it('every response includes the x-request-id header', async () => {
    const response = await fetch(`${app.url}/health`);
    const requestId = response.headers.get('x-request-id');
    expect(requestId).toBeTruthy();
    expect(requestId!.length).toBeGreaterThan(0);
  });

  it('honors x-request-id sent by the client', async () => {
    const incoming = 'req-customer-abc-123';
    const response = await fetch(`${app.url}/health`, {
      headers: { 'x-request-id': incoming },
    });
    expect(response.headers.get('x-request-id')).toBe(incoming);
  });

  it('GET /metrics exposes Prometheus metrics', async () => {
    await fetch(`${app.url}/health`);
    await fetch(`${app.url}/users`);

    const response = await fetch(`${app.url}/metrics`);
    expect(response.status).toBe(200);

    const text = await response.text();
    expect(text).toContain('http_requests_total');
    expect(text).toContain('http_request_duration_seconds');
    expect(text).toMatch(/process_cpu_seconds_total/);
  });

  it('content-type of /metrics is text/plain Prometheus', async () => {
    const response = await fetch(`${app.url}/metrics`);
    expect(response.headers.get('content-type')).toContain('text/plain');
  });
});
