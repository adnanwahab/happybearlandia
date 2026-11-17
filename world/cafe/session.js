import { createDefinition } from '../models/business-v1/content.js';
import { approveDefinition, copy } from '../models/business-v1/schema.js';
import { createBusinessState, defaultPlan, simulatePeriod } from '../models/business-v1/index.js';

export const CAFE = Object.freeze({ id: 'weekend-cafe.v1', model: 'business-v1', modelVersion: '1.0.0', rulesVersion: 1, seed: 42, horizon: 2 });
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export function startCafe(source = CAFE) {
  if (!source || JSON.stringify(source) !== JSON.stringify(CAFE)) throw new Error('Pinned café source unavailable or incompatible. No results generated.');
  const def = approveDefinition(createDefinition('local-retail', { id: CAFE.id, name: 'Weekend Pop-up Café', description: 'Authored synthetic toy café; two daily periods, no measured market observations.' }));
  return freeze({ source: copy(CAFE), checkpoints: [createBusinessState(def, CAFE.seed)], decisions: [], receipts: [], status: 'active' });
}
export function tradeCafe(session, decision) {
  if (session.status !== 'active') throw new Error('Start a fresh weekend to trade again.');
  if (!decision || Object.keys(decision).sort().join() !== 'price,staff,stock' || !Number.isInteger(decision.stock) || decision.stock < 0 || decision.stock > 180 || !Number.isInteger(decision.staff) || decision.staff < 1 || decision.staff > 3 || !Number.isFinite(decision.price) || decision.price < .5 || decision.price > 4) throw new Error('Choose stock 0–180, price $0.50–$4 and 1–3 staff. Hours are unsupported.');
  const parent = session.checkpoints.at(-1);
  const plan = { ...defaultPlan(parent.def), production: decision.stock, price: decision.price, staff: decision.staff };
  const result = simulatePeriod(parent, plan, { trace: false });
  const receipts = [...session.receipts, result.report];
  const finished = receipts.length === CAFE.horizon || result.state.bankrupt;
  return freeze({ source: copy(session.source), checkpoints: [...session.checkpoints, result.state], decisions: [...session.decisions, copy(decision)], receipts, status: finished ? result.state.totalProfit > 0 && result.state.cash > 0 && !result.state.bankrupt ? 'success' : 'failure' : 'active' });
}
export function cancelCafe(session) { return freeze({ ...session, status: 'cancelled' }); }
export function verifyCafe(record) {
  try {
    if (!record?.source) throw Error('Missing source');
    let replay = startCafe(record.source);
    if (!Array.isArray(record.decisions) || record.decisions.length > 2) throw Error();
    for (const decision of record.decisions) replay = tradeCafe(replay, decision);
    if (record.status === 'cancelled') replay = cancelCafe(replay);
    if (JSON.stringify(replay) !== JSON.stringify(record)) throw Error();
    return { status: 'verified', session: replay };
  } catch { return { status: 'mismatch', message: 'Replay mismatch or missing source. Recorded results are unavailable; start a fresh pinned demo.' }; }
}
