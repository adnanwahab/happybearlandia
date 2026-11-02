import { describe, expect, test } from "bun:test";
import { analyzeDecision, percentile } from "../world/decision/analysis.js";
import { createHousingHistoryAdapter, runPublishedHousingDiagnostic, observedPercentile, runHistoricalBacktest, scoreBacktest, splitHistoricalData } from "../world/decision/backtest.js";
import { buildDecisionManifest, decisionBriefDocument, renderDecisionBrief } from "../world/decision/brief.js";
import { evidenceCsv, parseEvidenceCsv, parseEvidenceImport } from "../world/decision/trust-view.js";

const model = { id: "housing.v1", version: "1", parameters: [{ id: "capacity", label: "Capacity", unit: "homes", default: 10 }], metrics: [{ id: "affordability", label: "Affordability", unit: "%", direction: "higher" }], limitations: ["No spatial model"] };
const experiment = { id: "e1", name: "Housing decision", decision: "Add housing", modelId: model.id, modelVersion: "1", seed: 42, years: 10, runs: 4, status: "completed", scenarios: [{ id: "base", name: "Current policy", kind: "baseline", parameters: { capacity: 10 } }, { id: "plan", name: "Plan A", kind: "plan-a", parameters: { capacity: 20 }, uncertainty: { capacity: { type: "uniform", min: 1, max: 4 } } }] };
const runs = [1, 2, 3, 4].flatMap(seed => [
  { id: `b${seed}`, scenarioId: "base", seed, status: "completed", parameters: { capacity: 10 }, metrics: { affordability: 2.5 } },
  { id: `p${seed}`, scenarioId: "plan", seed, status: "completed", sampledParameters: { capacity: seed }, metrics: { affordability: seed }, drivers: [{ label: "Stored construction pressure", value: seed }], events: [{ type: "queue" }] },
]);

describe("decision analysis", () => {
  test("interpolated percentiles handle endpoints and reject nonnumeric values", () => {
    expect(percentile([0, 10], 0.1)).toBe(1);
    expect(percentile([0, 10], 0.9)).toBe(9);
    expect(percentile([null, NaN, "2"], 0.5)).toBeNull();
    expect(percentile([10], 1)).toBe(10);
    expect(percentile([], 0)).toBeNull();
  });
  test("associations stay within scenarios and failures use actual same-seed pairs", () => {
    const result = analyzeDecision({ model, experiment, runs: [...runs, { id: "failed", scenarioId: "plan", seed: 88, status: "failed", metrics: { affordability: -100 } }, { id: "unpaired", scenarioId: "plan", seed: 99, status: "completed", sampledParameters: { capacity: 10 }, metrics: { affordability: 10 } }] });
    expect(result.failed).toBe(1);
    expect(result.sensitivities).toHaveLength(1);
    expect(result.sensitivities[0].correlation).toBeCloseTo(1);
    expect(result.sensitivities[0].method).toContain("not causal");
    expect(result.failureClusters[0].pairedCount).toBe(4);
    expect(result.failureClusters[0].runIds).toEqual(["p1", "p2"]);
    expect(result.failureClusters[0].conditions.find(row => row.tail === "low").prevalence).toBe(1);
    expect(result.explanations.find(row => row.runId === "p1").drivers).toEqual(runs[1].drivers);
  });
  test("lower is better reverses failure classification and unknown direction does not invent it", () => {
    const lower = analyzeDecision({ model: { ...model, metrics: [{ id: "affordability", direction: "lower" }] }, experiment, runs });
    expect(lower.failureClusters[0].runIds).toEqual(["p3", "p4"]);
    const unknown = analyzeDecision({ model: { ...model, metrics: [{ id: "affordability" }] }, experiment, runs });
    expect(unknown.failureClusters[0].fraction).toBeNull();
    expect(analyzeDecision().empty).toBe(true);
  });
});

