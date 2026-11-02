const source = {
  type: "synthetic", label: "HBL illustrative city assumptions; not empirical calibration",
  date: "2026-11-02", confidence: "low", calibrated: false,
};

function parameter(id, label, unit, value, min, max, step, component, description) {
  const relevantMetrics = {
    stock: ["housing_supply", "vacancy_rate"], demand: ["housing_supply", "median_rent", "homelessness_proxy"],
    rents: ["median_rent", "affordability", "low_income_rent_burden"], income: ["affordability", "low_income_rent_burden"],
    economy: ["employment", "affordability", "construction"], finance: ["construction", "public_expenditure"],
    construction: ["housing_supply", "construction", "employment"], implementation: ["implementation_success", "housing_supply", "public_expenditure"],
    land: ["housing_supply", "construction", "median_rent"], budget: ["public_expenditure", "construction", "low_income_rent_burden"],
    transport: ["commute_burden"],
  }[component] || [];
  return { id, label, unit, type: "number", default: value, min, max, step, component, description,
    relevantMetrics,
    source: { ...source }, confidence: "low", date: source.date,
    boundary: "Illustrative metropolitan rental market; constant-dollar budgets, monthly stock-flow accounting.",
    uncertainty: { types: ["fixed", "uniform", "triangular", "normal"], default: { type: "fixed", value } },
  };
}

export const parameters = [
  parameter("initial_housing", "Initial housing stock", "homes", 1000000, 10000, 20000000, 10000, "stock", "Usable homes at year zero; includes vacant homes."),
  parameter("initial_households", "Initial households", "households", 960000, 1000, 22000000, 10000, "demand", "Households seeking homes at year zero; unmet demand is retained."),
  parameter("initial_rent", "Initial median monthly rent", "USD/month", 1800, 100, 15000, 50, "rents", "Illustrative starting monthly gross rent, not a measured local estimate."),
  parameter("initial_income", "Initial household income", "USD/year", 72000, 10000, 300000, 1000, "income", "Annual median household income; low-income households are modeled at 55% of this value."),
  parameter("population_growth", "Household formation / population growth", "fraction/year", 0.011, -0.03, 0.06, 0.001, "demand", "Household formation rate excluding net migration; fixed household size approximation."),
  parameter("migration", "Net migration", "fraction/year", 0.006, -0.05, 0.08, 0.001, "demand", "Additional proportional household growth from net migration."),
  parameter("wage_growth", "Real wage growth", "fraction/year", 0.012, -0.06, 0.08, 0.001, "income", "Real income trend; economic growth and unemployment also affect income."),
  parameter("economic_growth", "Real economic growth", "fraction/year", 0.02, -0.1, 0.1, 0.005, "economy", "Affects real income, development demand, and employment."),
  parameter("unemployment", "Unemployment rate", "fraction", 0.05, 0.01, 0.3, 0.005, "economy", "Starting labor-market stress; raises low-income rent burden and lowers development demand."),
  parameter("interest_rate", "Financing interest rate", "fraction/year", 0.045, 0, 0.2, 0.005, "finance", "Financing costs reduce feasible private starts; not an endogenous monetary model."),
  parameter("construction_cost", "Construction cost per home", "USD/home", 300000, 50000, 1500000, 10000, "construction", "Constant-dollar base construction cost; inflation erodes fixed nominal program purchasing power."),
  parameter("inflation", "Cost inflation", "fraction/year", 0.025, -0.02, 0.15, 0.005, "finance", "Construction cost inflation relative to fixed annual program appropriations; rent and income metrics remain in base-year dollars."),
  parameter("construction_capacity", "Annual construction capacity", "homes/year", 72000, 1000, 300000, 1000, "construction", "Physical maximum annual starts before labor, cost, and policy constraints."),
  parameter("construction_months", "Construction duration", "months", 18, 3, 60, 1, "construction", "Delay from permitted start to completion; projects remain in a tracked pipeline."),
  parameter("permitting_months", "Permitting delay", "months", 18, 0, 60, 1, "implementation", "Time in the permit queue; lowers approvals and delays completions."),
  parameter("zoning_density", "Allowed density multiplier", "multiplier", 1, 0.5, 3, 0.1, "land", "Land/zoning entitlement capacity relative to current policy; phase-in applies only to policy changes."),
  parameter("subsidy_amount", "Affordable construction appropriation", "USD/year", 0, 0, 10000000000, 100000000, "budget", "Annual public appropriation for a 35% construction cost contribution; only feasible starts draw funds."),
  parameter("voucher_funding", "Housing voucher appropriation", "USD/year", 0, 0, 10000000000, 100000000, "budget", "Annual rental assistance appropriation; capped at eligible households' rental costs."),
  parameter("adoption", "Policy adoption / compliance", "fraction", 0.8, 0, 1, 0.05, "implementation", "Fraction of policy changes implemented, after administrative resistance."),
  parameter("implementation_delay", "Policy implementation delay", "months", 4, 0, 60, 1, "implementation", "Delay before policy changes begin a 12-month phase-in; current-policy building continues."),
  parameter("resistance", "Administrative resistance", "fraction", 0.15, 0, 1, 0.05, "implementation", "Reduces delivered adoption and delays the phase-in of policy changes."),
  parameter("funding_delivery", "Budget delivered", "fraction", 1, 0, 1, 0.05, "budget", "Share of appropriations actually available; combines multiplicatively with stress cuts."),
  parameter("demolition_rate", "Annual housing loss", "fraction/year", 0.004, 0, 0.04, 0.001, "stock", "Fraction of existing homes lost each year to demolition or retirement."),
  parameter("rent_response", "Rent response to vacancy gap", "index", 0.8, 0.05, 2, 0.05, "rents", "Illustrative annual rent adjustment to vacancy shortfall; this behavioral coefficient requires local calibration."),
  parameter("transit_share", "New homes near transit", "fraction", 0.25, 0, 1, 0.05, "transport", "Share of new homes near transit; lowers a stylized commute burden index."),
];

