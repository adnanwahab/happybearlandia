import { test, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, unlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildEmergencyComparison, createEmergencyMode } from '../ops/security/emergency-mode.js';
const req = (path, method = 'POST') => new Request('http://localhost' + path, { method });

test('operator file activates and deactivates without an HTTP control or body parsing', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hbl-emergency-')), file = join(directory, 'flag');
  const comparison = await buildEmergencyComparison();
  const gate = createEmergencyMode({ file, comparison });
  try {
    expect(gate(req('/api/city-experiments'))).toBeNull();
    writeFileSync(file, '');
    expect((await gate(req('/api/emergency-mode', 'GET')).json()).active).toBe(true);
    for (const path of ['/api/runs', '/api/city-experiments', '/api/experiments', '/api/world/experiments', '/api/decision-experiments/x/start', '/api/decision-optimizations', '/api/law-behavior', '/api/world-experiments', '/api/world-homes', '/api/world-edits', '/api/city-experiments/city_x/replay', '/api/github/pulls/123/previews', '/api/github/previews/' + 'a'.repeat(32) + '/retry']) {
      const request = req(path), response = gate(request);
      expect(response.status).toBe(503);
      expect(request.bodyUsed).toBe(false);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect((await response.json()).code).toBe('emergency_read_only');
    }
    for (const [path, method] of [['/api/runs/x/cancel','POST'], ['/api/runs/x/pause','POST'], ['/api/runs/x','GET'], ['/api/city-experiments/city_x','GET'], ['/api/ready','GET'], ['/api/github/previews/' + 'a'.repeat(32) + '/stop','POST'], ['/api/patch-votes','POST']]) expect(gate(req(path, method))).toBeNull();
    for (const path of ['/', '/world/future-machine.html', '/world/future-machine.html?experiment=other']) {
      const response = gate(req(path, 'GET'));
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Seed 42');
      expect(html).toContain('city-systems.1.1.0');
      expect(html).toContain('not a reopened shared scenario');
      expect(html).toContain('<th>120</th><td>36</td><td>60</td><td>1000000</td>');
      expect(html).not.toContain('<script');
      expect(html.match(/<tr>/g)).toHaveLength(122);
    }
    expect(await gate(req('/', 'HEAD')).text()).toBe('');
    unlinkSync(file);
    expect(gate(req('/api/city-experiments'))).toBeNull();
    expect(gate(req('/', 'GET'))).toBeNull();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('activation drains accepted work, rejects new dispatch, then admits after rollback', async () => {
  let enabled = false, release, writes = 0;
  const gate = createEmergencyMode({ file: '/operator/flag', comparison: 'verified', stat() { if (!enabled) throw Object.assign(new Error(), { code: 'ENOENT' }); } });
  const dispatch = async () => {
    const rejection = gate(req('/api/runs'));
    if (rejection) return rejection;
    await new Promise(resolve => { release = resolve; });
    writes++; return new Response('committed');
  };
  const accepted = dispatch();
  enabled = true;
  expect((await dispatch()).status).toBe(503);
  expect(writes).toBe(0);
  release(); expect(await (await accepted).text()).toBe('committed');
  expect(writes).toBe(1);
  enabled = false;
  const resumed = dispatch(); release(); await resumed;
  expect(writes).toBe(2);
});

test('flag errors fail closed, absent configuration stays off, and remote callers cannot toggle', async () => {
  expect(() => createEmergencyMode({ file: 'relative' })).toThrow('absolute');
  expect(createEmergencyMode()(req('/api/runs'))).toBeNull();
  const gate = createEmergencyMode({ file: '/operator/flag', stat() { throw Object.assign(new Error('private path'), { code: 'EACCES' }); } });
  expect(gate(req('/api/runs')).status).toBe(503);
  expect(gate(req('/api/emergency-mode'))).toBeNull();
  expect(await gate(req('/api/emergency-mode', 'GET')).text()).not.toContain('private');
});

test('server entry dispatches the gate before other request handlers', async () => {
  const source = await Bun.file(new URL('../server.js', import.meta.url)).text();
  expect(source.indexOf('const emergencyResponse=handleEmergencyMode(request)')).toBeLessThan(source.indexOf('const releaseResponse=handleReleaseExperiment(request)'));
});

test.skipIf(process.env.HBL_EMERGENCY_HTTP !== '1')('HTTP drill rejects work before dispatch and preserves fallback through activation/rollback', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hbl-emergency-http-')), file = join(directory, 'flag');
  let writes = 0;
  const gate = createEmergencyMode({ file, comparison: await buildEmergencyComparison() });
  let server;
  try {
    server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(request) { return gate(request) || Response.json({ writes: request.method === 'POST' ? ++writes : writes }); } });
    expect((await fetch(new URL('/api/runs', server.url), { method: 'POST' })).status).toBe(200);
    writeFileSync(file, '');
    expect((await fetch(new URL('/api/runs', server.url), { method: 'POST' })).status).toBe(503);
    expect(writes).toBe(1);
    const viewer = await fetch(server.url);
    expect(viewer.status).toBe(200); expect(await viewer.text()).toContain('Read-only play is available');
    unlinkSync(file);
    expect((await fetch(new URL('/api/runs', server.url), { method: 'POST' })).status).toBe(200);
    expect(writes).toBe(2);
  } finally { await server?.stop(true); rmSync(directory, { recursive: true, force: true }); }
});
