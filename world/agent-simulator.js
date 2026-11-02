import { deriveSeed } from "./world-generator.js";

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const round = (value, digits = 2) => Number(Number(value).toFixed(digits));
const n = (world, id, fallback = 0.5) => Number.isFinite(world?.normalized?.[id]) ? clamp01(world.normalized[id]) : fallback;

export function createAgentPopulation(world, options = {}) {
  const counts = {
    households: Math.max(10, Number(options.households || 500)),
    developers: Math.max(1, Number(options.developers || 40)),
    municipalities: Math.max(1, Number(options.municipalities || 12)),
    lenders: Math.max(1, Number(options.lenders || 8)),
    agencies: Math.max(1, Number(options.agencies || 5)),
  };
  const seed = deriveSeed(world?.seed ?? world?.id ?? 0, "agents");
  const random = mulberry32(seed);
  const build = (type, count, factory) => Array.from({ length: count }, (_, index) => ({ id: `${type}_${index + 1}`, type, ...factory(random, index) }));
  return {
    schemaVersion: "hbl-agent-population.v1",
    seed,
    counts,
    households: build("household", counts.households, (rng) => ({ resources: 0.2 + rng() * 0.75, mobility: rng(), riskTolerance: rng(), support: rng() })),
    developers: build("developer", counts.developers, (rng) => ({ capital: 0.2 + rng() * 0.8, riskTolerance: rng(), capacity: 0.25 + rng() * 0.75 })),
    municipalities: build("municipality", counts.municipalities, (rng) => ({ capacity: 0.3 + rng() * 0.7, cooperation: rng() })),
    lenders: build("lender", counts.lenders, (rng) => ({ riskTolerance: rng(), liquidity: 0.3 + rng() * 0.7 })),
    agencies: build("agency", counts.agencies, (rng) => ({ capacity: 0.35 + rng() * 0.65, execution: rng() })),
  };
}

function average(rows, field) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / rows.length;
}

export function simulateAgentCivicDynamics({ experiment, world, options = {} }) {
  const population = createAgentPopulation(world, options.agentPopulation || {});
  const horizon = Math.max(1, Math.round(Number(experiment?.experiment?.horizonYears || 10)));
  const timeline = [];
  const events = [];
  let cumulativeProjects = 0;
  let cumulativeHouseholdsSupported = 0;
  let support = n(world, "public_support", 0.55);

  for (let year = 1; year <= horizon; year += 1) {
    const agency = n(world, "agency_capacity", 0.6) * average(population.agencies, "capacity");
    const compliance = n(world, "local_compliance", 0.6) * average(population.municipalities, "cooperation");
    const finance = n(world, "credit_availability", 0.6) * (1 - n(world, "interest_rate", 0.4)) * average(population.lenders, "liquidity");
    const developerCapacity = average(population.developers, "capacity") * average(population.developers, "capital");
    const supplyFriction = (n(world, "permitting_delay_months", 0.4) + n(world, "construction_cost_change", 0.4)) / 2;
    const shock = n(world, "major_disruption_probability", 0.1) * n(world, "climate_stress", 0.2);
    const rollout = clamp01((year / horizon) * agency * compliance * n(world, "funding_delivery_rate", 0.75));
    const projects = Math.max(0, population.developers.length * developerCapacity * finance * rollout * (1 - supplyFriction) * (1 - shock));
    cumulativeProjects += projects;
    const householdNeed = 1 - average(population.households, "resources");
    const householdsSupported = projects * 8 * (0.5 + householdNeed);
    cumulativeHouseholdsSupported += householdsSupported;
    const delivery = clamp01((agency + compliance + finance + rollout) / 4);
    support = clamp01(support * 0.75 + delivery * 0.2 + (1 - shock) * 0.05);
    const score = clamp01(delivery * 0.45 + support * 0.25 + (1 - supplyFriction) * 0.2 + (1 - shock) * 0.1) * 100;
    if (year === 1 && rollout < 0.2) events.push({ year, type: "slow-rollout", severity: round(1 - rollout, 3) });
    if (shock > 0.25) events.push({ year, type: "agent-shock", severity: round(shock, 3) });
    if (projects > population.developers.length * 0.2 && !events.some((row) => row.type === "private-response")) events.push({ year, type: "private-response", severity: round(projects / population.developers.length, 3) });
    timeline.push({ year, score: round(score), rollout: round(rollout, 3), delivery: round(delivery, 3), support: round(support, 3), projectsStarted: round(projects), householdsSupported: round(householdsSupported) });
  }

  const final = timeline.at(-1) || {};
  const housingCost = round(100 * (1 + n(world, "demand_pressure", 0.5) * 0.12 - Math.min(0.18, cumulativeProjects / Math.max(1, population.households.length) * 0.02)), 2);
  return {
    score: final.score || 0,
    status: (final.score || 0) >= 70 ? "positive" : (final.score || 0) >= 45 ? "mixed" : "negative",
    metrics: {
      implementation_viability: final.score || 0,
      agent_projects_started: round(cumulativeProjects),
      households_supported: round(cumulativeHouseholdsSupported),
      public_support_proxy: round((final.support || 0) * 100),
      median_housing_cost: housingCost,
    },
    timeline,
    events,
    explanation: {
      positiveDrivers: ["agency execution", "municipal cooperation", "credit and developer capacity"],
      negativeDrivers: ["permitting/construction friction", "disruption risk"],
      agentCounts: population.counts,
    },
    model: { id: "hbl-agent-civic.v1", predictive: false, modelClass: "agent-based-exploratory", agentCounts: population.counts },
    disclaimer: "Exploratory agent-based scenario model. Synthetic agents are not real people and outputs are not empirical forecasts.",
  };
}
