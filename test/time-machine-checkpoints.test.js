import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { canonicalId } from '../shared/causality/index.js';
import { causalContentHash, createCausalStore } from '../shared/causality/storage.js';
import { createCausalityHandler } from '../world/causality/api.js';
import { createCity } from '../world/city/seed.js';
import { VERSION } from '../world/city/contracts.js';
import { createCityReplayAdapter } from '../world/replay/city-adapter.js';
import { createReplayCheckpoint } from '../world/replay/engine.js';

test('checkpoint metadata is run-scoped and paginates past unsupported checkpoints', async () => {
  const database = new Database(':memory:');
  try {
    const store = createCausalStore(database);
    const context = {
      universeId: canonicalId('universe', 'test', 'universe'),
      worldId: canonicalId('world', 'test', 'city'),
      scenarioId: canonicalId('scenario', 'test', 'scenario'),
      runId: canonicalId('run', 'test', 'selected'),
      modelVersion: VERSION,
      seed: 123,
      tick: 0,
    };
    const state = createCity({ seed: context.seed });
    const id = canonicalId('checkpoint', 'test', 'non-demo-id');
    const adapter = createCityReplayAdapter();
    const checkpoint = await createReplayCheckpoint({ id, context, tick: 0, adapter, state });
    const legacyState = { month: 0 };
    store.createRun(context);
    store.commitStep(context.runId, { expectedRevision: 0, checkpoints: [{
      id: canonicalId('checkpoint', 'test', 'legacy'),
      context,
      sequence: 0,
      state: legacyState,
      hash: causalContentHash(legacyState),
      replayMode: 'recorded',
    }, {
      id,
      context,
      sequence: 1,
      state: checkpoint,
      hash: causalContentHash(checkpoint),
      replayMode: 'recorded',
    }] });
    store.completeRun(context.runId, { expectedRevision: 1 });
    const otherRun = { ...context, runId: canonicalId('run', 'test', 'other') };
    store.createRun(otherRun);
    const handle = createCausalityHandler({ store });
    const metadata = (runId, options = '') => handle(new Request(
      `http://localhost/api/causality/checkpoints?runId=${encodeURIComponent(runId)}${options}`,
    ));

    expect(await (await metadata(context.runId, '&limit=1')).json()).toEqual({
      items: [], nextCursor: 0,
    });
    expect(await (await metadata(context.runId, '&limit=1&afterSequence=0')).json()).toEqual({
      items: [{
        id, tick: 0, domain: 'world-city', modelVersion: VERSION, adapterVersion: adapter.adapterVersion,
      }],
      nextCursor: null,
    });
    expect(await (await metadata(otherRun.runId)).json()).toEqual({ items: [], nextCursor: null });
    expect((await metadata(canonicalId('run', 'test', 'missing'))).status).toBe(404);
    expect((await metadata(context.runId, '&afterSequence=-1')).status).toBe(400);

    const query = new URLSearchParams({ context: JSON.stringify(context), tick: 0, checkpointId: id });
    const response = await handle(new Request(`http://localhost/api/causality/state?${query}`));
    expect(response.status).toBe(200);
    expect((await response.json()).checkpoint.id).toBe(id);
  } finally {
    database.close();
  }
});
