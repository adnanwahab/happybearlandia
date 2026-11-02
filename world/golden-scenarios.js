export const GOLDEN_SCENARIOS = Object.freeze([
  { id: "housing-baseline", domain: "housing", family: "baseline", seed: 42001, expected: { finite: true, timeline: true } },
  { id: "housing-recession", domain: "housing", family: "recession", seed: 42002, expected: { finite: true, timeline: true } },
  { id: "housing-political-reversal", domain: "housing", family: "political_reversal", seed: 42003, expected: { finite: true, timeline: true } },
  { id: "education-baseline", domain: "education", family: "baseline", seed: 43001, expected: { finite: true, timeline: true } },
  { id: "climate-disruption", domain: "climate", family: "climate_disruption", seed: 44001, expected: { finite: true, timeline: true } },
]);

export function validateGoldenSimulation(simulation, scenario) {
  const errors = [];
  if (scenario?.expected?.finite && !Number.isFinite(Number(simulation?.score))) errors.push("score is not finite");
  if (scenario?.expected?.timeline && !Array.isArray(simulation?.timeline)) errors.push("timeline is missing");
  if (Array.isArray(simulation?.timeline) && simulation.timeline.some((row) => !Number.isFinite(Number(row.score)))) errors.push("timeline contains non-finite score");
  return { ok: errors.length === 0, errors };
}
