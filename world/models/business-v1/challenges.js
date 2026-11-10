import { createDefinition } from './content.js';
import { copy, requireApproved } from './schema.js';

export const CHALLENGE_VERSION = 1;
const catalog = [
  { id: 'first-profit', name: 'First taste of profit', description: 'Turn a small lemonade stand into a profitable first business.', scale: 'day', horizon: 10, seed: 42, timing: 'anytime', difficulty: 'Starter', archetype: 'local-retail', overrides: { name: 'Little Lemon Challenge' }, goals: [{ metric: 'totalProfit', label: 'Cumulative net profit', target: 100, unit: 'money' }] },
  { id: 'summer-stand', name: 'The $1,000 summer', description: 'Earn your way through changing weather, stockouts and spoilage at a busy stand.', scale: 'day', horizon: 30, seed: 137, timing: 'anytime', difficulty: 'Growing', archetype: 'local-retail', overrides: { name: 'Summer Lemon Stand', baseTraffic: 420 }, goals: [{ metric: 'totalProfit', label: 'Cumulative net profit', target: 1000, unit: 'money' }] },
  { id: 'subscriber-launch', name: 'Find your first 500', description: 'Grow support capacity to win and retain 500 active subscribers in six months.', scale: 'month', horizon: 6, seed: 73, timing: 'anytime', difficulty: 'Growing', archetype: 'subscription', overrides: { name: 'Indie Accounts', description: 'Accounting software for independent businesses.' }, goals: [{ metric: 'customers', label: 'Active subscribers', target: 500, unit: 'count' }] },
  { id: 'weather-the-year', name: 'Weather the first year', description: 'Finish a full trading year with positive cash and at least $10,000 in cumulative profit.', scale: 'month', horizon: 12, seed: 209, timing: 'deadline', difficulty: 'Endurance', archetype: 'physical-product', overrides: { name: 'Year One Drinks' }, goals: [{ metric: 'totalProfit', label: 'Cumulative net profit', target: 10000, unit: 'money' }] },
];
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const BUSINESS_CHALLENGES = freeze(catalog);
export const getBusinessChallenge = id => BUSINESS_CHALLENGES.find(c => c.id === id) || null;
export function challengeDefinition(id) {
  const c = getBusinessChallenge(id);
  if (!c) throw new Error('Choose an available business challenge.');
  return createDefinition(c.archetype, copy(c.overrides));
}
// Ignore display names and revision numbers; all economic assumptions must match.
const economicDefinition = definition => {
  const ignored = new Set(['name', 'description', 'id', 'approved', 'version']);
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  return JSON.stringify(canonical(Object.fromEntries(Object.entries(definition || {}).filter(([key]) => !ignored.has(key)))));
};
function practiceReason(state, challenge) {
  if (state.seed !== challenge.seed) return 'This timeline uses a different seed.';
  if (state.scale !== challenge.scale) return 'This timeline uses a different period length.';
  if (economicDefinition(state.def) !== economicDefinition(challengeDefinition(challenge.id))) return 'The starting business assumptions were changed.';
  return null;
}
export function beginBusinessChallenge(state, id) {
  const c = getBusinessChallenge(id);
  if (!c) throw new Error('Choose an available business challenge.');
  requireApproved(state.def);
  if (state.scale !== c.scale || state.def.archetype !== c.archetype) throw new Error('Keep the challenge archetype and period length, or start a sandbox company.');
  if (state.period !== 0 || state.totalProfit !== 0 || state.totalRevenue !== 0 || state.totalSales !== 0 || state.debt !== 0 || state.cash !== state.def.startingCash || state.inventory !== 0 || state.customers !== 0 || state.financing?.length) throw new Error('Challenges start with a fresh company.');
  const next = copy(state), reason = practiceReason(next, c);
  next.challenge = { schemaVersion: 'business-challenge.v1', version: CHALLENGE_VERSION, id, official: !reason, practiceReason: reason, status: 'active', result: null };
  return next;
}
function currentChallenge(state) {
  const entry = state?.challenge;
  if (entry?.schemaVersion !== 'business-challenge.v1' || entry.version !== CHALLENGE_VERSION || !['active','completed','failed'].includes(entry.status)) return null;
  return getBusinessChallenge(entry.id);
}
/** Called only after a resolved trading period (or to invalidate an edited branch).
 * No rewards or extra economy; loans and investment never increase the profit goal.
 */
