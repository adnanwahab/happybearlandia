import test from "node:test";
import assert from "node:assert/strict";
import { handlePlanParameterPatch } from "./plan-parameter-api.js";

const experiment = {
  id: "exp_api",
  plan: {
    id: "plan_api",
    summary: "Streamline permitting with expedited approvals.",
    actions: [],
  },
  worldModel: {
    variables: [{
      id: "permitting_delay_months",
      label: "Permitting delay",
      category: "government",
      unit: "months",
      baseline: 8,
      range: { min: 1, max: 36 },
    }],
  },
  lineage: {},
};

test("parameter patch API compiles a plan against current overrides", async () => {
  const request = new Request("http://localhost/api/world/parameter-patch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ civicExperiment: experiment, parameterOverrides: { permitting_delay_months: { baseline: 10 } } }),
  });
  const response = await handlePlanParameterPatch(request);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.patch.schemaVersion, "hbl-parameter-patch.v1");
  assert.equal(body.patch.edits[0].from, 10);
  assert.ok(body.patch.edits[0].to < 10);
});

test("parameter patch API rejects incomplete experiments", async () => {
  const request = new Request("http://localhost/api/world/parameter-patch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ experiment: { plan: {} } }),
  });
  const response = await handlePlanParameterPatch(request);
  assert.equal(response.status, 400);
});
