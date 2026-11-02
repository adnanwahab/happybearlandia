import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { housingModel, createHousingScenarios, simulateHousingRun, stressPresets } from '../world/models/housing/index.js';
import { createDecisionApiHandler } from '../world/decision/api.js';

const cleanups = [];
afterEach(async () => { while (cleanups.length) await cleanups.pop()(); });

async function setup(options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'hbl-decision-integration-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const handler = createDecisionApiHandler({ directory: root, ...options });
  cleanups.push(() => handler.close());
  const api = async (path = '', options = {}) => {
    const response = await handler(new Request(`http://localhost/api/decision-experiments${path}`, {
      method: options.method || 'GET',
      headers: options.body ? { 'content-type': 'application/json' } : {},
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    }));
    return response;
  };
  api.directory = root;
  api.handler = handler;
  return api;
}

function input(extra = {}) {
  return { schemaVersion: 'decision-experiment.v1', name: 'Integration housing comparison',
    decision: 'Build housing near transit and shorten permitting.', modelId: housingModel.id,
    modelVersion: housingModel.version, seed: 42, runs: 10, years: 10,
    scenarios: createHousingScenarios(), metadata: { test: true }, ...extra };
}

async function execute(api, payload) {
  const created = await api('', { method: 'POST', body: payload });
  expect(created.status).toBe(201);
  const { experiment } = await created.json();
  const started = await api(`/${experiment.id}/start`, { method: 'POST' });
  expect(started.ok).toBe(true);
  return experiment;
}

async function terminal(api, id, limit = 30000) {
  const until = Date.now() + limit;
  while (Date.now() < until) {
    const response = await api(`/${id}`);
    expect(response.ok).toBe(true);
    const { experiment } = await response.json();
    if (['completed', 'cancelled', 'failed'].includes(experiment.status)) return experiment;
    await Bun.sleep(10);
  }
  throw new Error(`Experiment ${id} failed to terminate within ${limit}ms`);
}