export function advanceBusinessChallenge(state) {
  const c = currentChallenge(state);
  if (!c) return state;
  const record = { ...state.challenge };
  const reason = practiceReason(state, c);
  if (reason && record.official) { record.official = false; record.practiceReason = reason; }
  if (record.status !== 'active') return { ...state, challenge: record };
  const healthy = !state.bankrupt && state.cash > 0;
  const goalsMet = c.goals.every(goal => Number.isFinite(state[goal.metric]) && state[goal.metric] >= goal.target);
  const withinDeadline = Number.isInteger(state.period) && state.period > 0 && state.period <= c.horizon;
  if (healthy && goalsMet && withinDeadline && (c.timing === 'anytime' || state.period === c.horizon)) record.status = 'completed';
  else if (state.bankrupt || state.period >= c.horizon) record.status = 'failed';
  if (record.status !== 'active') {
    record.result = { period: state.period, profit: state.totalProfit, cash: state.cash, revenue: state.totalRevenue, customers: state.customers, reputation: state.reputation, seed: state.seed,
      reason: record.status === 'completed' ? 'Objective achieved with positive cash.' : state.bankrupt ? 'The company went bankrupt before completing its objective.' : state.cash <= 0 ? 'The deadline arrived without positive cash.' : 'The deadline arrived before the objective was met.' };
  }
  return { ...state, challenge: record };
}
export function businessChallengeProgress(state) {
  const challenge = currentChallenge(state);
  if (!challenge) return null;
  const entry = state.challenge;
  const elapsed = entry.result?.period ?? state.period;
  const metricValue = metric => entry.result ? entry.result[metric === 'totalProfit' ? 'profit' : metric] : state[metric];
  return { ...challenge, status: entry.status, official: entry.official === true, practiceReason: entry.practiceReason, result: entry.result,
    elapsed: Math.min(challenge.horizon, Math.max(0, elapsed)), remaining: Math.max(0, challenge.horizon - elapsed),
    goals: challenge.goals.map(goal => ({ ...goal, value: Number.isFinite(metricValue(goal.metric)) ? metricValue(goal.metric) : 0,
      fraction: Math.min(1, Math.max(0, (metricValue(goal.metric) || 0) / goal.target)) })) };
}
/** Browser personal bests only. Projections cannot affect records in the active save. */
export function recordBusinessChallengeBest(records, state) {
  const c = currentChallenge(state), entry = state?.challenge;
  if (!c || entry.status !== 'completed' || entry.official !== true || !entry.result || practiceReason(state, c)) return records;
  const result = entry.result;
  if (!Number.isInteger(result.period) || result.period < 1 || result.period > c.horizon || !Number.isFinite(result.profit) || !Number.isFinite(result.cash) || result.cash <= 0 || result.seed !== c.seed) return records;
  if (!c.goals.every(goal => result[goal.metric === 'totalProfit' ? 'profit' : goal.metric] >= goal.target)) return records;
  const next = { ...(records && typeof records === 'object' && !Array.isArray(records) ? records : {}) };
  const previous = next[c.id];
  const comparable = previous?.version === CHALLENGE_VERSION && previous?.seed === c.seed && Number.isInteger(previous.period) && previous.period > 0 && previous.period <= c.horizon && Number.isFinite(previous.profit);
  if (comparable && (previous.period < result.period || (previous.period === result.period && previous.profit >= result.profit))) return records;
  next[c.id] = { version: CHALLENGE_VERSION, seed: c.seed, ...copy(result) };
  return next;
}
