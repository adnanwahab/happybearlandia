import { describe, expect, test } from 'bun:test';
import { createServerCivicApiHandler, resolveServerRunInput } from '../world/server-civic-api.js';
import { RunJobManager } from '../world/run-job-manager.js';
import { RUN_INPUT_LIMITS as L, validateRunInput } from '../world/run-input.js';

// Synthetic civic-experiment.v1 / world-batch.v2 inputs, fixed seed 42.
function fixture() {
  return {
    experiment: { schemaVersion: 'civic-experiment.v1', id: 'security-fixture',
      createdAt: '2026-11-11T00:00:00.000Z', plan: { id: 'synthetic', actions: [] },
      worldModel: { variables: [], causalEdges: [], scenarioFamilies: [] },
      experiment: { runs: 1, horizonYears: 1, seed: 42 }, outcomes: { metricRegistry: [] } },
    worldBatch: { schemaVersion: 'world-batch.v2', seed: 42, worlds: [
      { id: 'world_1', seed: 42, conditions: {}, normalized: {}, deviations: {} },
    ] }, adapter: 'stress',
  };
}
const request = body => new Request('http://localhost/api/runs', { method: 'POST', body });
const json = value => request(JSON.stringify(value));

const invalidFixtures = [
  ['null body', () => null], ['array body', () => []],
  ['oversized array', () => ({ ...fixture(), junk: Array(L.array + 1).fill(0) })],
  ['oversized world batch', () => ({ ...fixture(), worldBatch: { worlds: Array(L.array + 1).fill(null) } })],
  ['generation amplification', () => { const input = fixture(); delete input.worldBatch; input.runs = 100000; input.experiment.worldModel.variables = Array(100).fill({ id: 'x' }); return input; }],
  ['null world', () => ({ ...fixture(), worldBatch: { worlds: [null] } })],
  ['fake array', () => ({ ...fixture(), worldBatch: { worlds: { length: 1 } } })],
  ['empty worlds', () => ({ ...fixture(), worldBatch: { worlds: [] } })],
  ['missing world ID', () => ({ ...fixture(), worldBatch: { worlds: [{}] } })],
  ['invalid timestamp', () => ({ ...fixture(), timestamp: 'private-invalid-date' })],
  ['impossible date', () => ({ ...fixture(), timestamp: '2026-02-30T00:00:00.000Z' })],
  ['null timestamp', () => ({ ...fixture(), timestamp: null })],
  ['deep input', () => { let junk = 0; for (let i = 0; i < L.depth + 1; i++) junk = { junk }; return { ...fixture(), junk }; }],
  ['node budget', () => ({ ...fixture(), junk: [Array(L.array).fill(0), Array(L.array).fill(0), Array(L.array).fill(0)] })],
];

describe('public run input security fixtures', () => {
  for (const [name, build] of invalidFixtures) test(name, async () => {
    const manager = new RunJobManager();
    const handler = createServerCivicApiHandler({ runManager: manager });
    const response = await handler(json(build()));
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text.length).toBeLessThanOrEqual(L.errorChars + 30);
    expect(JSON.parse(text).error).toBeString();
    expect(text).not.toContain('private-invalid-date');
    expect(manager.jobs.size).toBe(0);
    const accepted = await handler(json(fixture()));
    expect(accepted.status).toBe(202);
    expect((await manager.wait((await accepted.json()).id)).status).toBe('complete');
  });

  for (const body of ['{', '{"seed":NaN}', '{"seed":Infinity}', '{"seed":1e999}']) test(`invalid JSON/nonfinite wire number: ${body}`, async () => {
    const handler = createServerCivicApiHandler();
    const response = await handler(request(body));
    expect(response.status).toBe(400);
    expect((await response.json()).error.length).toBeLessThanOrEqual(L.errorChars);
  });

  test('in-memory NaN and infinities are rejected before JSON can turn them into null', async () => {
    for (const seed of [NaN, Infinity, -Infinity]) await expect(resolveServerRunInput({ ...fixture(), seed })).rejects.toThrow('finite');
  });

  test('array and depth boundaries accept the limit and reject limit + 1', () => {
    expect(() => validateRunInput(Array(L.array).fill(0))).not.toThrow();
    expect(() => validateRunInput(Array(L.array + 1).fill(0))).toThrow('array');
    let nested = 0;
    for (let i = 0; i < L.depth; i++) nested = [nested];
    expect(() => validateRunInput(nested)).not.toThrow();
    expect(() => validateRunInput([nested])).toThrow('complexity');
  });

  test('byte limit works without Content-Length and counts UTF-8 bytes', async () => {
    const handler = createServerCivicApiHandler();
    const valid = JSON.stringify(fixture());
    expect((await handler(request(valid + ' '.repeat(L.bytes - valid.length)))).status).toBe(202);
    for (const body of [valid + ' '.repeat(L.bytes + 1 - valid.length), JSON.stringify({ junk: 'é'.repeat(L.bytes / 2) })]) {
      const response = await handler(request(body));
      expect(response.status).toBe(413);
      expect(await response.json()).toEqual({ error: 'Run request too large' });
    }
  });

  test('stream stops reading at the first oversized chunk', async () => {
    let cancelled = false;
    const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(L.bytes + 1)); }, cancel() { cancelled = true; } });
    const response = await createServerCivicApiHandler()(new Request('http://localhost/api/runs', { method: 'POST', body, duplex: 'half' }));
    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
  });

  test('polling-only failure does not crash an isolated Bun process', async () => {
    const source = `
      import { createServerCivicApiHandler } from './world/server-civic-api.js';
      const fixture = ${fixture.toString()};
      const handle = createServerCivicApiHandler({ resolveAdapter: () => ({ id: 'broken', simulateWorld() { throw new Error('fixture failure'); } }) });
      const post = body => handle(new Request('http://local/api/runs', { method: 'POST', body: JSON.stringify(body) }));
      const rejected = await post({ ...fixture(), timestamp: 'invalid' });
      if (rejected.status !== 400) throw new Error('Expected input rejection');
      const response = await post(fixture());
      if (response.status !== 202) throw new Error('Expected accepted job');
      const { id } = await response.json();
      await Bun.sleep(30);
      const status = await handle(new Request('http://local/api/runs/' + id));
      if ((await status.json()).status !== 'failed') throw new Error('Expected failed job');
      if ((await post(null)).status !== 400) throw new Error('Handler stopped responding');
      console.log('survived');
    `;
    const child = Bun.spawn([process.execPath, '--eval', source], { cwd: new URL('..', import.meta.url).pathname, stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(exit).toBe(0);
    expect(stderr).toBe('');
    expect(stdout.trim()).toBe('survived');
  });

  test('failed background jobs are observable without unhandled rejection; wait still rejects', async () => {
    const manager = new RunJobManager();
    const handler = createServerCivicApiHandler({ runManager: manager, resolveAdapter: () => ({ id: 'broken', async simulateWorld() { throw new Error('fixture failure'); } }) });
    const response = await handler(json(fixture()));
    expect(response.status).toBe(202);
    const { id } = await response.json();
    await Bun.sleep(20); // Allow a polling-only client to miss the rejected promise.
    expect(manager.get(id).status).toBe('failed');
    await expect(manager.wait(id)).rejects.toThrow();
  });
});
