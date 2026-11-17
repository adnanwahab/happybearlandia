import { createHash } from 'node:crypto';
import { householdMembers } from '../population/household-members.js';

export const MODEL = 'scalar-agent-oracle.v1';
export const RULES = 'integer-household-walk.v1';
export const SOURCE = 'synthetic-households.v1';
export const LIMITS = Object.freeze({ agents: 10000, ticks: 32, householdSize: 4, grid: 16, resource: 100 });
const integer = (value, name, max) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw Error(`Invalid ${name}`);
  return value;
};
export function normalizeInput(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid input');
  for (const key of Object.keys(input)) {
    if (!['agents', 'ticks', 'seed', 'stayHomeBps'].includes(key)) throw Error(`Unknown input ${key}`);
    if (input[key] === null) throw Error(`Invalid ${key}`);
  }
  return {
    agents: integer(input.agents ?? 1000, 'agents', LIMITS.agents),
    ticks: integer(input.ticks ?? 12, 'ticks', LIMITS.ticks),
    seed: integer(input.seed ?? 42, 'seed', 0xffffffff),
    stayHomeBps: integer(input.stayHomeBps ?? 2500, 'stayHomeBps', 10000),
  };
}
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Immutable IDs and contiguous households; one cell and one energy token are integer units. */
export function assertState(state, input) {
  const config = normalizeInput(input);
  if (!Array.isArray(state) || state.length !== config.agents) throw Error('Population conservation');
  Array.from(state).forEach((row, id) => {
    if (!row || row.id !== id || row.household !== Math.floor(id / 4)) throw Error('Invalid household membership');
    integer(row.x, 'x', LIMITS.grid - 1); integer(row.y, 'y', LIMITS.grid - 1);
    integer(row.resource, 'resource', LIMITS.resource);
  });
  return true;
}

export function runOracle(input = {}) {
  const config = normalizeInput(input);
  let random = config.seed;
  // LCG uint32, also used by the existing bounded energy-transfer fixture. Zero is valid.
  const next = () => (random = (Math.imul(random, 1664525) + 1013904223) >>> 0);
  const home = id => ({ x: Math.floor(id / 4) % 16, y: Math.floor(Math.floor(id / 4) / 16) % 16 });
  const initial = Array.from({ length: config.agents }, (_, id) => ({ id, household: Math.floor(id / 4), ...home(id), resource: 50 }));
  const state = initial.map(row => ({ ...row }));
  const households = { size: [], start: [] };
  for (let start = 0; start < state.length; start += 4) { households.start.push(start); households.size.push(Math.min(4, state.length - start)); }
  const membership = { households };
  const events = [];
  const emit = event => { const id = events.length; events.push({ id, source: SOURCE, rules: RULES, ...event }); return id; };
  assertState(state, config);
  for (let tick = 0; tick < config.ticks; tick++) {
    const decisions = [];
    for (const row of state) {
      // Always consume two draws per actor/tick, including constrained and policy-blocked actors.
      const draw = next() % 10000, direction = next() >>> 30;
      const before = [row.x, row.y, row.resource];
      const stay = draw < config.stayHomeBps || row.resource === 0;
      if (stay) row.resource = Math.min(100, row.resource + 2);
      else {
        row.x = (row.x + [1, 0, -1, 0][direction] + 16) % 16;
        row.y = (row.y + [0, 1, 0, -1][direction] + 16) % 16;
        row.resource--;
      }
      decisions[row.id] = emit({ tick, phase: 'decision', actor: row.id, parents: [], draw, direction,
        action: stay ? 'rest' : 'walk', before, after: [row.x, row.y, row.resource] });
    }
    for (let h = 0; h < households.size.length; h++) {
      const members = householdMembers(membership, h);
      // Adjacent pairs only, at their shared home; ordered transfers can feed a later pair.
      for (let k = 1; k < members.length; k++) {
        const a = state[members[k - 1]], b = state[members[k]], position = home(a.id);
        if (a.x !== position.x || a.y !== position.y || b.x !== position.x || b.y !== position.y) continue;
        const before = [a.resource, b.resource];
        const transfer = a.resource > 0 && b.resource < 100 ? 1 : 0;
        a.resource -= transfer; b.resource += transfer;
        const id = emit({ tick, phase: 'contact', actors: [a.id, b.id], household: h,
          parents: [decisions[a.id], decisions[b.id]], before, after: [a.resource, b.resource] });
        decisions[a.id] = id; decisions[b.id] = id;
      }
    }
    assertState(state, config);
  }
  const identity = { model: MODEL, rules: RULES, source: SOURCE, input: config };
  return { ...identity, initial, events, final: state,
    stateHash: hash({ ...identity, initial, final: state }), eventHash: hash({ ...identity, events }),
    invariants: { population: state.length, households: households.size.length, resourceMin: state.length ? Math.min(...state.map(r => r.resource)) : null,
      resourceMax: state.length ? Math.max(...state.map(r => r.resource)) : null, checkedTicks: config.ticks, events: events.length } };
}

/** Recompute from the recipe, checking all source records and transitions, including omissions. */
export function validateRun(run) {
  if (!run || run.model !== MODEL || run.rules !== RULES || run.source !== SOURCE) throw Error('Unsupported model/rules/source');
  assertState(run.initial, run.input); assertState(run.final, run.input);
  if (!Array.isArray(run.events)) throw Error('Missing causal evidence');
  let lastTick = -1;
  run.events.forEach((event, id) => {
    integer(event.tick, 'event tick', run.input.ticks - 1);
    if (event.id !== id || event.tick < lastTick || !Array.isArray(event.parents) ||
      event.parents.some(parent => !Number.isInteger(parent) || parent < 0 || parent >= id || run.events[parent].tick !== event.tick)) throw Error('Invalid causal order');
    lastTick = event.tick;
  });
  const expected = runOracle(run.input);
  if (JSON.stringify(run) !== JSON.stringify(expected)) throw Error('Seed-matched replay mismatch');
  return expected.final;
}
