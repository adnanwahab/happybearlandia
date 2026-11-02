/** An inspectable graph of implemented model equations, not an empirically
 * established causal network. IDs are stable links for Analysis and event replay.
 */
export const housingCausalRegistry = {
  id: "housing-causal-registry.v1", modelVersion: "1.2.0", empirical: false,
  equations: [
    { id: "household-demand", label: "Household formation and migration", expression: "households *= exp((population_growth + migration + demandInnovation) / 12)", source: "world/models/housing/index.js#simulateHousingRun", eventTypes: ["housing-shortage", "STRESS_PRESET_STARTED"] },
    { id: "income", label: "Household income", expression: "income *= exp((wage_growth + 0.2*(economic_growth-0.02) - 0.15*(unemployment-0.05))/12)", source: "world/models/housing/index.js#simulateHousingRun", eventTypes: ["STRESS_PRESET_STARTED"] },
    { id: "policy-delivery", label: "Policy phase-in", expression: "delivery = clamp((month-implementation_delay-resistance*6)/12,0,1)*adoption*(1-resistance)", source: "world/models/housing/index.js#simulateHousingRun", eventTypes: ["STRESS_PRESET_STARTED"] },
    { id: "private-starts", label: "Feasible development", expression: "starts <= residualCapacity * permitThroughput * density * exp(-7*(interest_rate-0.045)) * sqrt(300000/currentCost) * marketDemand", source: "world/models/housing/index.js#simulateHousingRun", eventTypes: ["capacity-bound"] },
    { id: "project-capacity", label: "Project work reserves shared capacity", expression: "systemicCapacity = totalCapacity - allocatedProjectHomeEquivalents", source: "world/buildings/lifecycle.js#createBuildingLifecycle", eventTypes: ["CONSTRUCTION_STARTED", "PROJECT_DELAYED", "PROJECT_CANCELLED"] },
    { id: "housing-stock", label: "Stock conservation", expression: "stock = priorStock - retiredHomes + systemicCompletions + projectCompletions", source: "world/models/housing/index.js#simulateHousingRun", eventTypes: ["PROJECT_COMPLETED", "annual-accounting"] },
    { id: "program-spending", label: "Actual public spending", expression: "publicExpenditure = constructionGrantsPaid + vouchersPaid + projectSubsidyPaid; projectAward capped", source: "world/models/housing/index.js#simulateHousingRun", eventTypes: ["COST_OVERRUN", "PROJECT_CANCELLED", "annual-accounting"] },
    { id: "rent-vacancy", label: "Vacancy pressure changes rent", expression: "rent *= exp((clamp(rent_response*(0.06-vacancy),-0.10,0.16)+0.12*(wage_growth+economic_growth-0.03))/12)", source: "world/models/housing/index.js#simulateHousingRun", eventTypes: ["housing-shortage", "annual-accounting"] },
    { id: "low-income-burden", label: "Low-income rent burden", expression: "12*max(0,rent-voucherPerMonth)/(income*0.55*(1-unemployment*0.4))", source: "world/models/housing/index.js#simulateHousingRun", eventTypes: ["annual-accounting"] },
  ],
  nodes: [], edges: [],
  limitation: "Edges describe programmed dependencies and synthetic coefficients. Use matched numerical reruns for effect size; the graph does not establish real-world policy effects.",
};
const links = [
  ["population_growth", "households", "household-demand"], ["migration", "households", "household-demand"], ["households", "vacancy_rate", "housing-stock"],
  ["wage_growth", "income", "income"], ["economic_growth", "income", "income"], ["unemployment", "income", "income"],
  ["adoption", "implementation_success", "policy-delivery"], ["resistance", "implementation_success", "policy-delivery"], ["implementation_delay", "implementation_success", "policy-delivery"],
  ["interest_rate", "construction", "private-starts"], ["construction_cost", "construction", "private-starts"], ["inflation", "construction", "private-starts"],
  ["permitting_months", "construction", "private-starts"], ["zoning_density", "construction", "private-starts"], ["construction_capacity", "construction", "private-starts"],
  ["projects", "construction", "project-capacity"], ["construction", "housing_supply", "housing-stock"], ["construction_months", "housing_supply", "housing-stock"], ["demolition_rate", "housing_supply", "housing-stock"],
  ["housing_supply", "vacancy_rate", "housing-stock"], ["vacancy_rate", "median_rent", "rent-vacancy"], ["rent_response", "median_rent", "rent-vacancy"],
  ["subsidy_amount", "public_expenditure", "program-spending"], ["funding_delivery", "public_expenditure", "program-spending"], ["voucher_funding", "low_income_rent_burden", "low-income-burden"],
  ["median_rent", "low_income_rent_burden", "low-income-burden"], ["income", "low_income_rent_burden", "low-income-burden"],
];
housingCausalRegistry.edges = links.map(([from, to, equationId]) => ({ id: `${from}-${to}`, from, to, source: from, target: to, equationId,
  eventTypes: housingCausalRegistry.equations.find((equation) => equation.id === equationId).eventTypes, interpretation: "implemented model dependency" }));
housingCausalRegistry.nodes = [...new Set(links.flatMap(([from, to]) => [from, to]))].map((id) => ({ id, label: id.replace(/_/g, " "), kind: links.some(([from]) => from === id) && !links.some(([, to]) => to === id) ? "input" : "state-or-metric" }));
