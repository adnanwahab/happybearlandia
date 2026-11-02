import { describe, expect, test } from "bun:test";
import { attachOutcomeAnalysis, summarizeOutcomes } from "../world/outcome-analysis.js";

const batch = {
  adapter: { id: "demo" },
  simulations: [
    { worldId: "w1", score: 80, status: "positive", metrics: { cost: 10 } },
    { worldId: "w2", score: 70, status: "positive", metrics: { cost: 20 } },
    { worldId: "w3", score: 50, status: "mixed", metrics: { cost: 30 } },
    { worldId: "w4", score: 20, status: "negative", metrics: { cost: 40 } },
  ],
};

describe("outcome analysis", () => {
  test("summarizes expected outcome, robustness, and tail risk", () => {
    const summary = summarizeOutcomes(batch);
    expect(summary.total).toBe(4);
    expect(summary.expectedScore).toBe(55);
    expect(summary.robustness).toBe(0.5);
    expect(summary.counts).toMatchObject({ positive: 2, mixed: 1, negative: 1 });
    expect(summary.tailRisks[0].worldId).toBe("w4");
  });

  test("summarizes arbitrary numeric metrics", () => {
    const summary = summarizeOutcomes(batch);
    expect(summary.metrics.cost.mean).toBe(25);
    expect(summary.metrics.cost.min).toBe(10);
    expect(summary.metrics.cost.max).toBe(40);
  });

  test("attaches analysis without destroying the plan", () => {
    const experiment = { id: "exp", plan: { id: "plan", title: "Demo" }, outcomes: {}, analysis: {} };
    const enriched = attachOutcomeAnalysis(experiment, batch);
    expect(enriched.plan.title).toBe("Demo");
    expect(enriched.analysis.robustness).toBe(0.5);
    expect(enriched.outcomes.worlds).toHaveLength(4);
  });
});
