import { describe, expect, test } from "bun:test";
import { housingModel, createHousingScenarios, compileHousingPlan, simulateHousingRun, validateHousingParameters, stressPresets, applyHousingStress,
  importHousingHistory, importCensusHousingHistory, historicalInitialParameters, validateHousingHistory, calibrateHousingModel,
  houstonHistoricalExample, createHoustonHistoricalDiagnostic } from "../world/models/housing/index.js";
import { normalizeDecisionInput } from "../world/decision/contracts.js";

const scenarios = createHousingScenarios();
const plan = scenarios.find((scenario) => scenario.id === "plan-a").parameters;
const run = (parameters = plan, seed = 42, years = 10) => simulateHousingRun({ parameters, seed, years });

describe("housing model pack", () => {
  test("complete scenario pack conforms to shared experiment contract", () => {
    const result = normalizeDecisionInput({ name: "Housing", scenarios }, housingModel);
    expect(result.scenarios.length).toBe(4);
    expect(result.scenarios.filter((scenario) => scenario.kind === "baseline").length).toBe(1);
    expect(housingModel.calibrated).toBe(false);
    for (const definition of housingModel.parameters) {
      expect(definition.source.type).toBe("synthetic");
      expect(definition.description.length).toBeGreaterThan(10);
      expect(definition.default).toBeGreaterThanOrEqual(definition.min);
      expect(definition.default).toBeLessThanOrEqual(definition.max);
    }
  });
  test("same seed reproduces all numerical outputs, other seeds vary", () => {
    expect(run()).toEqual(run());
    expect(run(plan, 43).metrics).not.toEqual(run().metrics);
    expect(JSON.parse(JSON.stringify(run()))).toEqual(run());
  });
  test("policy changes supply, rents and cost against current policy", () => {
    const baseline = run(scenarios[0].parameters);
    const treatment = run();
    expect(treatment.metrics.housing_supply).toBeGreaterThan(baseline.metrics.housing_supply);
    expect(treatment.metrics.median_rent).toBeLessThan(baseline.metrics.median_rent);
    expect(baseline.metrics.public_expenditure).toBe(0);
    expect(treatment.metrics.public_expenditure).toBeGreaterThan(0);
    expect(treatment.timeline.length).toBe(11);
    for (const row of treatment.timeline) for (const metric of housingModel.metrics) expect(Number.isFinite(row.metrics[metric.id])).toBe(true);
  });
  test("stock and pipeline conservation and spending bounds hold", () => {
    const result = run();
    const a = result.accounting;
    expect(a.finalHousing).toBeCloseTo(a.initialHousing + a.completedHomes - a.demolishedHomes, 5);
    expect(a.initialPipelineHomes + a.starts).toBeCloseTo(a.completedHomes + a.pipelineHomes, 5);
    expect(result.metrics.public_expenditure).toBe(a.subsidySpent + a.voucherSpent);
    expect(a.subsidySpent).toBeLessThanOrEqual(plan.subsidy_amount * 10);
    expect(a.voucherSpent).toBeLessThanOrEqual(plan.voucher_funding * 10);
    const unfunded = run({ ...plan, funding_delivery: 0 });
    expect(unfunded.metrics.public_expenditure).toBe(0);
  });
  test("zero adoption preserves current-policy market dynamics and no policy spend", () => {
    const baseline = run(scenarios[0].parameters);
    const blocked = run({ ...plan, adoption: 0 });
    expect(blocked.metrics.housing_supply).toBe(baseline.metrics.housing_supply);
    expect(blocked.metrics.median_rent).toBe(baseline.metrics.median_rent);
    expect(blocked.metrics.public_expenditure).toBe(0);
  });
  test("every registered parameter changes actual numerical dynamics", () => {
    const original = run().metrics;
    for (const definition of housingModel.parameters) {
      const value = plan[definition.id];
      const alternate = value + (definition.max - definition.min) * 0.1 <= definition.max
        ? value + (definition.max - definition.min) * 0.1 : value - (definition.max - definition.min) * 0.1;
      const changed = run({ ...plan, [definition.id]: alternate }).metrics;
      expect(Object.keys(original).some((id) => Math.abs(original[id] - changed[id]) > 1e-7), definition.id).toBe(true);
    }
  });
  test("seven composable stresses survive uncertain inputs and are idempotent", () => {
    expect(stressPresets.length).toBe(7);
    const ids = stressPresets.map((preset) => preset.id);
    const stressed = applyHousingStress(plan, ids);
    expect(stressed.funding_delivery).toBe(0.5);
    expect(stressed.implementation_delay).toBe(24);
    expect(stressed.construction_capacity).toBe(36000);
    expect(stressed.interest_rate).toBe(0.085);
    expect(applyHousingStress(stressed, ids)).toEqual(stressed);
    expect(applyHousingStress(plan, [...ids].reverse())).toEqual(stressed);
    expect(() => applyHousingStress(plan, ["unknown"])).toThrow();
    expect(run(stressed).metrics).not.toEqual(run().metrics);
  });
  test("rejects malformed parameters, invalid horizon and nonnumeric values", () => {
    for (const value of [NaN, Infinity, null, "", "0.05", -1, 1]) expect(validateHousingParameters({ interest_rate: value }).valid).toBe(false);
    expect(validateHousingParameters({ decorative_slider: 1 }).valid).toBe(false);
    expect(() => run({ interest_rate: NaN })).toThrow();
    expect(() => run(plan, 42, 0)).toThrow();
    expect(() => run(plan, -1)).toThrow();
  });
  test("long horizons and extreme schema bounds remain finite", () => {
    for (const boundary of ["min", "max"]) {
      const input = Object.fromEntries(housingModel.parameters.map((parameter) => [parameter.id, parameter[boundary]]));
      const result = run(input, 42, 50);
      for (const row of result.timeline) for (const value of Object.values(row.metrics)) expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe("inspectable plan compilation", () => {
  test("extracts target months and annual billions from hero plan", () => {
    const text = "Increase housing density near transit stations, reduce permitting delays from 18 months to 6 months, and provide $2B annually in affordable-housing incentives.";
    const result = compileHousingPlan(text);
    expect(result.parameters.permitting_months).toBe(6);
    expect(result.parameters.subsidy_amount).toBe(2000000000);
    expect(result.assumptions.find((row) => row.id === "permitting_months").source.type).toBe("plan-text");
    expect(result.assumptions.find((row) => row.id === "zoning_density").source.type).toBe("generated-default");
    expect(result.assumptions.length).toBe(housingModel.parameters.length);
    expect(compileHousingPlan(text)).toEqual(result);
  });
  test("separates annual construction and voucher allocations", () => {
    const result = compileHousingPlan("Provide $2 billion annually for affordable construction and $300 million annually for vouchers.");
    expect(result.parameters.subsidy_amount).toBe(2000000000);
    expect(result.parameters.voucher_funding).toBe(300000000);
  });
  test("explicit construction funding leaves separate unspecified vouchers inspectable", () => {
    const result = compileHousingPlan("Increase density near transit, provide $2B annually for affordable construction, and increase housing vouchers.");
    expect(result.parameters.subsidy_amount).toBe(2000000000);
    expect(result.parameters.voucher_funding).toBe(300000000);
    expect(result.assumptions.find((row) => row.id === "subsidy_amount").source.type).toBe("plan-text");
    const voucher = result.assumptions.find((row) => row.id === "voucher_funding");
    expect(voucher.source.type).toBe("generated-default");
    expect(voucher.confidence).toBe("low");
    expect(voucher.assumption).toContain("amount unspecified");
  });
  test("separate mechanisms retain defaults without converting explicit lump sums", () => {
    const result = compileHousingPlan("Provide $2B total for affordable construction, and increase housing vouchers.");
    expect(result.parameters.subsidy_amount).toBe(0);
    expect(result.parameters.voucher_funding).toBe(300000000);
    const reverse = compileHousingPlan("Provide $500M annually for vouchers, and subsidize affordable construction.");
    expect(reverse.parameters.voucher_funding).toBe(500000000);
    expect(reverse.parameters.subsidy_amount).toBe(2000000000);
  });
  test("never treats unperiodized lump sums as annual appropriations", () => {
    const result = compileHousingPlan("Provide $2B total in housing vouchers over ten years.");
    expect(result.parameters.voucher_funding).toBe(0);
    expect(result.parameters.subsidy_amount).toBe(0);
    expect(result.warnings.some((warning) => warning.includes("without a clear annual period"))).toBe(true);
    expect(compileHousingPlan("").warnings.some((warning) => warning.includes("No plan text"))).toBe(true);
  });
});

describe("historical data and calibration boundaries", () => {
  const options = { geography: "Illustrative test geography", sourceUrl: "https://example.org/test-fixture", availableAt: "2020-09-01", units: { median_rent: "USD/month" } };
  test("Houston diagnostic retains real published rows and excludes later observations from initialization", () => {
    const result = createHoustonHistoricalDiagnostic({ runs: 10, seed: 42 });
    expect(result.parameters.initial_housing).toBe(1006392);
    expect(result.parameters.initial_households).toBe(897510);
    expect(result.sourceBackedParameters).toEqual(["initial_housing", "initial_households"]);
    expect(result.initialization.evidence.every((row) => row.availableAt <= "2023-12-31")).toBe(true);
    expect(result.validation.points.length).toBe(1);
    const point = result.validation.points[0];
    expect(point.observed).toBe(1023112);
    expect(point.availableAt).toBe("2024-12-31");
    expect(point.source.page).toBe(1);
    expect(point.source.availabilityDateInferred).toBe(true);
    expect(point.mean).toBe(result.runs.reduce((sum, row) => sum + row.metrics.housing_supply, 0) / 10);
    expect(result.strictForwardBacktest).toBe(false);
    expect(result.calibrated).toBe(false);
    expect(result.limitations.some((text) => text.includes("overlapping"))).toBe(true);
    expect(result.syntheticParameters).toContain("construction_capacity");
    expect(createHoustonHistoricalDiagnostic({ runs: 10, seed: 42 })).toEqual(result);
    result.observations[0].value = 0;
    expect(houstonHistoricalExample.observations[0].value).toBe(1006392);
    expect(() => createHoustonHistoricalDiagnostic({ runs: 0 })).toThrow();
  });
  test("imports quoted CSV, records provenance, rejects missing dates and sentinel values", () => {
    const imported = importHousingHistory('year,metricId,value,unit,availableAt\n2019,median_rent,1800,USD/month,2020-09-01\n2020,median_rent,-666666666,USD/month,2021-09-01', options);
    expect(imported.valid).toBe(true);
    expect(imported.observations.length).toBe(1);
    expect(imported.observations[0].source.type).toBe("user-supplied-cited");
    expect(importHousingHistory([{ year: 2019, metricId: "median_rent", value: 1800, unit: "USD/month" }], { geography: "Test" }).valid).toBe(false);
  });
  test("availability cutoff excludes future publications; no silent dollar conversion", () => {
    const imported = importHousingHistory([{ year: 2019, metricId: "median_rent", value: 1800, unit: "USD/month" }], { ...options, cutoffDate: "2020-01-01" });
    expect(imported.observations).toEqual([]);
    const wrongBasis = importHousingHistory([{ year: 2019, metricId: "median_rent", value: 1800, unit: "USD/month" }], { ...options, baseYear: 2020 });
    expect(wrongBasis.valid).toBe(false);
    const converted = importHousingHistory([{ year: 2019, metricId: "median_rent", value: 1800, unit: "USD/month" }], { ...options, baseYear: 2020, dollarFactors: { 2019: 1.02 } });
    expect(converted.observations[0].value).toBe(1836);
  });
  test("Census array adapter maps actual field names and initializes only pre-cutoff inputs", () => {
    const imported = importCensusHousingHistory([["NAME", "B25001_001E", "B25064_001E", "B19013_001E", "B11001_001E"], ["Synthetic fixture, not Census data", "1000000", "1800", "72000", "960000"]], { ...options, year: 2019 });
    expect(imported.observations.length).toBe(4);
    const initialized = historicalInitialParameters(imported.observations, { cutoffDate: "2020-10-01" });
    expect(initialized.parameters).toEqual({ initial_housing: 1000000, initial_rent: 1800, initial_income: 72000, initial_households: 960000 });
    expect(initialized.year).toBe(2019);
    expect(historicalInitialParameters(imported.observations, { cutoffDate: "2019-01-01" }).valid).toBe(false);
  });
  test("reports actual descriptive error and held-out percentile", () => {
    const observations = [{ year: 2020, metricId: "median_rent", value: 200, unit: "USD/month", availableAt: "2021-09-01", geography: "Test" }];
    const runs = [100, 200, 300].map((value) => ({ timeline: [{ year: 1, metrics: { median_rent: value } }] }));
    const result = validateHousingHistory({ observations, runs, baseYear: 2019, cutoffDate: "2020-01-01" });
    expect(result.metrics.median_rent.mae).toBe(0);
    expect(result.metrics.median_rent.rmse).toBe(0);
    expect(result.points[0].observedPercentile).toBe(50);
    expect(result.points[0].heldOut).toBe(true);
    expect(result.predictiveAccuracyClaimed).toBe(false);
  });
  test("calibration excludes future observations before choosing a coefficient", () => {
    const generated = run(plan, 42, 2);
    const observations = generated.timeline.filter((row) => row.year > 0).map((row) => ({ year: 2018 + row.year, metricId: "median_rent", value: row.metrics.median_rent, availableAt: `${2019 + row.year}-09-01`, geography: "Synthetic test fixture" }));
    const result = calibrateHousingModel({ observations, parameters: plan, baseYear: 2018, cutoffDate: "2020-12-31", candidates: [0.2, 0.8, 1.2], seeds: [42], years: 2 });
    expect(result.calibrated).toBe(true);
    expect(result.parameters.rent_response).toBe(0.8);
    expect(result.trainingObservations.length).toBe(1);
    expect(result.candidates.find((row) => row.value === 0.8).rmse).toBe(0);
    expect(calibrateHousingModel({ observations, baseYear: 2018, cutoffDate: "2019-01-01" }).calibrated).toBe(false);
  });
});
