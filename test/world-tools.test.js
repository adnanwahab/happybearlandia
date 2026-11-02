import { test, expect } from 'bun:test';
import { findSuggestedBuildingLocation } from '../world/decision/world-tools.js';
import { createBuildingProposal, validateBuildingPlacement } from '../world/buildings/proposal.js';

test('suggested parcel avoids real footprints without changing the proposal or context', () => {
  const proposal = createBuildingProposal({ location: { x: 0, z: 0 } });
  const context = { bounds: { minX: -600, maxX: 600, minZ: -600, maxZ: 600 }, buildings: [{ id: 'center', x: 0, z: 0, width: 100, depth: 100 }] };
  const original = JSON.stringify({ proposal, context });
  const location = findSuggestedBuildingLocation(context, proposal);
  expect(location).not.toBeNull();
  expect([location.x, location.z]).not.toEqual([0, 0]);
  expect(validateBuildingPlacement({ ...proposal, location }, context).valid).toBe(true);
  expect(JSON.stringify({ proposal, context })).toBe(original);
  expect(proposal.status).toBe('proposed');
});

test('suggestion respects optional district boundaries and reports no feasible parcel honestly', () => {
  const context = { bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, districts: [{ id: 'district', polygon: [{ x: -80, z: -80 }, { x: 80, z: -80 }, { x: 80, z: 80 }, { x: -80, z: 80 }] }] };
  const proposal = createBuildingProposal();
  const location = findSuggestedBuildingLocation(context, proposal);
  expect(location?.districtId).toBe('district');
  expect(validateBuildingPlacement({ ...proposal, location }, context).valid).toBe(true);
  expect(findSuggestedBuildingLocation({ bounds: { minX: 0, maxX: 1, minZ: 0, maxZ: 1 } }, proposal)).toBeNull();
});