function metric(id, label, unit, direction, description) {
  return { id, label, unit, type: "number", direction, better: direction, higherIsBetter: direction === "higher",
    description, source: { ...source }, confidence: "low", boundary: "Exploratory model output; not an observed forecast." };
}
export const metrics = [
  metric("housing_supply", "Housing supply", "homes", "higher", "Remaining usable housing stock after completions and demolition."),
  metric("median_rent", "Median monthly rent", "USD/month", "lower", "Base-year-dollar rent adjusted by vacancy pressure; excludes tenure and neighborhood variation."),
  metric("affordability", "Affordable income remaining", "percent", "higher", "100 minus median annual rent as a percentage of median household income; higher is better."),
  metric("homelessness_proxy", "Severe housing insecurity proxy", "households", "lower", "Unhoused demand plus a stylized severe rent-burden component; NOT a count or prediction of homelessness."),
  metric("displacement_risk", "Displacement risk proxy", "percent", "lower", "Stylized index from low-income rent burden and redevelopment pressure, not a displacement probability."),
  metric("construction", "Cumulative completed homes", "homes", "higher", "Homes delivered from initial and newly initiated development pipelines."),
  metric("public_expenditure", "Cumulative public expenditure", "USD", "lower", "Delivered construction contributions plus vouchers; excludes existing government spending and financing costs."),
  metric("employment", "Employment proxy", "jobs", "higher", "Employed household-equivalents plus construction job-years at 1.4 per annual start; not a labor-market forecast."),
  metric("commute_burden", "Commute burden index", "index", "lower", "Illustrative year-zero index 100 adjusted for transit access and housing shortages."),
  metric("tax_revenue", "Cumulative incremental tax proxy", "USD", "higher", "Stylized 1% annual tax on new housing value; not a fiscal revenue estimate."),
  metric("implementation_success", "Policy delivered", "percent", "higher", "Phase-in × adoption × (1 − resistance), expressed as percent."),
  metric("low_income_rent_burden", "Low-income net rent burden", "percent", "lower", "Annual rent less per-eligible-household voucher support divided by low-income household income."),
  metric("vacancy_rate", "Vacancy rate", "percent", "higher", "Unoccupied usable homes / housing stock; higher is preferable only within a housing-shortage interpretation."),
  metric("project_housing_units", "Specific-project homes completed", "homes", "higher", "Completed homes from approved interventions, separate from systemic starts."),
  metric("project_public_cost", "Specific-project public subsidy paid", "USD", "lower", "Actual cumulative project subsidy, not private development cost; fixed award caps apply."),
  metric("project_capacity_used", "Specific-project construction capacity used", "home-equivalents", "lower", "Cumulative shared capacity reserved during project construction; this reduces systemic starts."),
  metric("project_occupied_units", "Specific-project homes occupied", "homes", "higher", "Completed project homes occupied over a six-month modeled ramp."),
  metric("project_affordable_units", "Specific-project affordable homes completed", "homes", "higher", "Affordable units included within completed project homes, never additional stock."),
];

export const limitations = [
  "Synthetic illustrative metropolitan model, not empirically calibrated or a causal forecast. Default city values and behavioral coefficients are assumptions.",
  "Monthly housing stock-flow accounting with permit/construction queues; no household agents, geography, tenure, land prices, or spatial spillovers.",
  "Homelessness, displacement, employment, commute, and tax outputs are stylized proxies, not measured counts or estimated probabilities.",
  "Migration and household formation are exogenous; no migration response to cheaper housing. Density can increase available development but not physical construction capacity.",
  "Public spending is partial incremental program cost. Rent/income use base-year dollars; cost inflation changes purchasing power of fixed appropriations. No debt, discounting, or full public budget.",
  "Random shocks and uncertainty express model assumptions. Ensemble percentiles are scenario spread, not confidence intervals or validated predictive probabilities.",
  "Historical data must match geography, units, observation period, and availability cutoff. National vacancy data do not calibrate an illustrative city's local policy effects.",
  "Building project delays, overruns, cancellation, commercial home-equivalent capacity, and occupancy are synthetic assumptions. Project subsidy is a separate fixed award; private owners absorb overruns. Project-specific affordable units are recorded without a separate tenure/rent-control model.",
];

export const housingModel = {
  id: "housing.v1", version: "1.1.0", label: "Housing affordability · illustrative city", parameters, metrics, limitations,
  calibrated: false, empirical: false, timeStep: "month", boundary: "Metropolitan housing market, base-year dollars, incremental policy budget",
  supportsProjects: true, supportsScheduledStress: true,
  source, description: "Exploratory demand, construction-pipeline, budget, and rent stock-flow model.",
};
