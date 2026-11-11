import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHousingCheckpointAdapter } from '../world/decision/backlog-replay/index.js';
import { simulateHousingRun, createHousingScenarios } from '../world/models/housing/index.js';
import { createBuildingProposal } from '../world/buildings/proposal.js';
// Exercise the exact proposed shared-file hooks in an isolated temporary source tree.
const temp = mkdtempSync(join(tmpdir(), 'hbl-replay-'));
mkdirSync(join(temp, 'world'));
cpSync(new URL('../world/models', import.meta.url), join(temp, 'world/models'), { recursive: true });
cpSync(new URL('../world/buildings', import.meta.url), join(temp, 'world/buildings'), { recursive: true });
const patch = Bun.spawnSync(['git', 'apply', '--unsafe-paths', new URL('../world/decision/backlog-replay/integration.patch', import.meta.url).pathname], { cwd: temp });
if (patch.exitCode) throw new Error(patch.stderr.toString());
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
    const bare = createHousingCheckpointAdapter({ simulateRun: simulateHousingRun });
    await expect(bare.start(input(42), 12)).rejects.toThrow('hooks unavailable');
  });
} finally { /* imports are cached; test callbacks no longer need temporary source files */ rmSync(temp, { recursive: true, force: true }); }
