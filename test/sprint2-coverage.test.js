import {expect, test} from 'bun:test';
import {Database} from 'bun:sqlite';
import {createCausalStore} from '../shared/causality/storage.js';
import {createCausalityReadHandler} from '../world/causality/read-api.js';
import {loadCoverage} from '../world/sprint2/coverage.js';

test('coverage reads the selected run across pages and distinguishes evidence, absent links, and missing dependencies', async () => {
  using db = new Database(':memory:');
  const store = createCausalStore(db);
  const context = {universeId: 'universe:test:1', worldId: 'world:test:1', scenarioId: 'scenario:test:1',
    runId: 'run:test:1', seed: 1, modelVersion: 'coverage/1', tick: 0};
  store.createRun({context, metadata: {manifest: {domain: 'city'}}});
  store.createRun({...context, runId: 'run:test:other'});
  const provenance = {id: 'provenance:test:1', kind: 'simulated', source: 'Fixture model', modelVersion: context.modelVersion, sourceIds: []};
  const events = Array.from({length: 101}, (_, sequence) => ({
    id: `event:test:${sequence}`, context, sequence, type: 'step', entityIds: [],
    payload: sequence === 99 ? {replayEvent: {replayKind: 'narrative', domain: 'housing'}} : {system: 'housing'},
    provenance
  }));
  const observations = [101, 102, 103].map(sequence => ({
    id: `observation:test:${sequence}`, context, sequence, entityId: context.worldId,
    metricId: 'metric:test:rent', value: 10, unit: 'usd', provenance
  }));
  const edge = (suffix, fromId, toId, relation, evidenceIds = []) => ({
    id: `edge:test:${suffix}`, context, fromId, toId, relation, confidence: 1, evidenceIds, provenance
  });
  store.commitStep(context.runId, {expectedRevision: 0, events, observations, edges: [
    edge('linked', events[0].id, events[100].id, 'contributes', [events[0].id]),
    edge('association', events[100].id, observations[0].id, 'correlates', [events[100].id]),
    edge('missing', events[99].id, observations[1].id, 'constrains'),
    edge('empty-evidence', events[100].id, observations[2].id, 'causes')
  ]});
  store.completeRun(context.runId, {expectedRevision: 1});
  // Simulate a source lookup gap while preserving valid, versioned storage records.
  const handle = createCausalityReadHandler({store: {
    ...store,
    getNode: (runId, nodeId) => nodeId === events[99].id ? null : store.getNode(runId, nodeId)
  }});
  const calls = [];
  const report = await loadCoverage(async (path, params) => {
    calls.push({path, ...params});
    const response = await handle(new Request(`http://localhost/api/causality/${path}?${new URLSearchParams(params)}`));
    expect(response.ok).toBe(true);
    return response.json();
  }, context.runId);

  expect(calls).toContainEqual({path: 'events', runId: context.runId, limit: 100, afterSequence: 99});
  expect(calls.every(call => call.runId === context.runId)).toBe(true);
  expect(report.descriptive).toBe(1);
  expect(report.totals).toEqual({total: 103, linked: 2, unlinked: 100, unknown: 1,
    withEvidence: 1, evidenceUnknown: 1, withProvenance: 103});
  expect(report.rows).toEqual([
    {domain: 'city', kind: 'observations', type: 'metric:test:rent', total: 3, linked: 1, unlinked: 1, unknown: 1,
      withEvidence: 0, evidenceUnknown: 1, withProvenance: 3},
    {domain: 'housing', kind: 'events', type: 'step', total: 100, linked: 1, unlinked: 99, unknown: 0,
      withEvidence: 1, evidenceUnknown: 0, withProvenance: 100}
  ]);
  expect(report.sources).toEqual([{source: provenance.source, kind: provenance.kind, modelVersion: provenance.modelVersion, count: 2}]);
});
