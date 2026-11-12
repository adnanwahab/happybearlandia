import { test, expect } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CityStore } from '../world/city/storage.js';
import { createCityApi } from '../world/city/api.js';
import { createEngine } from '../world/city/engine.js';
import { DEFAULT_RECIPE } from '../world/future-machine/contracts.js';
import { createExperiment, initialForRecipe, normalizeReplay } from '../world/future-machine/data/index.js';
import { stateHash } from '../world/future-machine/data/core.js';
import { createRunReceipt, validateRunReceipt, replayRunReceipt, canonicalReceiptJSON } from '../world/future-machine/share/run-receipt.js';

async function localHistory(seed) {
  const recipe = {...DEFAULT_RECIPE,seed,households:1,intervention:null};
  const initial = initialForRecipe(recipe), engine = createEngine();
  const baseline = normalizeReplay(initial, engine.run(initial,120));
  return {recipe,seed,modelVersion:recipe.modelVersion,experimentId:null,initialHash:await stateHash(initial),
    baseline,plan:structuredClone(baseline),provenance:{...initial.provenance,modelManifest:engine.manifest,replay:'Local recipe recomputation; no independently recorded checkpoints.',authority:'monthly City only'}};
}
async function fixture(work) {
  const root = mkdtempSync(join(tmpdir(),'run-receipt-'));
  const store = new CityStore(root), handle = createCityApi({store});
  const realFetch = globalThis.fetch;
  globalThis.fetch = (path, options) => handle(new Request(`http://localhost${path}`,options));
  try { await work({root,handle,realFetch}); }
  finally {globalThis.fetch = realFetch;store.close();rmSync(root,{recursive:true,force:true});}
}

test('real persisted City receipt round-trips selected month, identity and outcome digests', async () => {
  await fixture(async () => {
    const history = await createExperiment({...DEFAULT_RECIPE,households:3});
    const receipt = await createRunReceipt(history,{month:16});
    expect(receipt.evidence.experimentId).toBe(history.experimentId);
    expect(receipt.evidence.seed).toBe(42);
    expect(receipt.rulesRevision).toEqual(createEngine().manifest);
    expect(receipt.units.capitalSpending).toBe('USD cumulative');
    expect(receipt.evidence.provenance.assumptions).toEqual(history.provenance.assumptions);
    expect(receipt.evidence.limitations.join(' ')).toContain('not empirical forecasts');
    expect(receipt.evidence.evidenceKind).toBe('manifest-recomputation');
    const reopened = await replayRunReceipt(JSON.parse(canonicalReceiptJSON(receipt)));
    expect(reopened.month).toBe(16);
    expect(reopened.history).toEqual(history);
    const {identity: selectedIdentity, ...selected} = history.plan[16];
    const {identity: terminalIdentity, ...terminal} = history.baseline[120];
    expect(reopened.receipt.outcomeDigests.plan.selected).toBe(await stateHash(selected));
    expect(reopened.receipt.outcomeDigests.baseline.terminal).toBe(await stateHash(terminal));
    expect(Object.isFrozen(reopened.receipt.evidence.observations.plan.metrics)).toBe(true);
    const altered = structuredClone(receipt);
    altered.outcomeDigests.plan.terminal = '0'.repeat(64);
    const {checksum,...body} = altered; altered.checksum = await stateHash(body);
    await expect(replayRunReceipt(altered)).rejects.toThrow('outcome digests');
  });
},15000);

test('seed boundaries, null identity, deterministic canonical bytes and detached frozen export', async () => {
  for (const seed of [0,4294967295]) {
    const history = await localHistory(seed), before = await stateHash(history);
    const receipt = await createRunReceipt(history,{month:0});
    expect(receipt.evidence.seed).toBe(seed);
    expect(receipt.evidence.experimentId).toBeNull();
    expect(await validateRunReceipt(JSON.parse(canonicalReceiptJSON(receipt)))).toEqual(receipt);
    expect(canonicalReceiptJSON(Object.fromEntries(Object.entries(receipt).reverse()))).toBe(canonicalReceiptJSON(receipt));
    expect(await stateHash(history)).toBe(before);
    expect(Object.isFrozen(receipt.evidence.provenance.assumptions)).toBe(true);
    const recorded = receipt.evidence.observations.plan.metrics.housingUnits;
    history.plan[0].metrics.housingUnits = 99;
    expect(receipt.evidence.observations.plan.metrics.housingUnits).toBe(recorded);
    await expect(replayRunReceipt(receipt)).rejects.toThrow('unsaved');
  }
});

