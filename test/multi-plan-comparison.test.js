import { describe, expect, test } from "bun:test";
import { comparePlanVariants, paretoFrontier } from "../world/multi-plan-comparison.js";
import { createSimulationAdapter } from "../world/simulation-adapter.js";

const experiment = { id: "exp", plan: { id: "base", title: "Base", bonus: 0 }, lineage: {} };
const worldBatch = { seed: 42, worlds: [{ id: "w1", normalized: { x: 0.2 } }, { id: "w2", normalized: { x: 0.8 } }] };
const adapter = createSimulationAdapter({ id: "plan-demo", simulateWorld: ({ experiment, world }) => ({ score: world.normalized.x * 50 + Number(experiment.plan.bonus || 0), metrics: { cost: Number(experiment.plan.cost || 0) } }) });

describe("multi plan comparison", () => {
  test("runs every plan against the exact same worlds", async () => {
    const comparison = await comparePlanVariants({ experiment, worldBatch, adapter, variants: [
      { id: "a", plan: { title: "A", bonus: 10, cost: 5 } },
      { id: "b", plan: { title: "B", bonus: 20, cost: 10 } },
    ] });
    expect(comparison.worldCount).toBe(2);
    expect(comparison.pairedWorlds[0].results.a.score).toBe(20);
    expect(comparison.pairedWorlds[0].results.b.score).toBe(30);
  });
  test("computes Pareto-optimal variants over score and cost", async () => {
    const comparison = await comparePlanVariants({ experiment, worldBatch, adapter, variants: [
      { id: "a", plan: { title: "A", bonus: 10, cost: 5 } },
      { id: "b", plan: { title: "B", bonus: 20, cost: 10 } },
      { id: "c", plan: { title: "C", bonus: 5, cost: 10 } },
    ] });
    const frontier = paretoFrontier(comparison, [
      { path: "summary.expectedScore", direction: "higher-is-better" },
      { metric: "cost", direction: "lower-is-better" },
    ]);
    expect(frontier.find((row) => row.variantId === "c").paretoOptimal).toBe(false);
    expect(frontier.find((row) => row.variantId === "a").paretoOptimal).toBe(true);
    expect(frontier.find((row) => row.variantId === "b").paretoOptimal).toBe(true);
  });
});
