import test from "node:test";
import assert from "node:assert/strict";
import { compactSimulationSummary, createConstitutionSummaryHandler, localConstitutionSummary } from "./constitution-summary-api.js";

const result = {
  meta: {
    plan: { label: "Drainage plan" },
    seeds: 12,
    checkpoints: [10],
    population: 140,
    metrics: {
      displacedResidents: { label: "Displaced by the storm", better: "lower", unit: "people" },
      avgMood: { label: "Well-being", better: "higher", unit: "pts" },
    },
    disclaimer: "Simulated outcomes with synthetic residents — illustrative counterfactuals, not a forecast.",
  },
  final: {
    displacedResidents: {
      baseline: { mean: 14, sd: 2 },
      plan: { mean: 8, sd: 2 },
      delta: { mean: -6, p10: -9, p50: -6, p90: -3 },
      improvedShare: 0.92,
    },
    avgMood: {
      baseline: { mean: 70, sd: 1 },
      plan: { mean: 71.5, sd: 1 },
      delta: { mean: 1.5, p10: 0.5, p50: 1.4, p90: 2.4 },
      improvedShare: 0.83,
    },
  },
  futures: { positive: 10, neutral: 1, negative: 1 },
};

test("compact summary keeps paired metric ranges without raw runs", () => {
  const compact = compactSimulationSummary(result);
  assert.equal(compact.seeds, 12);
  assert.equal(compact.metrics.length, 2);
  assert.equal(compact.metrics[0].deltaP10, -9);
});

test("local constitution summary describes schematic drainage geometry", () => {
  const summary = localConstitutionSummary({
    planText: "Accelerate bayou drainage and detention projects.",
    proposalIds: ["f_drainage"],
    planActions: [{ id: "f_drainage", title: "Accelerate drainage" }],
    result,
  });
  assert.match(summary, /paired random seeds/i);
  assert.match(summary, /detention basins/i);
  assert.match(summary, /not a forecast/i);
});

test("summary API falls back locally when no remote provider is configured", async () => {
  const handler = createConstitutionSummaryHandler({ env: { AI_PROVIDER: "demo" } });
  const request = new Request("http://localhost/api/constitution-summary", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      planText: "Accelerate bayou drainage and detention projects.",
      proposalIds: ["f_drainage"],
      planActions: [],
      result,
    }),
  });
  const response = await handler(request);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.provider, "local");
  assert.equal(body.fallback, true);
  assert.match(body.summary, /HappyBearLandia compared/i);
});
