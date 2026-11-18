import { expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizePath, redactText } from '../ops/server-logs/redact.js';
import { createServerLogStore, resolveLogDir } from '../ops/server-logs/store.js';
import { captureConsole, classifyRequest, createServerLogRecorder, instrumentFetch } from '../ops/server-logs/capture.js';
import { createServerLogs, createServerLogsHandler } from '../ops/server-logs/api.js';

const T0 = Date.parse('2026-11-17T12:00:00Z');
function setup(storeOptions = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'hbl-server-logs-'));
  let time = T0;
  const now = () => time;
  const store = createServerLogStore({ dir, now, ...storeOptions });
  return { dir, store, now, advance: ms => { time += ms; }, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
const request = (path, init = {}) => new Request('https://hbl.test' + path, init);

test('redaction strips personal data and secrets from free text', () => {
  const text = redactText('user jane.doe@example.com from 203.0.113.9 and 2001:db8::1 at 29.7286,-95.4746 lat=29.7 '
    + 'sent token=abc123SECRET with Bearer eyJhbGciOi.JIUzI1 to https://api.example.com/v1/x?key=supersecret#frag '
    + 'id 0b9c3f1e-2a4d-4e6f-8a1b-1c2d3e4f5a6b hex deadbeefdeadbeefdeadbeef code Ab3dEf9hIjKlMn0pQrStUv phone 5551234567');
  for (const secret of ['jane.doe', '203.0.113.9', 'db8', '29.7286', '29.7', 'abc123SECRET', 'eyJhbGciOi', 'supersecret',
    '0b9c3f1e', 'deadbeef', 'Ab3dEf9h', '5551234567']) expect(text).not.toContain(secret);
  for (const marker of ['[email]', '[ip]', '[coordinates]', 'lat=[coordinate]', 'token=[redacted]', 'Bearer [redacted]',
    'https://api.example.com/v1/x?[redacted]', '[id]', '[token]', '[number]']) expect(text).toContain(marker);
});

test('redaction keeps ordinary diagnostics readable and bounded', () => {
  const line = 'Game bundle failed at 12:30:45 after 1500 ms in world/api.js:123:45 (city-systems.1.0.0)';
  expect(redactText(line)).toBe(line);
  expect(redactText('x'.repeat(900))).toHaveLength(500);
  expect(redactText('a\u0000b')).toBe('a b');
});

test('paths keep their route shape but lose queries, IDs, share codes and names', () => {
  const cases = {
    '/world?lat=29.7&lng=-95.4': '/world',
    '/r/AbCdEfGh': '/r/:id',
    '/api/reality-shares/abcdefgh12': '/api/reality-shares/:id',
    '/api/world-experiments/abcdefgh/house-session/Jane%20Doe': '/api/world-experiments/:id/house-session/:id',
    '/api/world-homes/home_0123456789abcdef0123/restore': '/api/world-homes/:id/restore',
    '/api/act-normal/rooms/AB12CD': '/api/act-normal/rooms/:id',
    '/world/date/jane.doe': '/world/date/:id',
    '/world/house/house.js': '/world/house/house.js',
    ['/github/previews/' + 'a'.repeat(32)]: '/github/previews/:id',
    '/api/runs/0b9c3f1e-2a4d-4e6f-8a1b-1c2d3e4f5a6b/cancel': '/api/runs/:id/cancel',
    '/notes/someone@example.com': '/notes/:id',
    ['/x/' + 'a1'.repeat(10)]: '/x/:id',
    '/x/123456': '/x/:id',
    '/game/1': '/game/1',
    '/world/storm/response.html': '/world/storm/response.html',
    '/vendor/three/three.webgpu.js': '/vendor/three/three.webgpu.js',
    '/api/patch-votes/U06/vote': '/api/patch-votes/U06/vote',
    '/.env': '/.env',
  };
  for (const [input, expected] of Object.entries(cases)) expect(normalizePath(input)).toBe(expected);
  expect(normalizePath('/a' + '/b'.repeat(40))).toEndWith('/…');
});

test('logs can never be written inside a public static directory', () => {
  for (const dir of ['data/server-logs', 'world', 'tools/logs', 'blog/dist/logs']) {
    expect(() => resolveLogDir(dir)).toThrow('outside public static directories');
  }
  expect(resolveLogDir('.hbl-private/server-logs')).toEndWith(join('.hbl-private', 'server-logs'));
});

test('the store appends daily JSON lines, reads newest first and prunes expired days', () => {
  const s = setup({ retentionDays: 2 });
  try {
    expect(s.store.record({ level: 'info', type: 'lifecycle', message: 'first' })).toBe(true);
    s.advance(1000);
    s.store.record({ level: 'warn', type: 'console', message: 'second' });
    expect(s.store.read({ since: T0 - 1000 }).entries.map(entry => entry.message)).toEqual(['second', 'first']);
    expect(s.store.read({ since: T0 + 500 }).entries.map(entry => entry.message)).toEqual(['second']);
    writeFileSync(join(s.dir, 'server-2026-11-10.jsonl'), JSON.stringify({ t: '2026-11-10T00:00:00.000Z', level: 'info', type: 'notice', message: 'old' }) + '\n');
    s.advance(86400000);
    s.store.record({ level: 'info', type: 'notice', message: 'next day' });
    expect(readdirSync(s.dir).sort()).toEqual(['server-2026-11-17.jsonl', 'server-2026-11-18.jsonl']);
    expect(s.store.read({ since: T0 - 1000 }).entries.map(entry => entry.message)).toEqual(['next day', 'second', 'first']);
  } finally {
    s.cleanup();
  }
});

test('a full day stops writing and leaves exactly one notice', () => {
  const s = setup({ maxBytesPerDay: 1024 });
  try {
    let written = 0;
    for (let i = 0; i < 50; i++) {
      if (s.store.record({ level: 'info', type: 'request', kind: 'api', method: 'GET', path: '/api/area', status: 200, ms: 5 })) written++;
    }
    const { entries } = s.store.read({ since: T0 - 1 });
    expect(written).toBeGreaterThan(0);
    expect(written).toBeLessThan(50);
    expect(entries.filter(entry => entry.type === 'notice')).toHaveLength(1);
    expect(s.store.stats().dropped).toBe(50 - written);
  } finally {
    s.cleanup();
  }
});

test('request logging keeps pages, APIs and failures and skips routine noise', () => {
  const s = setup();
  try {
    const recorder = createServerLogRecorder(s.store, { appRoot: '/app' });
    const page = request('/world/future-machine.html', { headers: { 'sec-fetch-dest': 'document' } });
    expect(classifyRequest(page, '/world/future-machine.html')).toBe('page');
    expect(classifyRequest(request('/world'), '/world')).toBe('asset');
    expect(classifyRequest(request('/world', { headers: { accept: 'text/html,*/*' } }), '/world')).toBe('page');
    expect(classifyRequest(request('/ws', { headers: { upgrade: 'websocket' } }), '/ws')).toBe('websocket');
    expect(recorder.request(page, '/world/future-machine.html', 200, 40)).toBe(true);
    expect(recorder.request(request('/world/app.js'), '/world/app.js', 200, 3)).toBe(false);
    expect(recorder.request(request('/world/missing.js'), '/world/missing.js', 404, 2)).toBe(true);
    expect(recorder.request(request('/world/huge.glb'), '/world/huge.glb', 200, 2400)).toBe(true);
    expect(recorder.request(request('/api/ready'), '/api/ready', 200, 1)).toBe(false);
    expect(recorder.request(request('/api/ready'), '/api/ready', 503, 1)).toBe(true);
    expect(recorder.request(request('/api/server-logs/'), '/api/server-logs/', 200, 1)).toBe(false);
    expect(recorder.request(request('/api/area?lat=29.7286&lng=-95.4746'), '/api/area', 200, 12)).toBe(true);
    const { entries } = s.store.read({ since: T0 - 1 });
    expect(entries.map(entry => [entry.path, entry.status, entry.level])).toEqual([
      ['/api/area', 200, 'info'],
      ['/api/ready', 503, 'error'],
      ['/world/huge.glb', 200, 'warn'],
      ['/world/missing.js', 404, 'warn'],
      ['/world/future-machine.html', 200, 'info'],
    ]);
    expect(entries.find(entry => entry.path === '/world/huge.glb').slow).toBe(true);
    expect(JSON.stringify(entries)).not.toContain('29.7');
  } finally {
    s.cleanup();
  }
});

test('instrumented fetch records outcomes without changing responses or thrown errors', async () => {
  const s = setup();
  try {
    const recorder = createServerLogRecorder(s.store, { appRoot: process.cwd() });
    let tick = 0;
    const fetchHandler = instrumentFetch(async incoming => {
      const { pathname } = new URL(incoming.url);
      if (pathname === '/boom') throw new Error('failed for jane@example.com');
      if (pathname === '/ws') return undefined;
      return new Response('ok', { status: pathname === '/api/missing' ? 404 : 200 });
    }, recorder, () => (tick += 5));
    expect(await (await fetchHandler(request('/api/ok'))).text()).toBe('ok');
    expect((await fetchHandler(request('/api/missing'))).status).toBe(404);
    expect(await fetchHandler(request('/ws', { headers: { upgrade: 'websocket' } }))).toBeUndefined();
    await expect(fetchHandler(request('/boom'))).rejects.toThrow('failed for jane@example.com');
    const { entries } = s.store.read({ since: T0 - 1 });
    const exception = entries.find(entry => entry.type === 'exception');
    expect(exception).toMatchObject({ level: 'error', method: 'GET', path: '/boom', name: 'Error', message: 'failed for [email]' });
    expect(exception.stack.length).toBeGreaterThan(0);
    expect(exception.stack.join('\n')).not.toContain(process.cwd());
    expect(entries.find(entry => entry.type === 'request' && entry.path === '/boom').status).toBe(500);
    expect(entries.find(entry => entry.kind === 'websocket').status).toBe(101);
    expect(entries.find(entry => entry.path === '/api/missing')).toMatchObject({ status: 404, ms: 5 });
  } finally {
    s.cleanup();
  }
});

test('console errors and warnings are mirrored once, redacted, and still printed', () => {
  const s = setup();
  try {
    const printed = [];
    const target = { error: (...args) => printed.push(['error', ...args]), warn: (...args) => printed.push(['warn', ...args]) };
    const recorder = createServerLogRecorder(s.store);
    const restore = captureConsole(recorder, target);
    captureConsole(recorder, target);
    target.error('[world] lookup failed for', 'jane@example.com', new TypeError('bad 29.7286,-95.4746'));
    target.warn('Received invalid JSON');
    expect(printed).toHaveLength(2);
    expect(s.store.read({ since: T0 - 1 }).entries.map(entry => [entry.level, entry.message])).toEqual([
      ['warn', 'Received invalid JSON'],
      ['error', '[world] lookup failed for [email] TypeError: bad [coordinates]'],
    ]);
    restore();
    expect(target.error.serverLogsCapture).toBeUndefined();

    // A recorder that itself writes to the console cannot loop.
    const looping = { console: () => target.error('inner') };
    captureConsole(looping, target);
    target.error('outer');
    expect(printed.slice(-2).map(entry => entry[1])).toEqual(['outer', 'inner']);
  } finally {
    s.cleanup();
  }
});

test('the endpoint summarizes the whole window and returns recent entries newest first', async () => {
  const s = setup();
  try {
    const recorder = createServerLogRecorder(s.store);
    recorder.lifecycle('server started', { build: 'b1' });
    for (let i = 0; i < 3; i++) {
      s.advance(1000);
      recorder.request(request('/missing.png'), '/missing.png', 404, 2);
    }
    s.advance(1000);
    recorder.request(request('/api/area'), '/api/area', 500, 30);
    s.advance(1000);
    recorder.request(request('/api/area'), '/api/area', 200, 2000);
    for (let i = 0; i < 2; i++) {
      s.advance(1000);
      recorder.console('error', ['[world] /api/area unhandled error']);
    }
    const handle = createServerLogsHandler({ store: s.store, buildId: 'b1', startedAt: new Date(T0).toISOString(), now: s.now, cacheMs: 0 });
    const response = handle(request('/api/server-logs?since=1h&limit=2'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body).toMatchObject({ schemaVersion: 'server-logs.v1', build: 'b1', retentionDays: 14, truncated: false });
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].type).toBe('console');
    expect(body.summary.entries).toBe(8);
    expect(body.summary.requests.notFound).toEqual([expect.objectContaining({ path: '/missing.png', count: 3 })]);
    expect(body.summary.requests.serverErrors[0]).toMatchObject({ method: 'GET', path: '/api/area', status: 500, count: 1 });
    expect(body.summary.requests.slowest[0]).toMatchObject({ path: '/api/area', p95Ms: 2000, maxMs: 2000 });
    expect(body.summary.problems[0]).toMatchObject({ type: 'console', count: 2, message: '[world] /api/area unhandled error' });
    expect(body.summary).toMatchObject({ serverStarts: 1, builds: ['b1'] });

    const errors = await handle(request('/api/server-logs?level=error')).json();
    expect(errors.entries).toHaveLength(3);
    expect(errors.entries.every(entry => entry.level === 'error')).toBe(true);
    const area = await handle(request('/api/server-logs?path=/api/area&type=request')).json();
    expect(area.entries.map(entry => entry.status)).toEqual([200, 500]);
    const recent = await handle(request('/api/server-logs?since=' + new Date(T0 + 4500).toISOString())).json();
    expect(recent.entries).toHaveLength(3);

    for (const query of ['since=yesterday', 'limit=5000', 'limit=-1', 'level=toString', 'type=secret', 'until=soon']) {
      expect(handle(request('/api/server-logs?' + query)).status).toBe(400);
    }
    expect(handle(request('/api/server-logs', { method: 'POST' })).status).toBe(405);
  } finally {
    s.cleanup();
  }
});

test('HBL_SERVER_LOGS=off and unsafe directories disable logging without stopping the server', () => {
  const off = createServerLogs({ HBL_SERVER_LOGS: 'off' });
  expect(off.enabled).toBe(false);
  expect(off.handle(request('/api/server-logs')).status).toBe(404);
  const handler = async () => new Response('ok');
  expect(off.instrument(handler)).toBe(handler);

  const original = console.error;
  const seen = [];
  console.error = (...args) => seen.push(args.join(' '));
  try {
    expect(createServerLogs({ HBL_SERVER_LOG_DIR: 'data/server-logs' }).enabled).toBe(false);
  } finally {
    console.error = original;
  }
  expect(seen.join('\n')).toContain('outside public static directories');
});
