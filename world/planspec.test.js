import { describe, expect, test } from "bun:test";
import { compilePlan, planEffectsForYear, planForYear, validatePlan } from "./planspec.js";

const dcPackage = {
  id: "A",
  name: "Balanced",
  items: [
    { proposal: { id: "t_bus", title: "High-frequency bus grants", costB: 4.1 } },
    { proposal: { id: "f_drainage", title: "Bayou drainage", costB: 2 } },
    { proposal: { id: "hc_chc", title: "Community health centers", costB: 6 } },
  ],
};

describe("compilePlan", () => {
  test("compiles a Dear Congress package and flags what the sim can't run", () => {
    const spec = compilePlan(dcPackage);
    expect(spec.kind).toBe("planspec");
    expect(spec.planId).toBe("dc-a");
    expect(spec.label).toBe("Balanced");
    expect(spec.actions.map((a) => a.proposalId)).toEqual(["t_bus", "f_drainage", "hc_chc"]);
    expect(spec.actions.find((a) => a.proposalId === "t_bus").rule).toBe("t_bus");
    expect(spec.unsupported).toEqual(["hc_chc"]);
    expect(spec.totalCostB).toBeCloseTo(12.1, 6);
    expect(spec.actions.every((a) => a.startYear === 1)).toBe(true);
  });

  test("compiles a bare id list and dedupes", () => {
    const spec = compilePlan({ proposalIds: ["s_311", "s_311", "g_delivery"], label: "Streets + food" });
    expect(spec.actions.map((a) => a.proposalId)).toEqual(["s_311", "g_delivery"]);
    expect(spec.planId).toBe("streets-food");
  });

  test("round-trips a PlanSpec with per-action start years", () => {
    const spec = compilePlan({ kind: "planspec", version: 1, planId: "p1", actions: [
      { proposalId: "t_brt", startYear: 3 },
      { proposalId: "h_lots" },
    ] });
    expect(spec.actions.map((a) => a.startYear)).toEqual([3, 1]);
  });

  test("re-compiling a PlanSpec keeps unknown costs unknown", () => {
    const once = compilePlan({ proposalIds: ["t_bus"] });
    expect(once.actions[0].costB).toBeNull();
    expect(compilePlan(once).actions[0].costB).toBeNull();
  });

  test("rejects malformed input", () => {
    expect(() => compilePlan({ hello: 1 })).toThrow();
    expect(validatePlan({ actions: [{}] }).length).toBe(2);
  });
});

describe("planForYear", () => {
  const spec = compilePlan({ kind: "planspec", planId: "p", actions: [
    { proposalId: "t_bus", startYear: 1 },
    { proposalId: "f_buyouts", startYear: 4 },
    { proposalId: "hc_chc", startYear: 1 },
  ] });

  test("only started, simulated actions run", () => {
    expect(planForYear(spec, 2)).toEqual({ proposalIds: ["t_bus"], adoptedYearByProposal: { t_bus: 1 } });
    expect(planForYear(spec, 4).proposalIds).toEqual(["t_bus", "f_buyouts"]);
    expect(planForYear(spec, 0).proposalIds).toEqual([]);
  });

  test("effects ramp from each action's start year", () => {
    // f_buyouts: lag 1, ramp 3 → nothing at year 5, full at year 8
    expect(planEffectsForYear(spec, 5).floodMitigation).toBeCloseTo(0, 6);
    expect(planEffectsForYear(spec, 8).floodMitigation).toBeCloseTo(0.12, 6);
    expect(planEffectsForYear(spec, 3).speedMult).toBeCloseTo(1.45, 6);
  });
});