// Independent linear-interpolated quantile oracle, using the stored successful
// rows rather than trusting the API's summary as its own expected value.
function quantile(values, p) {
  const sorted = [...values].sort((a, b) => a - b), index = (sorted.length - 1) * p;
  const low = Math.floor(index), high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

describe('Decision API integration', () => {
  test('create → execute → aggregate → compare → manifest → reproduce', async () => {
    const api = await setup(), payload = input();
    const experiment = await execute(api, payload);
    const complete = await terminal(api, experiment.id);
    expect(complete.status).toBe('completed');
    expect(complete.progress.completed).toBe(payload.runs * payload.scenarios.length);
    expect(complete.progress.failed).toBe(0);
    const resultsResponse = await api(`/${experiment.id}/results`);
    expect(resultsResponse.ok).toBe(true);
    const results = await resultsResponse.json();
    expect(results.runs).toHaveLength(payload.runs * payload.scenarios.length);
    expect(results.aggregates).toHaveLength(payload.scenarios.length);
    const stressRun = results.runs.find(row => row.scenarioId === 'stress');
    const planRun = results.runs.find(row => row.scenarioId === 'plan-a' && row.seed === stressRun.seed);
    expect(stressRun.sampledParameters.economic_growth).toBeLessThan(planRun.sampledParameters.economic_growth);
    expect(stressRun.sampledParameters.implementation_delay).toBeGreaterThan(planRun.sampledParameters.implementation_delay);
    expect(stressRun.metrics).not.toEqual(planRun.metrics);
    const baselineId = payload.scenarios.find(s => s.kind === 'baseline').id;
    for (const aggregate of results.aggregates) {
      const rows = results.runs.filter(run => run.scenarioId === aggregate.scenarioId && run.status === 'completed');
      expect(aggregate.count).toBe(rows.length);
      for (const metric of housingModel.metrics) {
        const values = rows.map(row => row.metrics[metric.id]);
        const summary = aggregate.metrics[metric.id];
        expect(summary.mean).toBeCloseTo(values.reduce((a, b) => a + b, 0) / values.length, 6);
        expect(summary.median).toBeCloseTo(quantile(values, .5), 6);
        expect(summary.p10).toBeCloseTo(quantile(values, .1), 6);
        expect(summary.p90).toBeCloseTo(quantile(values, .9), 6);
      }
      if (aggregate.scenarioId === baselineId) continue;
      const paired = rows.map(row => [row, results.runs.find(base => base.scenarioId === baselineId && base.seed === row.seed)]);
      expect(paired.every(([, base]) => Boolean(base))).toBe(true);
      const comparison = results.comparisons.find(row => row.scenarioId === aggregate.scenarioId);
      expect(comparison.baselineScenarioId).toBe(baselineId);
      for (const metric of housingModel.metrics) {
        const deltas = paired.map(([row, base]) => row.metrics[metric.id] - base.metrics[metric.id]);
        expect(comparison.metrics[metric.id].meanDelta).toBeCloseTo(deltas.reduce((a,b) => a+b,0) / deltas.length, 6);
        const lower = ['lower-is-better', 'lower', 'minimize'].includes(metric.direction);
        expect(comparison.metrics[metric.id].probabilityImprovement).toBeCloseTo(deltas.filter(delta => lower ? delta < 0 : delta > 0).length / deltas.length, 6);
      }
    }
    const first = results.runs[0];
    const single = await (await api(`/${experiment.id}/runs/${first.id}`)).json();
    expect(single.run.metrics).toEqual(first.metrics);
    const replay = simulateHousingRun({ parameters: first.sampledParameters, seed: first.seed, years: payload.years });
    expect(replay.metrics).toEqual(first.metrics);
    expect(replay.timeline).toEqual(first.timeline);
    const manifest = await (await api(`/${experiment.id}/manifest`)).json();
    const second = await execute(api, { manifest: manifest.manifest || manifest });
    expect((await terminal(api, second.id)).status).toBe('completed');
    const rerun = await (await api(`/${second.id}/results`)).json();
    expect(rerun.runs.map(row => ({ scenarioId: row.scenarioId, seed: row.seed, metrics: row.metrics, timeline: row.timeline })))
      .toEqual(results.runs.map(row => ({ scenarioId: row.scenarioId, seed: row.seed, metrics: row.metrics, timeline: row.timeline })));
    const share = await api(`/${experiment.id}/share`);
    expect(share.ok).toBe(true);
    expect((await share.json()).runs).toHaveLength(results.runs.length);
    const list = await (await api('')).json();
    expect(list.experiments.some(row => row.id === experiment.id)).toBe(true);
  }, 60000);

  test('invalid parameters fail visibly without creating runnable experiments', async () => {
    const api = await setup();
    const bad = input();
    bad.scenarios[0].parameters[housingModel.parameters[0].id] = housingModel.parameters[0].max + 1;
    expect((await api('', { method: 'POST', body: bad })).status).toBe(400);
    expect((await api('', { method: 'POST', body: input({ runs: 1001 }) })).status).toBe(400);
    expect((await api('/missing')).status).toBe(404);
  });

  test('individual model failures retain successful rows and honest aggregate counts', async () => {
    let count = 0;
    const api = await setup({ model: housingModel, stressPresets, useWorker: false,
      simulateRun: args => { if (++count % 4 === 0) throw new Error('Injected individual run failure'); return simulateHousingRun(args); } });
    const experiment = await execute(api, input());
    const end = await terminal(api, experiment.id);
    expect(end.status).toBe('completed');
    expect(end.progress.failed).toBeGreaterThan(0);
    expect(end.progress.successful).toBeGreaterThan(0);
    const results = await (await api(`/${experiment.id}/results`)).json();
    expect(results.runs.filter(run => run.status === 'failed').every(run => run.error.includes('Injected individual run failure'))).toBe(true);
    expect(results.aggregates.reduce((sum, row) => sum + row.count, 0)).toBe(end.progress.successful);
    expect(results.aggregates.reduce((sum, row) => sum + row.failed, 0)).toBe(end.progress.failed);
  });

  test('SSE sends real progress and closes with a terminal snapshot', async () => {
    const api = await setup();
    const response = await api('', { method: 'POST', body: input() });
    const { experiment } = await response.json();
    const events = await api(`/${experiment.id}/events`);
    expect(events.headers.get('content-type')).toContain('text/event-stream');
    const reading = events.text();
    await api(`/${experiment.id}/start`, { method: 'POST' });
    const text = await reading;
    expect(text).toContain('event: progress');
    expect(text).toContain('event: complete');
    const snapshots = text.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
    expect(snapshots[0].progress.completed).toBe(0);
    expect(snapshots.at(-1).status).toBe('completed');
    expect(snapshots.at(-1).progress.completed).toBe(10 * input().scenarios.length);
    expect(snapshots.every((row, index) => index === 0 || row.progress.completed >= snapshots[index - 1].progress.completed)).toBe(true);
  });

  test('completed results survive a fresh API instance from the private disk store', async () => {
    const api = await setup();
    const experiment = await execute(api, input());
    expect((await terminal(api, experiment.id)).status).toBe('completed');
    const before = await (await api(`/${experiment.id}/results`)).json();
    await api.handler.close();
    const reopened = createDecisionApiHandler({ directory: api.directory });
    cleanups.push(() => reopened.close());
    const response = await reopened(new Request(`http://localhost/api/decision-experiments/${experiment.id}/results`));
    expect(response.status).toBe(200);
    const after = await response.json();
    expect(after.experiment.status).toBe('completed');
    expect(after.runs).toEqual(before.runs);
    expect(after.aggregates).toEqual(before.aggregates);
    expect(after.comparisons).toEqual(before.comparisons);
  });

  test('a 1,000-run batch supports cancellation and responsive concurrent reads', async () => {
    const api = await setup();
    // Full monthly replay is bounded separately from annual metrics. The
    // oversized 20-year request must fail visibly instead of dropping rows.
    const oversized = await api('', { method: 'POST', body: input({ runs: 1000, years: 20 }) });
    expect(oversized.status).toBe(400);
    expect((await oversized.json()).error).toContain('Monthly replay');
    const experiment = await execute(api, input({ runs: 1000, years: 10 }));
    const latency = [];
    for (let i = 0; i < 5; i++) {
      const started = performance.now();
      expect((await api('')).ok).toBe(true);
      latency.push(performance.now() - started);
    }
    expect(Math.max(...latency)).toBeLessThan(2000);
    const cancelled = await api(`/${experiment.id}/cancel`, { method: 'POST' });
    expect(cancelled.ok).toBe(true);
    const end = await terminal(api, experiment.id);
    expect(end.status).toBe('cancelled');
    expect(end.progress.completed).toBeLessThan(end.progress.total);
    console.info('Decision cancellation API latency ms:', JSON.stringify(latency.map(value => Math.round(value))));
  }, 60000);
});
