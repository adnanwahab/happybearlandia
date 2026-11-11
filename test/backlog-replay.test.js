import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHousingCheckpointRepository } from '../world/decision/backlog-replay/repository.js';
import { canonicalJSON, canonicalDigest } from '../world/replay/engine.js';
import { writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHousingCheckpointAdapter } from '../world/decision/backlog-replay/index.js';
import { simulateHousingRun, createHousingScenarios } from '../world/models/housing/index.js';
import { createBuildingProposal } from '../world/buildings/proposal.js';
// Exercise the exact proposed shared-file hooks in an isolated temporary source tree.
const temp = mkdtempSync(join(tmpdir(), 'hbl-replay-'));
mkdirSync(join(temp, 'world'));
const modelRoot = process.env.HBL_REPLAY_SOURCE_ROOT;
cpSync(modelRoot ? join(modelRoot, 'world/models') : new URL('../world/models', import.meta.url), join(temp, 'world/models'), { recursive: true });
cpSync(modelRoot ? join(modelRoot, 'world/buildings') : new URL('../world/buildings', import.meta.url), join(temp, 'world/buildings'), { recursive: true });
const patchPath = new URL('../world/decision/backlog-replay/integration.patch', import.meta.url).pathname;
const apply = (...options) => Bun.spawnSync(['git', 'apply', '--unsafe-paths', ...options, patchPath], { cwd: temp });
const forward = apply('--check');
if (forward.exitCode === 0) {
  const result = apply();
  if (result.exitCode) throw new Error(result.stderr.toString());
} else {
  const reverse = apply('--reverse', '--check');
  if (reverse.exitCode) throw new Error('Partial or incompatible checkpoint hooks: ' + forward.stderr.toString() + reverse.stderr.toString());
}
const integrated = await import(join(temp, 'world/models/housing/index.js'));
const adapter = createHousingCheckpointAdapter({ simulateRun: integrated.simulateHousingRun });
const input = seed => ({ parameters: createHousingScenarios()[1].parameters, seed, years: 10, projects: [createBuildingProposal({ id: 'checkpoint-tower', status: 'approved' })] });
try {
  test('actual housing restart preserves all numerical output, lifecycle risk, and event history', async () => {
    for (const seed of [0, 42, 4294967295]) {
      const base = input(seed), expected = simulateHousingRun(base);
      expect((await adapter.start(base)).result).toEqual(expected);
      const a = await adapter.start(base, 13), serialized = a.serialized;
      const b = await adapter.resume(serialized, 37);
      const c = await adapter.resume(b.serialized, 120);
      expect(c.result).toEqual(expected);
      expect(a.serialized).toBe(serialized);
      expect(Object.isFrozen(a.checkpoint.state.lifecycle.rows)).toBe(true);
    }
  });
  test('nested forks retain immutable causal prefix and seed-matched no-op control', async () => {
    const base = input(42), a = await adapter.start(base, 24);
    const b = await adapter.fork(a.serialized, [{ op: 'set_parameter', target: 'construction_capacity', value: 1000 }], 48);
    const direct = simulateHousingRun({ ...base, fork: { month: 24, operations: [{ op: 'set_parameter', target: 'construction_capacity', value: 1000 }] } });
    const end = await adapter.resume(b.serialized, 120);
    const { fork, ...numerical } = direct;
    expect(end.result).toEqual(numerical);
    const c = await adapter.fork(b.serialized, [{ op: 'apply_stress_preset', target: 'stressPresets', value: 'recession' }], 120);
    expect(c.result.monthlyTimeline.slice(0, 49)).toEqual(b.result.monthlyTimeline);
    expect(c.result.events.filter(e => e.month <= 48)).toEqual(b.result.events);
    expect(c.checkpoint.lineage).toHaveLength(2);
    expect(c.checkpoint.lineage[1].parentDigest).toBe(b.checkpoint.digest);
    const control = await adapter.fork(b.serialized, [], 120);
    const { fork: lineage, ...controlBody } = control.result;
    expect(controlBody).toEqual(end.result);
    expect((await adapter.fork(b.serialized, [{ op: 'apply_stress_preset', target: 'stressPresets', value: 'recession' }], 120)).serialized).toBe(c.serialized);
  });
  test('restored lifecycle retains added project clocks and forward cancellation', async () => {
    const a = await adapter.start(input(42), 12);
    const added = createBuildingProposal({ id: 'nested-added', status: 'approved', location: { x: -142 } });
    const b = await adapter.fork(a.serialized, [{ op: 'add_building', target: 'world.projects', value: added }], 13);
    const c = await adapter.fork(b.serialized, [{ op: 'remove_building', target: added.id }], 14);
    const d = await adapter.resume(c.serialized, 120);
    const row = d.result.projects.find(row => row.projectId === added.id);
    expect(row.states[0].month).toBe(13);
    expect(row.states.at(-1).status).toBe('cancelled');
    expect(row.states.filter(state => state.month <= 13)).toEqual(b.result.projects.find(row => row.projectId === added.id).states);
    expect(d.result.accounting.finalHousing).toBeCloseTo(d.result.accounting.initialHousing + d.result.accounting.completedHomes - d.result.accounting.demolishedHomes, 5);
  });
  test('strict canonical envelopes reject duplicate keys and rehashed incomplete state', async () => {
    const a = await adapter.start(input(42), 12);
    await expect(adapter.restore(' ' + a.serialized)).rejects.toThrow('Noncanonical');
    await expect(adapter.restore(a.serialized.replace('{', '{"schemaVersion":"duplicate",'))).rejects.toThrow('Noncanonical');
    for (const mutate of [r => delete r.state.randomState, r => r.state.monthlyTimeline.splice(2, 1), r => r.state.lifecycle.rows.push(r.state.lifecycle.rows[0])]) {
      const r = JSON.parse(a.serialized); mutate(r); delete r.digest; r.digest = await canonicalDigest(r);
      await expect(adapter.restore(canonicalJSON(r))).rejects.toThrow();
    }
    const r = JSON.parse(a.serialized); r.state.rent += 1;
    await expect(adapter.restore(canonicalJSON(r))).rejects.toThrow('Corrupt');
  });
  test('disk repository survives reopen with immutable conditional saves and scoped parent retention', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'hbl-checkpoints-'));
    const publicRoot = mkdtempSync(join(tmpdir(), 'hbl-served-'));
    const scope = { ownerId: 'owner1', experimentId: 'experiment1', runId: 'run1' };
    let time = 1000;
    const create = () => createHousingCheckpointRepository({ directory, adapter, publicRoots: [publicRoot], now: () => time });
    try {
      const repo = create(), a = await adapter.start(input(42), 24);
      const expiresAt = 10000;
      const sameMonthResume = await adapter.resume(a.serialized, 24);
      expect(sameMonthResume.checkpoint.id).not.toBe(a.checkpoint.id);
      const saves = await Promise.all([repo.save(scope, a.serialized, { expiresAt }), repo.save(scope, a.serialized, { expiresAt })]);
      expect(saves[0]).toEqual(saves[1]);
      const pinned = { id: a.checkpoint.id, digest: a.checkpoint.digest };
      expect((await create().load(scope, pinned)).serialized).toBe(a.serialized);
      await expect(repo.save(scope, a.serialized, { expiresAt: 9000 })).rejects.toThrow('conflict');
      await expect(repo.load({ ...scope, ownerId: 'owner2' }, pinned)).rejects.toThrow();
      await expect(repo.load(scope, { ...pinned, digest: 'wrong' })).rejects.toThrow();
      const b = await adapter.fork(a.serialized, [{ op: 'set_parameter', target: 'construction_capacity', value: 1000 }], 48);
      await expect(repo.save(scope, b.serialized, { expiresAt })).rejects.toThrow('parent');
      const parent = pinned;
      await expect(repo.save(scope, b.serialized, { expiresAt: 10001, parent })).rejects.toThrow('outlive');
      const changed = JSON.parse(b.serialized);
      changed.state.monthlyTimeline[0].metrics.median_rent += 1;
      delete changed.digest; changed.digest = await canonicalDigest(changed);
      await expect(repo.save(scope, canonicalJSON(changed), { expiresAt, parent })).rejects.toThrow('prefix');
      await repo.save(scope, b.serialized, { expiresAt, parent });
      const c = await adapter.fork(b.serialized, [{ op: 'apply_stress_preset', target: 'stressPresets', value: 'recession' }], 72);
      await repo.save(scope, c.serialized, { expiresAt, parent: { id: b.checkpoint.id, digest: b.checkpoint.digest } });
      const restored = await create().load(scope, { id: c.checkpoint.id, digest: c.checkpoint.digest });
      expect((await adapter.resume(restored.serialized, 120)).result).toEqual((await adapter.resume(c.serialized, 120)).result);
      expect((await repo.load(scope, pinned)).serialized).toBe(a.serialized);
      expect((await readdir(directory)).filter(path => path.endsWith('.tmp'))).toEqual([]);
      time = expiresAt;
      await expect(repo.load(scope, pinned)).rejects.toThrow('expired');
      time = 1000;
      const file = (await readdir(directory))[0];
      await writeFile(join(directory, file), 'x'.repeat(8 * 1024 * 1024 + 4097));
      await expect(repo.load(scope, { id: [a, b, c].find(row => file.includes(row.checkpoint.id.slice(15))).checkpoint.id })).rejects.toThrow('oversized');
      const publicRepo = createHousingCheckpointRepository({ directory: join(publicRoot, 'bad'), adapter, publicRoots: [publicRoot] });
      await expect(publicRepo.save(scope, a.serialized, { expiresAt: Date.now() + 10000 })).rejects.toThrow('served roots');
    } finally { rmSync(directory, { recursive: true, force: true }); rmSync(publicRoot, { recursive: true, force: true }); }
  });
  test('missing, corrupt, oversized and mismatched identities reject without fallback', async () => {
    const a = await adapter.start(input(42), 12);
    for (const value of ['', '{}', 'x'.repeat(8 * 1024 * 1024 + 1)]) await expect(adapter.restore(value)).rejects.toThrow();
    for (const key of ['modelVersion', 'engineVersion', 'rulesVersion', 'recipeVersion', 'id', 'recipeDigest', 'digest']) {
      const record = JSON.parse(a.serialized); record[key] = 'wrong';
      await expect(adapter.restore(JSON.stringify(record))).rejects.toThrow();
    }
    await expect(adapter.restore(a.serialized, { id: 'other-checkpoint' })).rejects.toThrow('Requested id mismatch');
    await expect(adapter.resume(a.serialized, 11)).rejects.toThrow();
    await expect(adapter.fork(a.serialized, [{ op: 'set_parameter', target: 'initial_housing', value: 1 }], 24)).rejects.toThrow();
    await expect(adapter.start({ ...input(42), seed: undefined })).rejects.toThrow();
    const bare = createHousingCheckpointAdapter({ simulateRun: ({replay, ...input}) => simulateHousingRun(input) });
    await expect(bare.start(input(42), 12)).rejects.toThrow('hooks unavailable');
  });
} finally { /* imports are cached; test callbacks no longer need temporary source files */ rmSync(temp, { recursive: true, force: true }); }
