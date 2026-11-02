// Frozen v1.0.0 implementation: resolve explicitly for old manifests. Do not edit dynamics.
export { housingModel, parameters, metrics, limitations } from "./schema-v1.js";
import { parameters } from "./schema-v1.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const defaults = () => Object.fromEntries(parameters.map((parameter) => [parameter.id, parameter.default]));
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

export function validateHousingParameters(input = {}) {
  const values = defaults();
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { valid: false, values, errors: ["Parameters must be an object."] };
  const known = new Set(parameters.map((parameter) => parameter.id));
  for (const id of Object.keys(input)) if (!known.has(id)) errors.push(`Unknown housing parameter: ${id}`);
  for (const definition of parameters) {
    const value = input[definition.id];
    if (value === undefined) continue;
    if (!isNumber(value)) errors.push(`${definition.id} must be a finite number in ${definition.unit}.`);
    else if (value < definition.min || value > definition.max) errors.push(`${definition.id} must be between ${definition.min} and ${definition.max} ${definition.unit}.`);
    else values[definition.id] = value;
  }
  return { valid: errors.length === 0, values, errors };
}

/** Stress maps are absolute, inspectable parameter values. Distinct maps compose;
 * overlapping maps use the more adverse value according to applyStressPresets.
 * KERNEL CONTRACT: call applyHousingStress(sampledParameters, scenario.stressPresets)
 * once AFTER uncertainty sampling, so explicit stresses survive uncertain draws.
 * createHousingScenarios returns raw policy parameters + preset IDs, never pre-applied.
 */
export const stressPresets = [
  { id: "recession", name: "Recession", label: "Recession", description: "Lower growth and wages, higher unemployment.", parameters: { economic_growth: -0.025, wage_growth: -0.015, unemployment: 0.1 } },
  { id: "high-inflation", name: "High inflation", label: "High inflation", description: "Construction inflation and financing costs rise.", parameters: { inflation: 0.08, interest_rate: 0.085 } },
  { id: "low-adoption", name: "Low adoption", label: "Low adoption", description: "Weak compliance and administrative resistance.", parameters: { adoption: 0.35, resistance: 0.5 } },
  { id: "implementation-delay", name: "Implementation delay", label: "Implementation delay", description: "Policy does not begin for two years.", parameters: { implementation_delay: 24 } },
  { id: "demand-surge", name: "Demand surge", label: "Demand surge", description: "Migration and household formation accelerate.", parameters: { migration: 0.03, population_growth: 0.018 } },
  { id: "budget-cut", name: "Budget cut", label: "Budget cut", description: "Only half of appropriated program funding arrives.", parameters: { funding_delivery: 0.5 } },
  { id: "supply-constraint", name: "Supply constraint", label: "Supply constraint", description: "Physical capacity falls and construction takes longer.", parameters: { construction_capacity: 36000, construction_months: 30 } },
];
const adverseLower = new Set(["economic_growth", "wage_growth", "adoption", "funding_delivery", "construction_capacity"]);
export function applyStressPresets(input = {}, ids = []) {
  const checked = validateHousingParameters(input);
  if (!checked.valid) throw new Error(checked.errors.join(" "));
  const values = { ...checked.values };
  for (const entry of ids) {
    const preset = stressPresets.find((candidate) => candidate.id === (typeof entry === "string" ? entry : entry?.id));
    if (!preset) throw new Error(`Unknown housing stress preset: ${typeof entry === "string" ? entry : entry?.id}`);
    for (const [id, value] of Object.entries(preset.parameters)) values[id] = adverseLower.has(id) ? Math.min(values[id], value) : Math.max(values[id], value);
  }
  return values;
}

export const applyHousingStress = applyStressPresets;

