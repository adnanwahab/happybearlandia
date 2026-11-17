import { test, expect } from 'bun:test';
import { checkMillionRelease } from '../ops/check-million-release.js';
function receipt() {
  return { schema:'hbl.million-release.v1', candidate:'test-sha', runId:'synthetic-test-only', modelVersion:'v1', rulesVersion:'v1', sourceVersion:'v1', scenario:'fixture', seed:42, device:'fixture', os:'fixture', browser:'fixture', artifact:'fixture-only', author:'author',
    counts:{ weightedResidents:1e6, explicitAgents:1e6, updatedAgents:1e6, interactions:1.2e9, graphicalInstances:0 }, windowSeconds:1200,
    memory:{installedBytes:1000, peakUsedBytes:800, swapGrowthBytes:0, incidents:0},
    matrix:[{device:'fixture', browser:'fixture', artifact:'fixture-only', trials:20, firstPlayP95Ms:10000, fallbacks:Object.fromEntries(['noWebGPU','deviceLoss','workerFailure','memoryPressure','missingAssets','unsupportedReplay'].map(k=>[k,true]))}],
    correctness:{invariantViolations:0, missingEvents:0, replayPassed:true, matchedSeedsPassed:true},
    review:{reviewer:'reviewer', operator:'operator', approved:true, operatorApproved:true, blockingFindings:0, candidate:'test-sha', runId:'synthetic-test-only'} };
}
test('synthetic boundary receipt passes and reports separate units', () => {
  const r=checkMillionRelease(receipt()); expect(r.status).toBe('PASS'); expect(r.counts.graphicalInstances).toBe(0); expect(r.interactionsPerSecond).toBe(1e6);
});
test('missing and malformed evidence fails closed', () => {
  for(const e of [{}, null, [], {counts:null,matrix:[null]}]) expect(checkMillionRelease(e).status).toBe('HOLD');
});
test('each acceptance gate independently holds a candidate', () => {
  const mutations = [e=>e.counts.explicitAgents=999999, e=>e.counts.updatedAgents=999999, e=>e.counts.interactions--, e=>e.windowSeconds=1199, e=>e.memory.peakUsedBytes=801, e=>e.memory.swapGrowthBytes=1, e=>e.memory.incidents=1, e=>e.matrix=[], e=>e.matrix[0].firstPlayP95Ms=10001, e=>e.matrix[0].trials=19, e=>e.correctness.missingEvents=1, e=>e.correctness.replayPassed=false, e=>e.correctness.matchedSeedsPassed=false, e=>e.review.reviewer=e.author, e=>e.review.candidate='other', e=>e.review.runId='other', e=>e.review.operatorApproved=false, e=>e.review.blockingFindings=1, e=>delete e.seed, e=>delete e.artifact];
  for (const mutate of mutations) { const e=receipt(); mutate(e); expect(checkMillionRelease(e).status).toBe('HOLD'); }
  for (const k of Object.keys(receipt().matrix[0].fallbacks)) { const e=receipt(); e.matrix[0].fallbacks[k]=false; expect(checkMillionRelease(e).status).toBe('HOLD'); }
});
test('invalid numeric measurements cannot authorize a claim', () => {
  for(const value of [NaN, Infinity, -1, '1000000', null]) { const e=receipt(); e.counts.updatedAgents=value; expect(checkMillionRelease(e).status).toBe('HOLD'); }
});
test('CLI visibly fails absent evidence', async () => {
  const p=Bun.spawn(['bun','ops/check-million-release.js','/nonexistent/she177.json'], {stdout:'pipe'});
  const output=await new Response(p.stdout).text(); expect(await p.exited).toBe(1); expect(JSON.parse(output).status).toBe('HOLD');
});
