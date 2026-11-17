import { exportAgentCounts } from './agent-counts.js';

export const RECEIPT_SCHEMA = 'resident-demo-receipt.v1';
const fail = () => { throw new Error('Unsupported or incomplete resident demo receipt'); };
/** Validate a bounded fixture receipt by replay; no aggregate-only reports accepted. */
export function createDemoEvidence(input) {
  const text = JSON.stringify(input);
  if (!text || text.length > 4_000_000) fail();
  const receipt = JSON.parse(text);
  if (receipt.schemaVersion !== RECEIPT_SCHEMA || !receipt.run ||
      !Number.isFinite(receipt.wallSeconds) || receipt.wallSeconds <= 0 ||
      typeof receipt.measuredAt !== 'string' || !Number.isFinite(Date.parse(receipt.measuredAt)) ||
      !receipt.machine || ['cpu','platform','arch','runtime'].some(k => typeof receipt.machine[k] !== 'string' || !receipt.machine[k].trim()) ||
      typeof receipt.command !== 'string' || !receipt.command.trim()) fail();
  const metrics = exportAgentCounts(receipt.run, { wallSeconds: receipt.wallSeconds });
  return {
    schemaVersion: 'resident-demo-evidence.v1', receiptSchema: receipt.schemaVersion,
    measuredAt: receipt.measuredAt, machine: receipt.machine, command: receipt.command,
    ...metrics,
    benchmarkOutcome: 'Bounded CPU fixture completed; event replay matched. Timing and device are receipt-reported.',
    millionResidentOutcome: 'Not demonstrated: this adapter is limited to 4096 records and 1000 ticks.',
    humanReview: 'Pending; no human approval is recorded by this card.',
    summary: `${metrics.counts.residentRecords} explicit synthetic resident records; ${metrics.activeCount} distinct states changed through ${metrics.counts.modeledPairwiseInteractions} validated pair events. Cohort weight 0; drawn resident objects 0 (headless).`,
    measurement: 'Single cold execution including setup and event allocation; replay validation and export excluded.',
    limitations: ['Synthetic energy transfers, not calibrated human behavior or social-science evidence.',
      'No million-scale, GPU, worker, sustained-throughput or full-city rendering measurement.',
      'Replay checks model integrity, not authenticity of the reported machine or elapsed time.'],
    links: { assumptions: 'https://github.com/adnanwahab/happybearlandia/blob/main/docs/agent-counts.md',
      tests: 'https://github.com/adnanwahab/happybearlandia/blob/main/test/agent-counts.test.js', pendingBenchmark: 'https://linear.app/shel-bernstein/issue/SHE-151' },
  };
}
