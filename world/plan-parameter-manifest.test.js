import test from "node:test";
import assert from "node:assert/strict";
import { buildPlanManifest } from "./civic-experiment.js";

test("plan manifest preserves explicit parameter edits and additions", () => {
  const manifest = buildPlanManifest({
    id: "pkg_parameterized",
    name: "Parameterized plan",
    parameterEdits: [
      { parameterId: "permitting_delay_months", operation: "set", value: 3 },
    ],
    simulationParameters: [
      { id: "housing_social_share", value: 0.15, min: 0, max: 0.5 },
    ],
    items: [{
      proposal: {
        id: "housing_reform",
        title: "Housing reform",
        parameterEdits: [
          { parameterId: "agency_capacity", operation: "add", value: 0.1 },
        ],
        simulationParameters: [
          { id: "inspection_capacity", value: 0.7, min: 0, max: 1 },
        ],
      },
    }],
  }, {}, new Date("2026-11-02T00:00:00.000Z"));

  assert.equal(manifest.parameterEdits[0].parameterId, "permitting_delay_months");
  assert.equal(manifest.simulationParameters[0].id, "housing_social_share");
  assert.equal(manifest.actions[0].parameterEdits[0].parameterId, "agency_capacity");
  assert.equal(manifest.actions[0].simulationParameters[0].id, "inspection_capacity");
});
