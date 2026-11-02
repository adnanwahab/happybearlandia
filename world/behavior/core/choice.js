import { stableSoftmax } from './utility.js';

/** Caller supplies the counter-based random draw; this module never creates entropy. */
export function seededChoice(alternatives, { draw, temperature = 1 } = {}) {
  if (!Array.isArray(alternatives) || alternatives.length > 2048) throw new TypeError('Use a bounded consideration set.');
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new TypeError('A seeded draw in [0, 1) is required.');
  const ids = new Set();
  const rows = alternatives.map(alternative => {
    if (!alternative || typeof alternative.id !== 'string' || !alternative.id || ids.has(alternative.id)) throw new TypeError('Alternatives need unique string IDs.');
    ids.add(alternative.id);
    const available = alternative.available !== false && alternative.eligible !== false;
    const utility = alternative.utility ?? alternative.score;
    if (available && !Number.isFinite(utility)) throw new TypeError('Feasible utilities must be finite.');
    return { ...alternative, available, ...(available ? { utility } : {}), probability: 0 };
  });
  const feasible = rows.filter(row => row.available);
  const probabilities = stableSoftmax(feasible.map(row => row.utility), temperature);
  let cumulative = 0, chosen = null;
  for (let index = 0; index < feasible.length; index++) {
    feasible[index].probability = probabilities[index];
    cumulative += probabilities[index];
    if (!chosen && draw < cumulative) chosen = feasible[index];
  }
  chosen ||= feasible.at(-1) || null;
  return { chosen: chosen?.id ?? null, alternatives: rows, randomDraw: draw, temperature };
}