describe("historical evaluation", () => {
  const observations = [
    { date: "2014-01-01", availableAt: "2014-06-01", parameters: { capacity: 10 } },
    { date: "2014-01-01", availableAt: "2020-01-01", parameters: { capacity: 999 } },
    { date: "2025-01-01", availableAt: "2025-06-01", parameters: { capacity: 9999 }, metrics: { affordability: 12 } },
    { date: "2013-01-01", parameters: { capacity: 777 } },
  ];
  test("requires availability timestamps and never calibrates on future/revised records", async () => {
    let seen;
    const result = await runHistoricalBacktest({ adapter: { observations, synthetic: true, calibrate(training) { seen = training; return { parameters: training.at(-1).parameters }; } }, cutoff: "2015-01-01", targetDate: "2025-01-01", runs: 3, simulate({ parameters, seed, years }) { expect(parameters.capacity).toBe(10); expect(years).toBe(11); return { metrics: { affordability: seed % 3 + parameters.capacity } }; } });
    expect(seen).toHaveLength(1);
    expect(seen[0].parameters.capacity).toBe(10);
    expect(result.dataset.synthetic).toBe(true);
    expect(result.metrics[0].observed).toBe(12);
    expect(result.limitations.join(" ")).toContain("SYNTHETIC");
    expect(result.excludedCount).toBe(2);
  });
  test("housing dataset adapter fits only pre-cutoff records and keeps held-out rent out of fitting", async () => {
    const raw = [
      { year: 2010, metricId: "median_rent", value: 1000, unit: "USD/month", geography: "synthetic-city", availableAt: "2011-01-01", dollarYear: 2010 },
      { year: 2012, metricId: "median_rent", value: 1100, unit: "USD/month", geography: "synthetic-city", availableAt: "2013-01-01", dollarYear: 2010 },
      { year: 2020, metricId: "median_rent", value: 1400, unit: "USD/month", geography: "synthetic-city", availableAt: "2021-01-01", dollarYear: 2010 },
    ];
    const adapter = await createHousingHistoryAdapter(raw, { synthetic: true, baseYear: 2010 });
    const simulate = ({ parameters }) => ({ metrics: { median_rent: parameters.initial_rent } });
    const result = await runHistoricalBacktest({ adapter, cutoff: "2015-01-01", targetDate: "2020-01-01", runs: 3, simulate });
    expect(result.startDate).toBe("2010-01-01");
    expect(result.metrics[0].observed).toBe(1400);
    expect(result.calibrationAudit.candidates.length).toBeGreaterThan(0);
    const altered = await createHousingHistoryAdapter(raw.map(row => row.year === 2020 ? { ...row, value: 8000 } : row), { synthetic: true, baseYear: 2010 });
    const second = await runHistoricalBacktest({ adapter: altered, cutoff: "2015-01-01", targetDate: "2020-01-01", runs: 3, simulate });
    expect(second.parameters).toEqual(result.parameters);
    expect(second.metrics[0].observed).toBe(8000);
  });

  test("published diagnostic uses source-owned observations without claiming a blind backtest", async () => {
    const result = await runPublishedHousingDiagnostic({ runs: 10, seed: 42 });
    expect(result.successful).toBe(10);
    expect(result.metrics[0].observed).toBe(1023112);
    expect(result.sources[0].housing_supply).toBe(1006392);
    expect(result.sourceBackedParameters).toEqual(["initial_housing", "initial_households"]);
    expect(result.syntheticParameters).toContain("rent_response");
    expect(result.limitations.join(" ")).toContain("not strict forward");
    expect(result.sources.every(source => source.url.startsWith("https://www.houstontx.gov/"))).toBe(true);
    expect(result.runSeeds).toHaveLength(10);
  });

  test("empirical percentile uses midranks and unit-specific errors", () => {
    expect(observedPercentile([1, 2, 2, 3], 2)).toBe(50);
    expect(observedPercentile([1, 2, 3], 10)).toBe(100);
    expect(observedPercentile([], 10)).toBeNull();
    const result = scoreBacktest([{ metrics: { rent: 100 } }, { metrics: { rent: 120 } }], { rent: 100 });
    expect(result.metrics[0].absoluteError).toBe(10);
    expect(result.metrics[0].squaredError).toBe(100);
    expect(result.metrics[0].absolutePercentageError).toBe(10);
    expect(result.metrics[0].covered80).toBe(false);
  });
  test("blocks invalid dates, missing cutoff data, and misaligned annual horizons", async () => {
    expect(() => splitHistoricalData([], "bad", "2025-01-01")).toThrow();
    await expect(runHistoricalBacktest({ adapter: { observations: [observations[2]] }, cutoff: "2015-01-01", targetDate: "2025-01-01", simulate() {} })).rejects.toThrow("No dated inputs");
    await expect(runHistoricalBacktest({ adapter: { observations }, cutoff: "2015-01-01", targetDate: "2025-02-01", simulate() {} })).rejects.toThrow("whole number of years");
  });
});

describe("trust exports and brief safety", () => {
  test("CSV supports quoting, newlines, BOM and protects spreadsheet formulas", () => {
    const records = parseEvidenceCsv('\uFEFFparameterId,source,notes\r\ncapacity,"A, B","quoted ""value""\nsecond line"');
    expect(records[0].source).toBe("A, B");
    expect(records[0].notes).toContain('"value"\nsecond line');
    expect(() => parseEvidenceCsv('source\n"unclosed')).toThrow();
    expect(evidenceCsv([{ source: "=RUN()" }])).toContain("'=RUN()");
    expect(parseEvidenceImport('{"evidence":[{"source":"Report","notes":"Metadata only"}]}')[0].confidence).toBe("Unverified");
  });
  test("brief includes mandatory sections and escapes hostile plan/evidence/driver content", () => {
    const attack = '</script><img src=x onerror=alert(1)>';
    const input = { experiment: { ...experiment, name: attack, decision: attack }, runs, model, evidence: [{ source: attack }] };
    const report = renderDecisionBrief(input);
    for (const heading of ["Decision", "Alternatives", "Assumptions", "Results", "Tradeoffs", "Failure modes", "Sensitivity", "Evidence", "Limitations"]) expect(report).toContain(`<h2>${heading}</h2>`);
    expect(report).not.toContain(attack);
    expect(report).toContain("&lt;img");
    const document = decisionBriefDocument(input);
    expect(document.match(/<script>/g)).toHaveLength(1);
    expect(document).toContain("@media print");
    expect(document).toContain("not predictions");
  });
  test("reproduction captures actual run seeds, sampled values, and versions", () => {
    const manifest = buildDecisionManifest({ experiment, runs, model });
    expect(manifest.modelVersion).toBe("1");
    expect(manifest.schemaVersion).toBe("decision-manifest.v1");
    expect(manifest.engineVersion).toBe("hbl-decision-kernel.v1");
    expect(manifest.runManifest[1].sampledParameters).toEqual({ capacity: 1 });
    expect(manifest.metricDefinitions).toEqual(model.metrics);
    expect(manifest.experiment).not.toBe(experiment);
    expect(buildDecisionManifest()).toBeNull();
  });
});