test('invalid fields, bounds, versions and tampering fail before any replay/network', async () => {
  const receipt = await createRunReceipt(await localHistory(0));
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => {calls++;throw new Error('unexpected network');};
  try {
    const mutations = [
      r => {r.schemaVersion = 'canonical-run-receipt.v99';},
      r => {r.evidence.modelVersion = 'old';},
      r => {r.evidence.recipe.modelVersion = 'old';},
      r => {r.rulesRevision = {};},
      r => {delete r.evidence.seed;},
      r => {delete r.evidence.observations.plan.events;},
      r => {r.evidence.recipe.seed = -1;},
      r => {r.evidence.recipe.seed = 4294967296;},
      r => {r.evidence.recipe.households = 121;},
      r => {r.evidence.recipe.months = 119;},
      r => {r.evidence.recipe.intervention = {...DEFAULT_RECIPE.intervention,amount:121};},
      r => {r.evidence.month = 121;},
      r => {r.evidence.experimentId = '../secret';},
      r => {r.scenarioIds.plan = 'other';},
      r => {r.timeRange.lastMonth = 119;},
      r => {r.evidence.initialHash = '0'.repeat(64);},
      r => {r.evidence.observations.plan.metrics.housingUnits++;},
      r => {r.checksum = '0'.repeat(64);},
      r => {r.evidence.limitations = [];},
      r => {r.units.meanRent = 'GBP';},
      r => {r.outcomeDigests = {};},
      r => {r.extra = true;},
    ];
    for (const mutate of mutations) {
      const broken = structuredClone(receipt); mutate(broken);
      await expect(replayRunReceipt(broken)).rejects.toThrow();
    }
    expect(calls).toBe(0);
  } finally {globalThis.fetch = realFetch;}
  const incomplete = await localHistory(0); incomplete.baseline.pop();
  await expect(createRunReceipt(incomplete)).rejects.toThrow('Month 0');
});

async function cli(args) {
  const proc = Bun.spawn([process.execPath,'scripts/export-run-receipt.js',...args],{stdout:'pipe',stderr:'pipe'});
  const [stdout,stderr,code] = await Promise.all([new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited]);
  return {stdout,stderr,code};
}

test('normal CLI emits canonical receipt; failures emit only stderr and nonzero exit', async () => {
  await fixture(async ({handle,realFetch}) => {
    const history = await createExperiment({...DEFAULT_RECIPE,households:3});
    const server = Bun.serve({port:0,hostname:'127.0.0.1',fetch:handle});
    globalThis.fetch = realFetch;
    try {
      const args = [server.url.origin,history.experimentId,'16'];
      const success = await cli(args);
      expect(success.code).toBe(0);expect(success.stderr).toBe('');
      const receipt = await validateRunReceipt(JSON.parse(success.stdout));
      expect(receipt).toEqual(await createRunReceipt(history,{month:16}));
      expect(success.stdout).toBe(canonicalReceiptJSON(receipt)+'\n');
      for (const bad of [[],[server.url.origin,'city_missing','16'],[server.url.origin,history.experimentId,'121']]) {
        const result = await cli(bad);
        expect(result.code).toBe(1);expect(result.stdout).toBe('');expect(result.stderr).toContain('Run receipt export failed:');
      }
      if (process.env.HBL_RECEIPT_ARTIFACT) writeFileSync(process.env.HBL_RECEIPT_ARTIFACT,success.stdout);
      console.log(`Disposable CLI: bun scripts/export-run-receipt.js ${args.join(' ')} => exit 0; city_missing => exit 1, empty stdout; month 121 => exit 1, empty stdout`);
    } finally {server.stop(true);}
  });
},15000);


test('prior-batch City 1.1 receipts replay unchanged after adding snapshot transport identity',async()=>{
 await fixture(async()=>{
  const history=await createExperiment({...DEFAULT_RECIPE,households:2});
  expect(history.modelVersion).toBe('city-systems.1.1.0');
  const legacySnapshot=snapshot=>{const {identity,...recorded}=snapshot;return recorded;};
  // Reconstruct the prior-batch v1 checksum from its untagged full snapshots,
  // independently of the current receipt producer's outcome-digest algorithm.
  const legacy=structuredClone(await createRunReceipt(history,{month:16}));
  for(const arm of ['baseline','plan'])legacy.outcomeDigests[arm]={
   selected:await stateHash(legacySnapshot(history[arm][16])),
   terminal:await stateHash(legacySnapshot(history[arm][120]))
  };
  const {checksum,...body}=legacy;legacy.checksum=await stateHash(body);
  expect(await validateRunReceipt(legacy)).toEqual(legacy);
  const reopened=await replayRunReceipt(legacy);
  expect(reopened.history.plan[16].identity).toEqual({experimentId:history.experimentId,scenarioId:'plan',runIndex:0,runId:'plan-0'});
  expect(canonicalReceiptJSON(await createRunReceipt(reopened.history,{month:16}))).toBe(canonicalReceiptJSON(legacy));
  const wrong=structuredClone(history);wrong.plan[16].identity.experimentId='city_other';
  await expect(createRunReceipt(wrong,{month:16})).rejects.toThrow('identity');
 });
},20000);
