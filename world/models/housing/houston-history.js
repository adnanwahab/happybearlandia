import { simulateHousingRun } from "./index.js";
import { parameters as definitions } from "./schema.js";
import { historicalInitialParameters, validateHousingHistory } from "./historical.js";

const earlierUrl = "https://www.houstontx.gov/planning/Demographics/2024-council-districts/demographics-tables/2024/3.%20Housing%20Occupancy%20Status.pdf";
const laterUrl = "https://www.houstontx.gov/planning/Demographics/2023-cd-demog-profiles-released-2024-dec/demo-tables/03-Housing-Occupancy-Status.pdf";
const source = (url, period, released) => ({
  name: `City of Houston Planning · US Census Bureau ${period} ACS 5-year estimate`, url,
  type: "official-published-estimate", agency: "City of Houston Planning and Development Department / US Census Bureau",
  page: 1, row: "City of Houston", publicationMonth: released, retrievedAt: "2026-11-02",
  availabilityDateInferred: true,
  availabilityNote: "Source specifies release month only. availableAt conservatively uses month-end; exact publication day was not verified.",
});

export const houstonHistoricalExample = {
  id: "houston-acs-overlapping-vintages.v1", name: "Houston · published housing-stock diagnostic",
  geography: "City of Houston, Texas", baseYear: 2022, cutoffDate: "2023-12-31", years: 1,
  observationType: "overlapping-acs-5-year-estimates", calibrated: false, strictForwardBacktest: false,
  sources: [source(earlierUrl, "2018–2022", "2023-12"), source(laterUrl, "2019–2023", "2024-12")],
  observations: [
    { year: 2022, periodStart: 2018, periodEnd: 2022, metricId: "housing_supply", value: 1006392, unit: "homes", availableAt: "2023-12-31", source: source(earlierUrl, "2018–2022", "2023-12") },
    { year: 2022, periodStart: 2018, periodEnd: 2022, metricId: "initial_households", value: 897510, unit: "households", availableAt: "2023-12-31", source: source(earlierUrl, "2018–2022", "2023-12") },
    { year: 2023, periodStart: 2019, periodEnd: 2023, metricId: "housing_supply", value: 1023112, unit: "homes", availableAt: "2024-12-31", source: source(laterUrl, "2019–2023", "2024-12") },
    { year: 2023, periodStart: 2019, periodEnd: 2023, metricId: "initial_households", value: 916536, unit: "households", availableAt: "2024-12-31", source: source(laterUrl, "2019–2023", "2024-12") },
  ].map((row) => ({ ...row, geography: "City of Houston, Texas", availabilityDateInferred: true,
    observationType: "ACS 5-year survey estimate; endpoint year is an index, not an annual point observation" })),
  limitations: [
    "Published observations are overlapping 2018–2022 and 2019–2023 ACS 5-year estimates, not independent point-in-time annual ground truth.",
    "This is an observed-versus-simulated stock diagnostic, not strict forward forecasting validation: the 2023-12-31 information cutoff is after the indexed 2023 observation period, though its estimate was published later.",
    "Availability days are inferred as month-end from the release months printed on the source tables; exact release days were not verified.",
    "Only starting stock and occupied homes are sourced. Occupied homes approximate households; the total housing stock includes vacant/seasonal units unlike an ideal usable-market inventory.",
    "Construction, demolition, household growth, rent, income, uncertainty, and all policy coefficients remain synthetic assumptions. No model fitting or empirical policy calibration was performed.",
    "The two source tables do not provide margins of error. Their survey uncertainty and covariance from overlapping periods are not included in the simulated interval.",
    "The later occupied-homes estimate is displayed as context, not used to initialize or fit the earlier model. Historical fit does not establish future predictive accuracy.",
  ],
};

/** ANALYSIS INTEGRATION: synchronous, deterministic, browser-safe. Returns real
 * model runs plus `validation.points` with observed/mean/median/p10/p90/error/
 * observedPercentile. All source rows, cutoff and limitations travel with output.
 * Present as a historical diagnostic, never a calibrated forward backtest.
 */
export function createHoustonHistoricalDiagnostic({ runs = 100, seed = 42 } = {}) {
  if (!Number.isInteger(runs) || runs < 1 || runs > 1000) throw new Error("Houston diagnostic requires 1–1000 runs.");
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Houston diagnostic seed must be uint32.");
  const example = structuredClone(houstonHistoricalExample);
  const initialization = historicalInitialParameters(example.observations, { cutoffDate: example.cutoffDate, geography: example.geography });
  const parameters = { ...Object.fromEntries(definitions.map((definition) => [definition.id, definition.default])), ...initialization.parameters };
  const rows = Array.from({ length: runs }, (_, index) => {
    const runSeed = (seed + Math.imul(index, 2654435761)) >>> 0;
    const result = simulateHousingRun({ parameters, seed: runSeed, years: example.years });
    return { ...result, id: `houston-history-${index + 1}`, scenarioId: "houston-current-policy-diagnostic", seed: runSeed,
      parameters: { ...parameters }, sampledParameters: { ...parameters }, status: "completed" };
  });
  const validation = validateHousingHistory({ observations: example.observations, runs: rows, baseYear: example.baseYear, cutoffDate: example.cutoffDate, geography: example.geography });
  return { ...example, status: "diagnostic", runs: rows, validation, initialization, parameters,
    sourceBackedParameters: ["initial_housing", "initial_households"],
    syntheticParameters: definitions.filter((definition) => !Object.hasOwn(initialization.parameters, definition.id)).map((definition) => definition.id),
    summary: "Published Houston housing estimates compared with an illustrative one-year housing-stock simulation. Overlapping survey vintages; no policy calibration or forward-validation claim.",
  };
}
