// Authored toy inputs, NOT an engine run or measured observations.
export const COALITION_VERSION = 'council-coalition.v1';
export function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
export const DEMO = freeze({
  id: 'transit-tradeoff.v1', rulesVersion: COALITION_VERSION,
  source: 'authored-synthetic-toy', seed: 2911, month: 12,
  checkpointId: 'transit-tradeoff.v1:paired-inputs',
  title: 'A quicker commute, a higher rent',
  proposal: { id: 'transit-toy', label: 'Transit capacity exercise', cost: 200 },
  baseline: { commuteMinutes: 30, meanRent: 1200, balance: 1000, employed: 50, overloadedServices: 2 },
  intervention: { commuteMinutes: 24, meanRent: 1275, balance: 800, employed: 55, overloadedServices: 2 },
  // Independently authored expected positions detect rule drift on reopen.
  expectedVotes: { commuters: 'support', renters: 'oppose', employers: 'support', services: 'hold', treasury: 'support' },
});
