import { describe, expect, test } from "bun:test";
import { createBuildingProposal, validateBuildingProposal, validateBuildingPlacement, buildingFootprint, SQFT_TO_SQM } from "../world/buildings/proposal.js";

const draft = (overrides = {}) => createBuildingProposal({ id: "tower", ...overrides });
describe("building proposal and placement", () => {
  test("factory preserves drafts and nested controls without implicit approval", () => {
    const proposal = draft({ program: { residentialUnits: 400 } });
    expect(proposal.status).toBe("proposed");
    expect(proposal.program.affordableUnits).toBe(90);
    expect(validateBuildingProposal(proposal).valid).toBe(true);
    expect(validateBuildingProposal(draft({ status: "approved" })).valid).toBe(true);
  });
  test("rejects impossible quantities, invalid coordinates, and unknown fields", () => {
    for (const overrides of [{ geometry: { floors: 0 } }, { location: { x: NaN } }, { finance: { publicSubsidy: 100000000 } },
      { program: { affordableUnits: 1000 } }, { program: { residentialUnits: 0, affordableUnits: 0, retailSqFt: 0, officeSqFt: 0 } },
      { geometry: { floors: 100, heightMeters: 20 } }, { geometry: { footprintSqFt: 100 } }, { status: "secretly-approved" }, { name: "" }, { arbitraryCode: "eval" }]) {
      expect(validateBuildingProposal(draft(overrides)).valid).toBe(false);
    }
  });
  test("square sqft footprints become rotated meter polygons, overlap uses area not centers", () => {
    const proposal = draft({ location: { x: 0, z: 0, rotation: Math.PI / 4 } });
    const footprint = buildingFootprint(proposal);
    const area = Math.abs(footprint.reduce((sum, point, index) => {
      const next = footprint[(index + 1) % footprint.length]; return sum + point.x * next.z - next.x * point.z;
    }, 0)) / 2;
    expect(area).toBeCloseTo(proposal.geometry.footprintSqFt * SQFT_TO_SQM, 6);
    const bounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
    expect(validateBuildingPlacement(proposal, { bounds }).valid).toBe(true);
    // Center is outside the proposed building; its edge still crosses the tower.
    const buildings = [{ id: "long-existing", polygon: [{ x: 20, z: -1 }, { x: 60, z: -1 }, { x: 60, z: 1 }, { x: 20, z: 1 }] }];
    expect(validateBuildingPlacement(proposal, { buildings, bounds }).valid).toBe(false);
    expect(validateBuildingPlacement(proposal, { bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 } }).valid).toBe(false);
  });
  test("native town poly footprints and containing polygons are checked", () => {
    const proposal = draft({ location: { x: 0, z: 0, districtId: "downtown" } });
    const poly = [[-30, -30], [30, -30], [30, 30], [-30, 30]];
    expect(validateBuildingPlacement(proposal, { buildings: [{ id: "native-town", poly }] }).valid).toBe(false);
    expect(validateBuildingPlacement(proposal, { districts: [{ id: "downtown", polygon: poly }] }).valid).toBe(true);
    expect(validateBuildingPlacement(proposal, { districts: [{ id: "elsewhere", polygon: poly }] }).valid).toBe(false);
    const concave = [[-40, -40], [40, -40], [40, 40], [5, 40], [5, 10], [-5, 10], [-5, 40], [-40, 40]];
    expect(validateBuildingPlacement(proposal, { districts: [{ id: "downtown", polygon: concave }] }).valid).toBe(false);
  });
});
