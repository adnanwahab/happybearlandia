import { test, expect } from 'bun:test';
import { createSimulationAdmission, simulationAdmissionOptionsFromEnv } from '../ops/security/simulation-admission.js';
const request = (path = '/api/runs', method = 'POST', headers = {}) => new Request('http://localhost' + path, { method, headers });
test('isolated test server budgets require explicit test mode and preserve production defaults', () => {
  const limits = { HBL_TEST_SIMULATION_PER_CLIENT: '120', HBL_TEST_SIMULATION_TOTAL: '600' };
  for (const env of [{}, { ...limits }, { ...limits, NODE_ENV: 'production' }]) {
    const options = simulationAdmissionOptionsFromEnv(env);
    expect(options).toEqual({});
    const admit = createSimulationAdmission(options);
    for (let index = 0; index < 6; index++) expect(admit(request(), 'client')).toBeNull();
    expect(admit(request(), 'client').status).toBe(429);
  }
  expect(simulationAdmissionOptionsFromEnv({ NODE_ENV: 'test' })).toEqual({});
  const options = simulationAdmissionOptionsFromEnv({ ...limits, NODE_ENV: 'test' });
  expect(options).toEqual({ perClient: 120, total: 600 });
  const admit = createSimulationAdmission(options);
  for (let index = 0; index < 120; index++) expect(admit(request(), 'client')).toBeNull();
  expect(admit(request(), 'client').status).toBe(429);
});
test('malformed isolated test budgets fail closed before server startup', () => {
  for (const value of ['0', '-1', '1.5', 'Infinity', '1e3', '', '9007199254740992']) {
    for (const key of ['HBL_TEST_SIMULATION_PER_CLIENT', 'HBL_TEST_SIMULATION_TOTAL']) {
      expect(() => simulationAdmissionOptionsFromEnv({ NODE_ENV: 'test', [key]: value })).toThrow('Invalid test admission limit');
    }
  }
});
test('client budget spans APIs, cannot be bypassed by headers, and recovers exactly', async () => {
  let time = 0;
  const admit = createSimulationAdmission({ now: () => time, perClient: 2 });
  expect(admit(request(), 'client')).toBeNull();
  expect(admit(request('/api/decision-experiments/x/start'), 'client')).toBeNull();
  const denied = admit(request('/api/city-experiments', 'POST', { 'x-forwarded-for': 'other', authorization: 'Bearer secret' }), 'client');
  expect(denied.status).toBe(429);
  expect(denied.headers.get('retry-after')).toBe('60');
  expect(denied.headers.get('cache-control')).toBe('no-store');
  const body = await denied.text(); expect(body).not.toContain('secret'); expect(body).not.toContain('client');
  expect(admit(request(), 'other')).toBeNull();
  time = 59_001; expect(admit(request(), 'client').headers.get('retry-after')).toBe('1');
  time = 60_000; expect(admit(request(), 'client')).toBeNull();
});
test('global cap and bounded identity storage fail closed, then recover', () => {
  let time = 0;
  const admit = createSimulationAdmission({ now: () => time, total: 2, maxClients: 2 });
  expect(admit(request(), 'a')).toBeNull(); expect(admit(request(), 'b')).toBeNull();
  expect(admit(request(), 'c').status).toBe(429);
  time = 60_000; expect(admit(request(), 'c')).toBeNull();
  const bounded = createSimulationAdmission({ now: () => time, maxClients: 1 });
  expect(bounded(request(), 'a')).toBeNull(); expect(bounded(request(), 'b').status).toBe(429);
});
test('polling, cancellation, health and ordinary routes remain available under load', () => {
  const admit = createSimulationAdmission({ perClient: 1 });
  admit(request(), null); expect(admit(request(), null).status).toBe(429);
  for (const [path, method] of [['/api/runs/x', 'GET'], ['/api/runs/x/cancel', 'POST'], ['/api/decision-optimizations/x/cancel', 'POST'], ['/api/ready', 'GET'], ['/api/experiments', 'POST']]) {
    expect(admit(request(path, method), null)).toBeNull();
  }
});
test.skipIf(process.env.HBL_ADMISSION_HTTP !== '1')('HTTP burst returns predictable 429 and recovery without invoking expensive work', async () => {
  let time = 0, executed = 0;
  const admit = createSimulationAdmission({ now: () => time });
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(req, server) {
    return admit(req, server.requestIP(req)?.address) || Response.json({ accepted: ++executed }, { status: 202 });
  } });
  try {
    const responses = await Promise.all(Array.from({ length: 20 }, () => fetch(server.url + 'api/runs', { method: 'POST' })));
    expect(responses.filter(r => r.status === 202)).toHaveLength(6);
    expect(responses.filter(r => r.status === 429)).toHaveLength(14);
    expect(executed).toBe(6);
    for (const response of responses.filter(r => r.status === 429)) {
      expect(response.headers.get('retry-after')).toBe('60');
      expect((await response.json()).retryAfterSeconds).toBe(60);
    }
    time = 60_000;
    expect((await fetch(server.url + 'api/runs', { method: 'POST' })).status).toBe(202);
    expect(executed).toBe(7);
  } finally { await server.stop(true); }
});
