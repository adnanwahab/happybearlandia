/** Bounded synthetic CPU reference contract. No production adapter is implied. */
export const MODEL = 'synthetic-energy-transfer.v1';
export const RULES = 'unit-transfer.v1';
export const SOURCE = 'synthetic-initial-energy.v1';
export const LIMITS = Object.freeze({ residents: 4096, ticks: 1000 });
const integer = (n, name, max = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new Error(`Invalid ${name}`);
  return n;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function runFixture({ residents = 128, ticks = 100, seed = 42 } = {}) {
  integer(residents, 'residents', LIMITS.residents);
  integer(ticks, 'ticks', LIMITS.ticks);
  integer(seed, 'seed', 0xffffffff);
  let random = seed;
  const next = () => (random = (Math.imul(random, 1664525) + 1013904223) >>> 0);
  const initial = Array.from({ length: residents }, (_, id) => ({ id, energy: 10, source: SOURCE }));
  const state = initial.map(row => ({ ...row }));
  const events = [];
  for (let tick = 0; tick < ticks; tick++) {
    if (residents < 2) continue;
    const from = next() % residents;
    const to = (from + 1 + next() % (residents - 1)) % residents;
    if (state[from].energy === 0) continue;
    const before = [state[from].energy, state[to].energy];
    state[from].energy--; state[to].energy++;
    events.push({ id: events.length, tick, from, to, source: SOURCE, rules: RULES,
      before, after: [state[from].energy, state[to].energy] });
  }
  return { model: MODEL, rules: RULES, seed, residents, ticks, initial, events, final: state };
}

/** Replay from identified source records; never trust caller-supplied event totals. */
export function validateRun(run) {
  if (!run || run.model !== MODEL || run.rules !== RULES) throw new Error('Unsupported model/rules');
  integer(run.residents, 'residents', LIMITS.residents);
  integer(run.ticks, 'ticks', LIMITS.ticks);
  integer(run.seed, 'seed', 0xffffffff);
  const expected = runFixture({ residents: run.residents, ticks: run.ticks, seed: run.seed });
  if (!same(run.initial, expected.initial)) throw new Error('Missing or invalid source-backed initial state');
  if (!Array.isArray(run.events)) throw new Error('Missing interaction evidence');
  const state = run.initial.map(row => ({ ...row }));
  let lastTick = -1;
  for (const [id, event] of run.events.entries()) {
    const { from, to, tick, before, after } = event;
    integer(tick, 'event tick'); integer(from, 'from'); integer(to, 'to');
    if (event.id !== id || tick <= lastTick || tick >= run.ticks || from === to ||
        !state[from] || !state[to] || event.source !== SOURCE || event.rules !== RULES)
      throw new Error('Invalid event provenance/order');
    if (!same(before, [state[from].energy, state[to].energy]) || before[0] < 1 ||
        !same(after, [before[0] - 1, before[1] + 1])) throw new Error('Invalid state-changing rule');
    state[from].energy = after[0]; state[to].energy = after[1]; lastTick = tick;
  }
  if (!same(state, run.final)) throw new Error('Final state does not match replay');
  if (!same(run.events, expected.events)) throw new Error('Seed-matched event evidence mismatch');
  return state;
}

export function exportAgentCounts(run, { wallSeconds, visibleAvatars = 0, aggregateCohortWeight = 0,
  renderedFrames = null, renderWallSeconds = null } = {}) {
  validateRun(run);
  if (!Number.isFinite(wallSeconds) || wallSeconds < 0) throw new Error('Invalid wall duration');
  integer(visibleAvatars, 'visible avatars');
  if (!Number.isFinite(aggregateCohortWeight) || aggregateCohortWeight < 0) throw new Error('Invalid cohort weight');
  // This adapter is headless: a nonzero rendering claim needs another adapter.
  if (visibleAvatars !== 0 || renderedFrames !== null || renderWallSeconds !== null)
    throw new Error('Headless adapter has no rendering evidence');
  const active = new Set(run.events.flatMap(event => [event.from, event.to])).size;
  const rate = count => {
    if (wallSeconds === 0) return null;
    const value = count / wallSeconds;
    if (!Number.isFinite(value)) throw new Error('Wall duration produces nonfinite throughput');
    return value;
  };
  return {
    schemaVersion: 'agent-counts.v1', model: run.model, rules: run.rules, seed: run.seed,
    source: SOURCE, adapter: 'bounded-cpu-reference.v1', adapterLimits: LIMITS,
    counts: { residentRecords: run.residents,
      independentlyUpdatedStates: active, eventDrivenUpdates: run.events.length * 2,
      modeledPairwiseInteractions: run.events.length, visibleAvatars, aggregateCohortWeight },
    activeCount: active, completedTicks: run.ticks, wallSeconds,
    rates: { interactionsPerSecond: rate(run.events.length), simulationTicksPerSecond: rate(run.ticks), renderFPS: null },
    evidence: { validated: true, transitionEvents: run.events.length, provenance: 'synthetic/un-calibrated' },
  };
}

/** A headline is derived from validated evidence, never from avatars or weights. */
export function interactionClaim(run) {
  validateRun(run);
  return run.events.length >= 1_000_000 ? '1M simulated interactions' : `${run.events.length} verified synthetic pairwise interactions`;
}