export function createHousingScenarios() {
  const baseline = defaults();
  const plan = { ...baseline, permitting_months: 6, zoning_density: 1.6, subsidy_amount: 2000000000, voucher_funding: 300000000, transit_share: 0.65 };
  const uncertainty = {
    migration: { type: "triangular", min: 0, mode: 0.006, max: 0.025 },
    interest_rate: { type: "triangular", min: 0.025, mode: 0.045, max: 0.08 },
    construction_capacity: { type: "triangular", min: 50000, mode: 72000, max: 90000 },
  };
  return [
    { id: "baseline", name: "Current policy", kind: "baseline", parameters: baseline, uncertainty: structuredClone(uncertainty), stressPresets: [] },
    { id: "plan-a", name: "Transit housing proposal", kind: "plan-a", parameters: plan, uncertainty: structuredClone(uncertainty), stressPresets: [] },
    { id: "plan-b", name: "Capacity + targeted assistance", kind: "plan-b", parameters: { ...plan, construction_capacity: 90000, subsidy_amount: 3000000000, voucher_funding: 600000000, zoning_density: 1.9 }, uncertainty: { ...structuredClone(uncertainty), construction_capacity: { type: "triangular", min: 70000, mode: 90000, max: 110000 } }, stressPresets: [] },
    { id: "stress", name: "Proposal + recession / delivery stress", kind: "stress", parameters: { ...plan }, uncertainty: structuredClone(uncertainty), stressPresets: ["recession", "implementation-delay", "budget-cut"] },
  ];
}

/** Deterministic conservative parser. An explicit value gets a text excerpt;
 * keyword-triggered assumptions remain generated defaults and never claim evidence.
 */
