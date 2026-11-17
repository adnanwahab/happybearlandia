import { test, expect } from 'bun:test';
import { runFixture } from '../world/metrics/agent-counts.js';
import { createDemoEvidence, RECEIPT_SCHEMA } from '../world/metrics/demo-evidence.js';
const receipt = () => ({ schemaVersion: RECEIPT_SCHEMA, run: runFixture({residents:128,ticks:100,seed:42}), wallSeconds:2,
  measuredAt:'2026-11-12T00:00:00Z', machine:{cpu:'test CPU',platform:'test OS',arch:'test',runtime:'test runtime'}, command:'test fixture' });
test('card derives six counts and claims from replayed receipt; no million claim', () => {
  const card = createDemoEvidence(receipt());
  expect(Object.keys(card.counts)).toHaveLength(6);
  expect(card.counts.residentRecords).toBe(128);
  expect(card.counts.modeledPairwiseInteractions).toBe(100);
  expect(card.rates.interactionsPerSecond).toBe(50);
  expect(card.summary).toContain('128 explicit synthetic');
  expect(card.millionResidentOutcome).toContain('Not demonstrated');
  expect(card.humanReview).toContain('Pending');
  expect(card.seed).toBe(42);
  expect(card.machine.cpu).toBe('test CPU');
});
test('untrusted summaries cannot inflate validated evidence', () => {
  const r = receipt(); r.counts = {residentRecords:1e6}; r.humanReview='approved';
  const card = createDemoEvidence(r);
  expect(card.counts.residentRecords).toBe(128);
  expect(card.humanReview).toContain('Pending');
});
test('reject missing, tampered, unsupported and incomplete evidence', () => {
  for (const mutate of [r=>delete r.run, r=>r.run.events.pop(), r=>r.run.final[0].energy++,
    r=>r.run.residents=1e6, r=>r.schemaVersion='unknown',r=>delete r.machine,
    r=>r.wallSeconds=0,r=>r.wallSeconds=Infinity,r=>delete r.command,r=>r.measuredAt='bad']) {
    const r=receipt(); mutate(r); expect(()=>createDemoEvidence(r)).toThrow();
  }
});
test('zero interactions remain zero and seed matched replay stays deterministic', () => {
  const r=receipt();r.run=runFixture({residents:4096,ticks:0,seed:0});
  const card=createDemoEvidence(r);
  expect(card.activeCount).toBe(0); expect(card.counts.modeledPairwiseInteractions).toBe(0);
  expect(createDemoEvidence(JSON.parse(JSON.stringify(r)))).toEqual(card);
});
test('real receipt CLI succeeds and rejects million records without output', () => {
  const good=Bun.spawnSync([process.execPath,'scripts/export-demo-evidence-receipt.js','4096','1000','42']);
  expect(good.exitCode).toBe(0);
  expect(createDemoEvidence(JSON.parse(good.stdout.toString())).counts.residentRecords).toBe(4096);
  const bad=Bun.spawnSync([process.execPath,'scripts/export-demo-evidence-receipt.js','1000000']);
  expect(bad.exitCode).not.toBe(0);expect(bad.stdout.length).toBe(0);
});
