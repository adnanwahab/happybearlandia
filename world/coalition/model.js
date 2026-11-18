import { evaluateLivingCouncil } from '../living-city/council.js';
import { COALITION_VERSION, DEMO, freeze } from './scenario.js';

export const RULE = 'Three of five seats must support within your bloc. Oppose and abstain never count as support; the denominator stays five. Moving a card never persuades it.';
const unavailable = status => ({ status, winning: null, positions: [], support: null });

// v1 accepts only the pinned source. No mapping to World residents is implied.
export function openDecision(source) {
  if (!source) return unavailable('no-source');
  if (JSON.stringify(source) !== JSON.stringify(DEMO) || source.rulesVersion !== COALITION_VERSION) return unavailable('replay-mismatch');
  const checkpoint = freeze(structuredClone(source));
  const council = evaluateLivingCouncil({ before: checkpoint.baseline, after: checkpoint.intervention, proposal: checkpoint.proposal });
  if (council.positions.some(p => p.current.vote !== checkpoint.expectedVotes[p.id])) return unavailable('replay-mismatch');
  return freeze({ status: 'ready', checkpoint, selected: [], positions: council.positions });
}

export function moveCard(decision, id, included) {
  if (decision.status !== 'ready' || !decision.positions.some(p => p.id === id)) return decision;
  const selected = new Set(decision.selected);
  if (included) selected.add(id); else selected.delete(id);
  return freeze({ ...decision, selected: decision.positions.filter(p => selected.has(p.id)).map(p => p.id) });
}

export function result(decision) {
  if (decision.status !== 'ready') return unavailable(decision.status);
  const members = decision.positions.filter(p => decision.selected.includes(p.id));
  const count = vote => members.filter(p => p.current.vote === vote).length;
  const support = count('support');
  return { status: 'ready', winning: support >= 3, support, oppose: count('oppose'), abstain: count('hold'), seats: 5, threshold: 3 };
}

export function cancelDecision() { return freeze(unavailable('cancelled')); }
