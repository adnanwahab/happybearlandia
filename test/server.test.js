import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('the production server serves the homepage and rejects an unknown route', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hbl-server-test-'));
  const server = Bun.spawn([process.execPath, '--no-env-file', 'run', 'server.js'], {
    env: {
      PATH: process.env.PATH,
      PORT: '0',
      HBL_WORLD_DB_PATH: ':memory:',
      DECISION_STORE_DIR: join(directory, 'decision'),
      HBL_JOURNAL_ROOT: join(directory, 'journals'),
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
    const home = await fetch(origin, { signal: AbortSignal.timeout(3000) });
    expect(home.status).toBe(200);
    expect(home.headers.get('content-type')).toContain('text/html');
    expect(await home.text()).toContain('Try Today’s Features');
    const missing = await fetch(origin + '/missing-release-test-page', { signal: AbortSignal.timeout(3000) });
    expect(missing.status).toBe(404);
  } finally {
    server.kill();
    await server.exited;
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
