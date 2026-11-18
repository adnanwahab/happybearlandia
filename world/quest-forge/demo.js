import { createCity } from '../city/seed.js';
import { createChallengeEnvelope } from '../challenges/contract.js';
import { forgeQuest } from './model.js';

export const DEMO_VERSION = 'quest-forge-housing-demo.v1';
export async function authoredDemo() {
  const state = createCity({ households: 6, seed: 42 });
  // Toy supply crisis and ample utilities isolate the housing mechanism. These
  // are authored starting assumptions, not observations about a real district.
  for (const parcel of state.parcels) parcel.capacity = 0;
  for (const unit of state.units) { unit.householdId = null; unit.status = 'under construction'; }
  for (const household of state.households) household.unitId = null;
  for (const utility of state.utilities) utility.capacity = 10000;
  state.provenance.datasetVersion = DEMO_VERSION;
  const terms = { initialState: state, budget: 0, metrics: ['unhousedHouseholds'] };
  const checkpoint = await createChallengeEnvelope(terms);
  return forgeQuest({ schemaVersion: 'civic-quest-request.v1', id: 'demo-housing-request', revision: 1,
    sourceKind: 'authored-demo', sourceRef: 'world/quest-forge/demo.js#quest-forge-housing-demo.v1',
    text: 'Authored demo request: test whether two new homes improve housing access in this toy city.',
    concern: 'housing-access', districtId: 'd0', modelVersion: state.version,
    checkpointHash: checkpoint.initialHash }, state);
}
