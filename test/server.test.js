import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('the production server keeps merged feature routes and simulation admission reachable', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hbl-server-test-'));
  const server = Bun.spawn([process.execPath, '--no-env-file', 'run', 'server.js'], {
    env: {
      PATH: process.env.PATH,
      PORT: '0',
      HBL_WORLD_DB_PATH: ':memory:',
      DECISION_STORE_DIR: join(directory, 'decision'),
      HBL_JOURNAL_ROOT: join(directory, 'journals'),
      HBL_DETECTIVE_ROOT: join(directory, 'detective'),
      NODE_ENV: 'test',
      HBL_TEST_SIMULATION_PER_CLIENT: '2',
      HBL_TEST_SIMULATION_TOTAL: '2',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const startupTimer = setTimeout(() => server.kill(), 5000);
  try {
    const reader = server.stdout.getReader();
    const decoder = new TextDecoder();
    let startup = '';
    let port;
    try {
      while (!port) {
        const { value, done } = await reader.read();
        if (done) throw new Error('HappyBearLandia did not start');
        startup += decoder.decode(value, { stream: true });
        port = startup.match(/HappyBearLandia running at http:\/\/localhost:(\d+)\r?\n/)?.[1];
      }
    } finally {
      clearTimeout(startupTimer);
      reader.releaseLock();
    }
    const origin = 'http://127.0.0.1:' + port;
    const demoReady = await fetch(origin + '/api/demo/ready', { signal: AbortSignal.timeout(3000) });
    expect(demoReady.status).toBe(200);
    expect((await demoReady.json()).checks.demoAssets).toBe('ok');
    const home = await fetch(origin, { signal: AbortSignal.timeout(3000) });
    expect(home.status).toBe(200);
    expect(home.headers.get('content-type')).toContain('text/html');
    expect(await home.text()).toContain('Try Today’s Features');

    // Exercise the real dispatcher: handler-unit tests cannot detect lost wiring.
    for (const path of ['/api/session-survey', '/api/player-feedback']) {
      const response = await fetch(origin + path);
      expect(response.status).toBe(405);
      expect(response.headers.get('content-type')).toContain('application/json');
      const unconsented = await fetch(origin + path, { method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({ version: 1, consent: false }),
      });
      expect(unconsented.status).toBe(400);
    }
    const detective = await fetch(origin + '/api/detective');
    expect(detective.status).toBe(200);
    expect(await detective.json()).toMatchObject({ started: 0, submitted: 0, unit: 'saved attempts, not unique players' });
    const operations = await fetch(origin + '/api/operations-observatory');
    expect(operations.status).toBe(200);
    expect(await operations.json()).toMatchObject({ version: 1, queue: { available: false }, release: { available: false } });
    const operationsRedirect = await fetch(origin + '/tools/operations-observatory', { redirect: 'manual' });
    expect(operationsRedirect.status).toBe(302);
    expect(operationsRedirect.headers.get('location')).toBe(origin + '/tools/operations-observatory/');

    // No GitHub metadata fetch or preview provisioning is needed for route coverage.
    const githubMissing = await fetch(origin + '/api/github/not-a-route');
    expect(githubMissing.status).toBe(404);
    expect(await githubMissing.json()).toEqual({ error: 'GitHub route or method not found' });
    const preview = await fetch(origin + '/api/github/pulls/1/previews', { method: 'POST' });
    expect(preview.status).toBe(503);
    expect((await preview.json()).error).toContain('Preview creation is disabled');
    for (const path of ['/github', '/github/pulls/1', '/github/previews/' + 'a'.repeat(32), '/tools/operations-observatory/', '/world/bar', '/world/bars']) {
      const response = await fetch(origin + path);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    }
    for (const path of ['/github-client.js', '/shared/media/pipeline.js', '/shared/media/preferences.js']) {
      const response = await fetch(origin + path);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('javascript');
    }
    expect((await fetch(origin + '/shared/media/private.js')).status).toBe(404);

    // Invalid bodies consume admission but never start a simulation or write a run.
    const submit = () => fetch(origin + '/api/runs', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
    });
    expect((await submit()).status).toBe(400);
    expect((await submit()).status).toBe(400);
    const limited = await submit();
    expect(limited.status).toBe(429);
    expect((await limited.json()).code).toBe('simulation_rate_limited');
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);

    const missing = await fetch(origin + '/missing-release-test-page', { signal: AbortSignal.timeout(3000) });
    expect(missing.status).toBe(404);
  } finally {
    server.kill();
    await server.exited;
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
