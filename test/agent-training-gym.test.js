import { test, expect } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gymEnvironment, rebuildGym, runGym, gymEpisode, replayGym } from '../world/agent-training-gym.js';
import { createServerCivicApiHandler } from '../world/server-civic-api.js';

test('persist declaration before execution; reopen and replay immutable registry results', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gym-'));
  const handler = createServerCivicApiHandler({ experimentRoot: root });
  const call = (path, body) => handler(new Request(`http://localhost/api/experiments${path}`, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }));
  try {
    const declaration = await (await call('/gym', {})).json();
    expect(declaration.snapshot.environment.rewardDigest).toBeTruthy();
    expect((await call('/experiment_missing/gym-run', {})).status).toBe(404);
    expect((await call(`/${declaration.id}/gym-run`, { reward: {} })).status).toBe(400);
    const response = await call(`/${declaration.id}/gym-run`, {});
    expect(response.status).toBe(201);
    const record = await response.json();
    expect(record.parentExperimentId).toBe(declaration.id);
    const reopened = await (await call(`/${record.id}`)).json();
    expect(reopened.snapshot).toEqual(record.snapshot);
    expect(reopened.registry.resultKind).toBe('synthetic');
    expect(reopened.snapshot.evaluation.realWorld).toMatchObject({ status: 'unavailable', sampleCount: 0 });
    expect((await (await call(`/${record.id}/replay`, {})).json()).exact).toBe(true);
    expect((await call(`/${record.id}/gym-run`, {})).status).toBe(400);
    expect((await (await call(`/${declaration.id}`)).json()).snapshot).toEqual(declaration.snapshot);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('rebuild validates artifacts and replay compares stored evidence including rewards', () => {
  const env = gymEnvironment();
  for (const field of ['reward', 'source', 'version', 'initialState']) {
    const changed = structuredClone(env); delete changed[field];
    expect(() => rebuildGym(changed)).toThrow();
  }
  const run = runGym(env);
  expect(replayGym(JSON.parse(JSON.stringify(run))).exact).toBe(true);
  const missing = structuredClone(run); delete missing.training[0].trajectory[0].observation;
  expect(replayGym(missing).exact).toBe(false);
  run.heldOut[0].trajectory[0].reward += 1;
  expect(replayGym(run).exact).toBe(false);
  expect(env.trainingSeeds.some(seed => env.evaluationSeeds.includes(seed))).toBe(false);
  expect(runGym(env, 'wait.v1').heldOut.map(e => e.seed)).toEqual(run.heldOut.map(e => e.seed));
});

test('bounded transitions, causal chain, invalid input and interrupted episode', () => {
  const env = gymEnvironment();
  const episode = gymEpisode(env, 101, 'stock-threshold.v1');
  expect(episode.trajectory).toHaveLength(8);
  expect(episode.termination).toBe('step-limit');
  for (const step of episode.trajectory) {
    expect(step.nextObservation.stock).toBeGreaterThanOrEqual(0);
    expect(step.nextObservation.stock).toBeLessThanOrEqual(4);
    expect(step.reward).toBe(Object.values(step.components).reduce((a,b) => a+b,0));
    if (step.observation.tick) expect(step.causes).toEqual([`step_${step.observation.tick - 1}`]);
  }
  expect(gymEpisode(env, 101, 'wait.v1', []).termination).toBe('interrupted');
  expect(gymEpisode(env, 101, 'wait.v1', ['bad']).termination).toBe('invalid-action');
  expect(() => gymEpisode(env, -1, 'wait.v1')).toThrow();
  expect(() => runGym(env, 'external')).toThrow();
  const empty = gymEpisode(env, 0, 'wait.v1');
  expect(empty.trajectory.some(s => s.components.shortage < 0)).toBe(true);
});
