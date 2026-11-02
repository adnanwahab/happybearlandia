import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProposalIds, planConstitutionVisuals } from "./constitution-visuals.js";

test("constitution visuals recognize drainage plans and focus the same town area", () => {
  const town = {
    buildings: [
      { center: [-100, -80], poly: [[-120,-100],[-80,-100],[-80,-60],[-120,-60]] },
      { center: [120, 90], poly: [[100,70],[140,70],[140,110],[100,110]] },
    ],
    roads: [{ pts: [[-150, 0], [150, 0]] }],
  };
  const layout = planConstitutionVisuals({ town, proposalIds: ["f_drainage"], focusHint: "drainage" });
  assert.equal(layout.features.drainage, true);
  assert.equal(layout.features.transit, false);
  assert.equal(layout.focusKind, "drainage");
  assert.ok(Number.isFinite(layout.focus.x));
  assert.ok(Number.isFinite(layout.focus.z));
});

test("proposal ids normalize and deduplicate query input", () => {
  assert.deepEqual(normalizeProposalIds("f_drainage,t_brt,f_drainage"), ["f_drainage", "t_brt"]);
});
