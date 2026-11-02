import test from "node:test";
import assert from "node:assert/strict";
import { applyPlanParameterPatch, compilePlanParameterPatch } from "./plan-parameter-patch.js";

function variable(id, baseline, min, max, extra = {}) {
  return { id, label: id, category: "test", unit: "index", baseline, range: { min, max }, locked: false, ...extra };
}

function experiment(plan = {}, variables = []) {
  return {
    id: "exp_test",
    schemaVersion: "civic-experiment.v1",
    plan: { id: "plan_test", title: "Test", actions: [], ...plan },
    worldModel: { variables, parameterExtraction: { variableCount: variables.length, categories: { test: variables.length } } },
    lineage: { revision: 1 },
  };
}

test("heuristic plan language proposes edits to existing slider parameters", () => {
  const input = experiment({
    summary: "Streamline permitting with expedited approvals and make a major transit investment.",
  }, [
    variable("permitting_delay_months", 8, 1, 36, { unit: "months" }),
    variable("infrastructure_capacity", 0.7, 0.25, 1),
  ]);
  const patch = compilePlanParameterPatch(input);
  const permit = patch.edits.find((row) => row.parameterId === "permitting_delay_months");
  const infra = patch.edits.find((row) => row.parameterId === "infrastructure_capacity");
  assert.ok(permit.to < permit.from);
  assert.ok(infra.to > infra.from);
  assert.equal(patch.summary.heuristicEditCount, 2);
});

test("explicit plan edits take precedence over heuristic mapping", () => {
  const input = experiment({
    summary: "Streamline permitting.",
    parameterEdits: [{ parameterId: "permitting_delay_months", operation: "set", value: 3, reason: "Statutory 90-day target." }],
  }, [variable("permitting_delay_months", 8, 1, 36)]);
  const patch = compilePlanParameterPatch(input);
  assert.equal(patch.edits.length, 1);
  assert.equal(patch.edits[0].to, 3);
  assert.equal(patch.edits[0].source, "explicit-plan-parameter");
});

test("unknown explicit parameters become visible unconnected additions", () => {
  const input = experiment({
    simulationParameters: [{ id: "housing_social_share", label: "Social housing share", value: 0.15, min: 0, max: 0.5, unit: "fraction" }],
  }, []);
  const patch = compilePlanParameterPatch(input);
  assert.equal(patch.additions.length, 1);
  assert.equal(patch.additions[0].parameterId, "housing_social_share");
  assert.equal(patch.additions[0].connected, false);
  assert.equal(patch.additions[0].variable.range.max, 0.5);
});

test("apply uses the same override shape as manual slider edits and is idempotent", () => {
  const input = experiment({
    parameterEdits: [{ parameterId: "agency_capacity", operation: "add", value: 0.1 }],
    simulationParameters: [{ id: "new_lever", value: 0.4, min: 0, max: 1 }],
  }, [variable("agency_capacity", 0.7, 0.3, 1)]);
  const patch = compilePlanParameterPatch(input);
  const first = applyPlanParameterPatch(input, patch, {}, new Date("2026-11-02T00:00:00.000Z"));
  assert.equal(first.applied, true);
  assert.ok(Math.abs(first.overrides.agency_capacity.baseline - 0.8) < 1e-12);
  assert.equal(first.overrides.new_lever.baseline, 0.4);
  assert.ok(first.experiment.worldModel.variables.some((row) => row.id === "new_lever"));
  assert.equal(first.experiment.lineage.parameterPatches[0].sourceFingerprint, patch.sourceFingerprint);

  const secondPatch = compilePlanParameterPatch(first.experiment, first.overrides);
  assert.equal(secondPatch.alreadyApplied, true);
  const second = applyPlanParameterPatch(first.experiment, secondPatch, first.overrides);
  assert.equal(second.applied, false);
  assert.ok(Math.abs(second.overrides.agency_capacity.baseline - 0.8) < 1e-12);
});
