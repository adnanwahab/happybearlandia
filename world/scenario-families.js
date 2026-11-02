const DEFAULT_FAMILIES = [
  {
    id: "baseline",
    label: "Baseline",
    description: "Ordinary variation around the reviewed assumptions without a dominant macro shock.",
    weight: 0.34,
    shifts: {},
  },
  {
    id: "boom",
    label: "Boom",
    description: "Strong growth, easy financing, labor demand, migration, and private investment reinforce one another.",
    weight: 0.11,
    shifts: {
      economic_growth: 0.30,
      unemployment_rate: -0.22,
      credit_availability: 0.22,
      interest_rate: -0.08,
      migration_rate: 0.12,
      private_sector_response: 0.20,
      public_support: 0.08,
      funding_delivery_rate: 0.06,
    },
  },
  {
    id: "bottleneck",
    label: "Bottleneck",
    description: "Demand remains strong while permitting, labor, land, infrastructure, and construction costs constrain delivery.",
    weight: 0.12,
    shifts: {
      population_growth: 0.12,
      migration_rate: 0.18,
      labor_availability: -0.25,
      permitting_delay_months: 0.28,
      construction_cost_change: 0.28,
      land_availability: -0.16,
      infrastructure_capacity: -0.14,
      private_sector_response: -0.08,
    },
  },
  {
    id: "recession",
    label: "Recession",
    description: "Weak growth, unemployment, tighter credit, softer investment, and budget pressure arrive together.",
    weight: 0.12,
    shifts: {
      economic_growth: -0.34,
      unemployment_rate: 0.30,
      credit_availability: -0.26,
      private_sector_response: -0.22,
      funding_delivery_rate: -0.12,
      public_support: -0.08,
      migration_rate: -0.08,
    },
  },
  {
    id: "political_reversal",
    label: "Political reversal",
    description: "Leadership turnover, polarization, falling trust, and weaker compliance interrupt implementation continuity.",
    weight: 0.09,
    shifts: {
      political_turnover_probability: 0.30,
      polarization: 0.28,
      public_trust: -0.24,
      public_support: -0.20,
      local_compliance: -0.18,
      enforcement_rate: -0.10,
      implementation_delay_months: 0.18,
    },
  },
  {
    id: "technology_surprise",
    label: "Technology surprise",
    description: "Relevant technology improves faster than expected and lowers delivery friction while strengthening private response.",
    weight: 0.08,
    shifts: {
      technology_improvement: 0.38,
      construction_cost_change: -0.16,
      labor_availability: 0.10,
      private_sector_response: 0.18,
      infrastructure_capacity: 0.08,
      implementation_delay_months: -0.10,
    },
  },
  {
    id: "climate_disruption",
    label: "Climate disruption",
    description: "Climate stress, disruption risk, migration pressure, and infrastructure strain rise together.",
    weight: 0.07,
    shifts: {
      climate_stress: 0.32,
      major_disruption_probability: 0.24,
      external_shock_probability: 0.18,
      migration_rate: 0.16,
      infrastructure_capacity: -0.18,
      construction_cost_change: 0.14,
      public_support: -0.05,
    },
  },
  {
    id: "high_cooperation",
    label: "High cooperation",
    description: "Trust, public support, community cohesion, compliance, and delivery capacity reinforce implementation.",
    weight: 0.07,
    shifts: {
      public_trust: 0.28,
      community_cohesion: 0.28,
      public_support: 0.22,
      local_compliance: 0.22,
      agency_capacity: 0.14,
      funding_delivery_rate: 0.10,
      enforcement_rate: 0.08,
      polarization: -0.18,
    },
  },
];

export const CORRELATION_FACTORS = {
  macro: {
    economic_growth: 0.24,
    unemployment_rate: -0.22,
    credit_availability: 0.18,
    private_sector_response: 0.15,
    public_support: 0.07,
  },
  finance: {
    interest_rate: -0.18,
    credit_availability: 0.20,
    construction_cost_change: -0.08,
    private_sector_response: 0.10,
  },
  implementation: {
    agency_capacity: 0.22,
    funding_delivery_rate: 0.20,
    local_compliance: 0.17,
    enforcement_rate: 0.15,
    implementation_delay_months: -0.20,
    permitting_delay_months: -0.12,
  },
  social: {
    public_support: 0.19,
    public_trust: 0.22,
    community_cohesion: 0.20,
    polarization: -0.20,
    citizen_behavior_change: 0.12,
  },
  supply: {
    labor_availability: 0.18,
    land_availability: 0.14,
    infrastructure_capacity: 0.18,
    permitting_delay_months: -0.18,
    construction_cost_change: -0.16,
    private_sector_response: 0.10,
  },
  technology: {
    technology_improvement: 0.28,
    private_sector_response: 0.12,
    construction_cost_change: -0.10,
    infrastructure_capacity: 0.08,
  },
  climate: {
    climate_stress: 0.25,
    major_disruption_probability: 0.16,
    external_shock_probability: 0.12,
    infrastructure_capacity: -0.12,
    construction_cost_change: 0.08,
  },
};

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sanitizeFamily(raw, index, variableIds) {
  const family = isObject(raw) ? raw : {};
  const shifts = {};
  for (const [id, amount] of Object.entries(isObject(family.shifts) ? family.shifts : {})) {
    if (variableIds.has(id) && Number.isFinite(Number(amount))) shifts[id] = Math.max(-0.75, Math.min(0.75, Number(amount)));
  }
  return {
    id: typeof family.id === "string" && family.id.trim() ? family.id.trim() : `scenario_${index + 1}`,
    label: typeof family.label === "string" && family.label.trim() ? family.label.trim() : `Scenario ${index + 1}`,
    description: typeof family.description === "string" ? family.description : "Scenario family.",
    weight: Math.max(0, finite(family.weight, 1)),
    shifts,
  };
}

export function deriveScenarioFamilies(variables = [], configuredFamilies = []) {
  const variableIds = new Set((variables || []).map((variable) => variable?.id).filter(Boolean));
  const source = Array.isArray(configuredFamilies) && configuredFamilies.length ? configuredFamilies : DEFAULT_FAMILIES;
  const families = source.map((family, index) => sanitizeFamily(family, index, variableIds)).filter((family) => family.weight > 0);
  const total = families.reduce((sum, family) => sum + family.weight, 0) || 1;
  return families.map((family) => ({ ...family, weight: family.weight / total }));
}

export function selectScenarioFamily(families, unitRandom) {
  const rows = Array.isArray(families) && families.length ? families : [{ id: "baseline", label: "Baseline", description: "Baseline", weight: 1, shifts: {} }];
  const target = Math.max(0, Math.min(0.999999999, finite(unitRandom, 0.5)));
  let cursor = 0;
  for (const family of rows) {
    cursor += finite(family.weight, 0);
    if (target < cursor) return family;
  }
  return rows[rows.length - 1];
}

export function factorLoadingsFor(variableId) {
  const loadings = {};
  for (const [factor, variables] of Object.entries(CORRELATION_FACTORS)) {
    const loading = Number(variables[variableId]);
    if (Number.isFinite(loading) && loading !== 0) loadings[factor] = loading;
  }
  return loadings;
}

export function correlationOffset(variableId, factors = {}) {
  let offset = 0;
  for (const [factor, loading] of Object.entries(factorLoadingsFor(variableId))) {
    offset += finite(factors[factor], 0) * loading;
  }
  return offset;
}

export function scenarioShift(family, variableId) {
  return finite(family?.shifts?.[variableId], 0);
}

export const __test = { DEFAULT_FAMILIES, sanitizeFamily };
