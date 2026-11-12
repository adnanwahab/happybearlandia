import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('production server serves the patch ballot and records a vote with the signed cookie', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hbl-patch-server-'));
  const server = Bun.spawn([process.execPath, '--no-env-file', 'run', 'server.js'], {
    env: {
      PATH: process.env.PATH, PORT: '0', HBL_WORLD_DB_PATH: ':memory:',
      HBL_PATCH_VOTE_DB_PATH: join(directory, 'votes.sqlite'),
      HBL_PATCH_VOTE_SECRET: 'isolated-test-only-signing-key-with-32-characters',
      DECISION_STORE_DIR: join(directory, 'decision'),
      HBL_JOURNAL_ROOT: join(directory, 'journals')
    },
    stdout: 'pipe', stderr: 'pipe'
  });
  const startupTimer = setTimeout(() => server.kill(), 8000);
  try {
    const reader = server.stdout.getReader();
    const decoder = new TextDecoder();
    let startup = '', port;
    while (!port) {
      const { value, done } = await reader.read();
      if (done) throw new Error('server failed to start: ' + startup + await new Response(server.stderr).text());
      startup += decoder.decode(value, { stream: true });
      port = startup.match(/HappyBearLandia running at http:\/\/localhost:(\d+)\r?\n/)?.[1];
    }
    clearTimeout(startupTimer);
    reader.releaseLock();
    const origin = 'http://127.0.0.1:' + port;
    const page = await fetch(origin + '/vote-on-patch');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('Vote on the next patch');
    const script = await fetch(origin + '/world/patch-voting.js');
    expect(script.status).toBe(200);
    const list = await fetch(origin + '/api/patch-votes');
    expect(list.status).toBe(200);
    const initial = await list.json();
    expect(initial.patches.some(row => row.id === 'U06')).toBe(true);
    expect(list.headers.get('set-cookie')).toBeNull();
    const cookie = '';
    const cast = await fetch(origin + '/api/patch-votes/U06/vote', {
      method: 'POST',
      headers: { origin, cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ value: 1, consent: true })
    });
    expect(cast.status).toBe(200);
    expect((await cast.json()).patches.find(row => row.id === 'U06').score).toBe(1);
    const forbidden = await fetch(origin + '/api/patch-votes/U06/vote', {
      method: 'POST',
      headers: { origin: 'https://other.example', cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ value: 1, consent: true })
    });
    expect(forbidden.status).toBe(403);
  } finally {
    clearTimeout(startupTimer);
    server.kill();
    await server.exited;
    await rm(directory, { recursive: true, force: true });
  }
}, 20000);