export function compileHousingPlan(text = "") {
  const sourceText = String(text);
  const lower = sourceText.toLowerCase();
  const values = defaults();
  const assumptions = [];
  const warnings = ["Deterministic text parser; generated defaults are synthetic assumptions, not evidence or a full interpretation of the plan."];
  const propose = (id, value, reason, excerpt = null) => {
    const definition = parameters.find((row) => row.id === id);
    const bounded = clamp(value, definition.min, definition.max);
    if (bounded !== value) warnings.push(`${definition.label}: parsed ${value} outside model bounds; clamped to ${bounded}. Review before simulation.`);
    values[id] = bounded;
    assumptions.push({ id, parameterId: id, assumption: reason, value: bounded, unit: definition.unit,
      source: excerpt ? { type: "plan-text", label: "User plan text", excerpt } : { type: "generated-default", label: "Deterministic keyword assumption" },
      confidence: excerpt ? "medium" : "low", date: "2026-11-02", component: definition.component,
      notes: excerpt ? "Literal extraction; verify policy scope and interpretation." : "Suggested value requiring user review; no empirical calibration." });
  };
  if (/dens|upzon|zoning|transit/.test(lower)) propose("zoning_density", 1.6, "Higher density is represented as 1.6× allowed development; magnitude unspecified in plan.");
  if (/transit/.test(lower)) propose("transit_share", 0.65, "Assume 65% of new homes near transit; magnitude unspecified.");
  if (/permit/.test(lower)) {
    const match = sourceText.match(/(?:permit\w*(?:\s+\w+){0,5}?)\s+(?:from\s+\d+(?:\.\d+)?\s*months?\s+to\s+|(?:to|of|at)\s+)?(\d+(?:\.\d+)?)\s*months?/i)
      || sourceText.match(/(\d+(?:\.\d+)?)\s*[- ]?month\s+permit\w*/i);
    propose("permitting_months", match ? Number(match[1]) : 6, match ? "Explicit permitting target in plan." : "Faster permitting represented as six months; target unspecified.", match?.[0]);
  }
  const implementation = sourceText.match(/implementation(?:\s+delay)?\s*(?:of|to|:)?\s*(\d+(?:\.\d+)?)\s*months?/i);
  if (implementation) propose("implementation_delay", Number(implementation[1]), "Explicit implementation delay.", implementation[0]);
  const moneyMatches = [...sourceText.matchAll(/\$\s*(\d+(?:\.\d+)?)\s*(billion|bn|b|million|mm|m)\b/gi)];
  const budgetMentions = new Set();
  for (const match of moneyMatches) {
    const start = match.index;
    const end = start + match[0].length;
    const nextBreak = sourceText.slice(end).search(/[.;\n]|,\s*(?:and\s+)?(?:\$|increase|provide|allocate|subsid\w*|expand|boost|fund|support)|\s+and\s+(?:\$|increase|provide|allocate|subsid\w*|expand|boost|fund|support)/i);
    const before = sourceText.slice(Math.max(0, start - 70), start).split(/[.;\n,]|\band\b/i).at(-1);
    const after = sourceText.slice(end, nextBreak < 0 ? end + 100 : end + nextBreak);
    const context = `${before}${match[0]}${after}`;
    const annual = /annual|per\s+year|each\s+year|\/\s*yr|yearly/i.test(context);
    const amount = Number(match[1]) * (/^b/i.test(match[2]) ? 1e9 : 1e6);
    const voucher = /voucher|rental assistance/i.test(context);
    const construction = /affordable|construction|incentive|subsid|housing/i.test(context);
    const ambiguous = voucher && /construction|incentive|subsid/i.test(context);
    // A dollar amount suppresses a generated default only for its own mechanism.
    // Unperiodized or ambiguous amounts still suppress that mechanism's default,
    // so a lump sum never quietly becomes a suggested annual appropriation.
    if (voucher) budgetMentions.add("voucher_funding");
    if (construction && (!voucher || ambiguous)) budgetMentions.add("subsidy_amount");
    if (!annual) { warnings.push(`Found ${match[0]} without a clear annual period; not treated as annual funding. Enter the annual budget explicitly.`); continue; }
    if (ambiguous) {
      warnings.push(`Ambiguous construction/voucher allocation for ${match[0]}; review the funding controls.`); continue;
    }
    if (voucher || construction) propose(voucher ? "voucher_funding" : "subsidy_amount", amount, `Explicit annual ${voucher ? "voucher" : "housing construction"} appropriation.`, context.trim());
    else warnings.push(`Found annual ${match[0]} without a clear housing program; no funding assumption applied.`);
  }
  if (/voucher|rental assistance/.test(lower) && !assumptions.some((row) => row.id === "voucher_funding") && !budgetMentions.has("voucher_funding")) propose("voucher_funding", 300000000, "Voucher proposal represented as $300M/year; amount unspecified.");
  if (/subsid|affordable construction|incentive/.test(lower) && !assumptions.some((row) => row.id === "subsidy_amount") && !budgetMentions.has("subsidy_amount")) propose("subsidy_amount", 2000000000, "Construction support represented as $2B/year; amount unspecified.");
  for (const definition of parameters) if (!assumptions.some((row) => row.id === definition.id)) {
    assumptions.push({ id: definition.id, parameterId: definition.id, assumption: definition.description, value: values[definition.id], unit: definition.unit,
      source: { ...definition.source }, confidence: "low", date: definition.date, component: definition.component, notes: "Unspecified in plan; retained illustrative city default." });
  }
  if (!sourceText.trim()) warnings.push("No plan text supplied; all values remain illustrative current-policy defaults.");
  return { parameters: values, assumptions, warnings };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

/** Monthly stock-flow model. Draw exactly three exogenous innovations per month,
 * regardless of policy, to preserve matched-seed comparisons between scenarios.
 */
export function simulateHousingRun({ parameters: input = {}, seed = 42, years = 10 } = {}) {
  const checked = validateHousingParameters(input);
  if (!checked.valid) throw new Error(checked.errors.join(" "));
  if (!Number.isInteger(years) || years < 1 || years > 50) throw new Error("Housing horizon must be an integer from 1 to 50 years.");
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error("Housing seed must be an unsigned 32-bit integer.");
  const p = checked.values;
  const random = seededRandom(seed);
  let housing = p.initial_housing;
  let households = p.initial_households;
  let rent = p.initial_rent;
  let income = p.initial_income;
  let built = 0;
  let lost = 0;
  let started = 0;
  let expenditure = 0;
  let subsidySpent = 0;
  let voucherSpent = 0;
  let taxRevenue = 0;
  let transitHomes = p.initial_housing * 0.25;
  let delivered = 0;
  let voucherPerMonth = 0;
  let lastAnnualStarts = 0;
  let sumVacancyPressure = 0;
  let sumFinance = 0;
  const pipeline = [];
  const events = [];
  const timeline = [];
  const targetVacancy = 0.06;
  // Projects already in progress are identical between paired policy scenarios.
  const initialMonthlyCompletions = p.construction_capacity * 0.38 / 12;
  for (let month = 1; month <= 18; month++) pipeline.push({ due: month, homes: initialMonthlyCompletions, transit: 0.25, initial: true });
  const snapshot = () => {
    const vacancy = clamp((housing - households) / housing, 0, 1);
    const burden = rent * 12 / Math.max(1, income);
    const lowIncome = income * 0.55 * (1 - p.unemployment * 0.4);
    const lowBurden = Math.max(0, rent - voucherPerMonth) * 12 / Math.max(1, lowIncome);
    const shortage = Math.max(0, households - housing);
    return {
      housing_supply: housing, median_rent: rent, affordability: clamp((1 - burden) * 100, -200, 100),
      homelessness_proxy: shortage + households * 0.25 * Math.max(0, lowBurden - 0.5) * 0.08,
      displacement_risk: clamp((Math.max(0, lowBurden - 0.3) * 90 + Math.max(0, rent / p.initial_rent - 1) * 20 + built / p.initial_housing * 5), 0, 100),
      construction: built, public_expenditure: expenditure,
      employment: households * (1 - p.unemployment) + lastAnnualStarts * 1.4,
      commute_burden: Math.max(20, 100 - (transitHomes / housing - 0.25) * 55 + shortage / households * 100),
      tax_revenue: taxRevenue, implementation_success: delivered * 100,
      low_income_rent_burden: lowBurden * 100, vacancy_rate: vacancy * 100,
    };
  };
  timeline.push({ year: 0, metrics: snapshot() });
  let shortageFlag = false;
  let capacityFlag = false;
  for (let month = 1; month <= years * 12; month++) {
    const time = month / 12;
    const demandInnovation = (random() - 0.5) * 0.012;
    const costInnovation = (random() - 0.5) * 0.16;
    const capacityInnovation = 0.88 + random() * 0.24;
    const phase = clamp((month - p.implementation_delay - p.resistance * 6) / 12, 0, 1);
    delivered = phase * p.adoption * (1 - p.resistance);
    const permitMonths = 18 + (p.permitting_months - 18) * delivered;
    const density = 1 + (p.zoning_density - 1) * delivered;
    const transitShare = 0.25 + (p.transit_share - 0.25) * delivered;
    households *= Math.exp((p.population_growth + p.migration + demandInnovation) / 12);
    income *= Math.exp((p.wage_growth + 0.2 * (p.economic_growth - 0.02) - 0.15 * (p.unemployment - 0.05)) / 12);
    const demolished = housing * (1 - Math.exp(-p.demolition_rate / 12));
    housing -= demolished;
    lost += demolished;
    transitHomes *= 1 - demolished / (housing + demolished);
    for (let index = pipeline.length - 1; index >= 0; index--) if (pipeline[index].due <= month) {
      const project = pipeline[index];
      housing += project.homes;
      built += project.homes;
      transitHomes += project.homes * project.transit;
      pipeline.splice(index, 1);
    }
    const vacancy = (housing - households) / housing;
    const shortage = Math.max(0, targetVacancy - vacancy);
    const finance = Math.exp(-7 * (p.interest_rate - 0.045));
    const currentCost = p.construction_cost * Math.exp(p.inflation * time) * (1 + costInnovation);
    const costFactor = Math.sqrt(300000 / currentCost);
    const capacity = p.construction_capacity / 12 * capacityInnovation;
    const approvals = clamp(12 / (12 + permitMonths), 0.15, 1);
    const marketDemand = clamp(0.55 + shortage * 6 + p.economic_growth * 2 - p.unemployment, 0.12, 1.6);
    const privateStarts = capacity * approvals * density * finance * costFactor * marketDemand;
    const monthlySubsidyBudget = p.subsidy_amount * p.funding_delivery * delivered / 12;
    const subsidyPerHome = currentCost * 0.35;
    const subsidyHomes = monthlySubsidyBudget / subsidyPerHome;
    const actualPrivate = Math.min(capacity, privateStarts);
    const actualSubsidy = Math.min(Math.max(0, capacity - actualPrivate), subsidyHomes);
    const newStarts = actualPrivate + actualSubsidy;
    const constructionGrant = actualSubsidy * subsidyPerHome;
    const voucherBudget = p.voucher_funding * p.funding_delivery * delivered / 12;
    const eligible = households * 0.25;
    const voucher = Math.min(voucherBudget, eligible * rent * 0.5);
    voucherPerMonth = voucher / Math.max(1, eligible);
    subsidySpent += constructionGrant;
    voucherSpent += voucher;
    expenditure = subsidySpent + voucherSpent;
    started += newStarts;
    lastAnnualStarts = newStarts * 12;
    pipeline.push({ due: month + Math.max(1, Math.ceil(permitMonths + p.construction_months)), homes: newStarts, transit: transitShare });
    // Annual rent response to an actual vacancy gap, bounded to avoid numerical spirals.
    const pressure = clamp(p.rent_response * (targetVacancy - vacancy), -0.10, 0.16);
    rent *= Math.exp((pressure + 0.12 * (p.wage_growth + p.economic_growth - 0.03)) / 12);
    sumVacancyPressure += pressure / 12;
    sumFinance += finance / (years * 12);
    taxRevenue += Math.max(0, housing - p.initial_housing) * p.construction_cost * 0.01 / 12;
    if (!shortageFlag && households > housing) {
      shortageFlag = true;
      events.push({ year: time, month, type: "housing-shortage", label: "Household demand exceeds usable homes", value: households - housing, unit: "households" });
    }
    if (!capacityFlag && newStarts >= capacity * 0.98) {
      capacityFlag = true;
      events.push({ year: time, month, type: "capacity-bound", label: "Construction reaches physical capacity", value: newStarts * 12, unit: "homes/year" });
    }
    if (month % 12 === 0) {
      timeline.push({ year: month / 12, metrics: snapshot() });
      events.push({ year: time, month, type: "annual-accounting", label: `Year ${month / 12} housing and budget ledger`,
        housing, households, completedHomes: built, demolishedHomes: lost, starts: started, pipelineHomes: pipeline.reduce((sum, item) => sum + item.homes, 0),
        constructionExpenditure: subsidySpent, voucherExpenditure: voucherSpent, expenditure });
    }
  }
  return { metrics: snapshot(), timeline, events, drivers: [
    { id: "vacancy-pressure", parameterId: "rent_response", metricId: "median_rent", label: "Accumulated vacancy pressure", value: sumVacancyPressure, unit: "log rent change", description: "Recorded rent update term summed over monthly steps; not a counterfactual attribution." },
    { id: "finance-feasibility", parameterId: "interest_rate", metricId: "construction", label: "Financing feasibility multiplier", value: sumFinance, unit: "multiplier", description: "Mean recorded financing multiplier on potential private starts." },
    { id: "delivered-policy", parameterId: "adoption", metricId: "implementation_success", label: "Delivered policy fraction", value: delivered, unit: "fraction", description: "Final phase-in × adoption × (1 − resistance)." },
    { id: "public-construction", parameterId: "subsidy_amount", metricId: "public_expenditure", label: "Construction contributions paid", value: subsidySpent, unit: "USD", description: "Actual cumulative expenditure constrained by feasible subsidized starts." },
    { id: "vouchers-paid", parameterId: "voucher_funding", metricId: "public_expenditure", label: "Vouchers paid", value: voucherSpent, unit: "USD", description: "Actual cumulative eligible rental assistance expenditure." },
  ], accounting: { initialHousing: p.initial_housing, completedHomes: built, demolishedHomes: lost, finalHousing: housing, starts: started,
    initialPipelineHomes: initialMonthlyCompletions * 18, pipelineHomes: pipeline.reduce((sum, item) => sum + item.homes, 0), subsidySpent, voucherSpent },
  modelVersion: "1.0.0", exploratory: true };
}
