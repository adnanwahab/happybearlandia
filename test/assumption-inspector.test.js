import { describe, expect, test } from "bun:test";
import {
  buildParameterOverrides,
  createInspectorState,
  groupVariables,
  updateInspectorState,
} from "../world/assumption-inspector.js";

const variables = [
  { id: "interest_rate", category: "finance", label: "Interest rate", baseline: 0.05, range: { min: 0.01, max: 0.12 }, locked: false },
  { id: "agency_capacity", category: "government", label: "Agency capacity", baseline: 0.7, range: { min: 0.3, max: 1 }, locked: false },
  { id: "funding_delivery_rate", category: "implementation", label: "Funding", baseline: 0.9, range: { min: 0.45, max: 1 }, locked: false },
];

describe("assumption inspector", () => {
  test("groups variables in a stable human-readable order", () => {
    expect(groupVariables(variables).map((group) => group.category)).toEqual(["implementation", "government", "finance"]);
  });

  test("only emits overrides after a user edit", () => {
    let state = createInspectorState(variables);
    expect(buildParameterOverrides(variables, state)).toEqual({});
    state = updateInspectorState(state, variables[0], { baseline: 0.08, locked: true });
    expect(buildParameterOverrides(variables, state).interest_rate).toMatchObject({ baseline: 0.08, locked: true });
  });

  test("clamps edited baselines to the edited range", () => {
    let state = createInspectorState(variables);
    state = updateInspectorState(state, variables[0], { baseline: 0.2, min: 0.02, max: 0.1 });
    expect(state.interest_rate.baseline).toBe(0.1);
  });
});
