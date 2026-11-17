import { discoverQuests } from './emergent-quests.js';
import { VERSION, validateState } from '../city/contracts.js';
import { addIntervention } from '../city/engine.js';
import { COMMUTE_OPTIONS, advance } from './quests.js';

export const BUILDER_VERSION = 'world-builder.v1';

// Both arms use the exact displayed checkpoint, including its seed and shocks.
// No sample reseeding or hidden scenario reset is permitted here.
export function branchCity({ snapshot, amount = 8, months = 12 } = {}) {
  if (!snapshot?.state || snapshot.state.version !== VERSION) throw new Error('A compatible city checkpoint is required.');
  validateState(snapshot.state);
  if (!Number.isInteger(months) || months < 1 || months > 24) throw new Error('Choose 1–24 months.');
  const option = COMMUTE_OPTIONS.find(row => row.amount === amount);
  if (!option) throw new Error('Choose a supported capacity increase.');
  const districtId = snapshot.participant?.districtId;
  if (!snapshot.state.links.some(link => link.mode === 'transit' && (link.from === districtId || link.to === districtId))) {
    throw new Error('The selected resident needs a district with existing transit links.');
  }
  const parent = structuredClone(snapshot);
  const policy = { type: 'transit', districtId, amount, cost: option.cost };
  function record(state) {
    const timeline = [structuredClone(parent)];
    let quests = structuredClone(parent.quests ?? discoverQuests(parent));
    for (let i = 0; i < months; i++) {
      const next = advance(state, 1, true, quests);
      timeline.push(next);
      state = next.state;
      quests = next.quests;
    }
    return timeline;
  }
  return {
    version: BUILDER_VERSION, modelVersion: VERSION,
    seed: parent.state.seed, startMonth: parent.state.month, months, policy,
    parent, baseline: record(parent.state), intervention: record(addIntervention(parent.state, policy)),
    assumptions: [
      `Proposed cost: ${option.cost} synthetic USD; capacity increase: ${amount}.`,
      'Construction timing, funding, routing and city equations are synthetic, uncalibrated assumptions.',
      'Real-world property values, emissions and resident wellbeing effects are assumptions; they are not measured here.',
    ],
  };
}
