const CORE_IDS = new Set([
  "agency_capacity",
  "funding_delivery_rate",
  "local_compliance",
  "enforcement_rate",
  "implementation_delay_months",
  "public_support",
  "external_shock_probability"
]);

const TEMPLATES = [
  {
    id: "agency_capacity", category: "government", label: "Agency capacity",
    description: "Ability of responsible agencies to staff, coordinate, administer, and deliver the plan.",
    unit: "index", baseline: 0.70, min: 0.30, max: 1.00,
    always: true
  },
  {
    id: "funding_delivery_rate", category: "implementation", label: "Funding delivered",
    description: "Share of planned funding that arrives on time and can actually be used.",
    unit: "fraction", baseline: 0.90, min: 0.45, max: 1.00,
    always: true
  },
  {
    id: "local_compliance", category: "implementation", label: "Local compliance",
    description: "Degree to which local implementers comply with the plan as intended.",
    unit: "fraction", baseline: 0.72, min: 0.25, max: 1.00,
    always: true
  },
  {
    id: "enforcement_rate", category: "implementation", label: "Enforcement rate",
    description: "How consistently the plan's rules and requirements are enforced.",
    unit: "fraction", baseline: 0.75, min: 0.30, max: 1.00,
    always: true
  },
  {
    id: "implementation_delay_months", category: "timing", label: "Implementation delay",
    description: "Delay between adoption and meaningful implementation.",
    unit: "months", baseline: 6, min: 0, max: 30,
    always: true
  },
  {
    id: "public_support", category: "politics", label: "Public support",
    description: "Public support for the plan during implementation.",
    unit: "fraction", baseline: 0.60, min: 0.20, max: 0.95,
    always: true
  },
  {
    id: "external_shock_probability", category: "shocks", label: "External shock probability",
    description: "Annual probability of a material external disruption affecting the plan.",
    unit: "probability/year", baseline: 0.10, min: 0.02, max: 0.30,
    always: true
  },

  {
    id: "economic_growth", category: "economy", label: "Economic growth",
    description: "Annual real economic growth relevant to demand, revenue, and household conditions.",
    unit: "fraction/year", baseline: 0.02, min: -0.04, max: 0.06,
    keywords: ["economy", "economic", "gdp", "growth", "jobs", "business", "revenue", "wage", "income"]
  },
  {
    id: "inflation_rate", category: "economy", label: "Inflation",
    description: "Annual change in the general price level.",
    unit: "fraction/year", baseline: 0.025, min: 0.00, max: 0.10,
    keywords: ["inflation", "cost of living", "prices", "affordability", "rent", "wages", "budget"]
  },
  {
    id: "interest_rate", category: "finance", label: "Interest rate",
    description: "Financing conditions affecting borrowing, investment, construction, and debt service.",
    unit: "fraction/year", baseline: 0.05, min: 0.01, max: 0.12,
    keywords: ["interest", "mortgage", "loan", "credit", "finance", "debt", "housing", "construction", "developer", "investment"]
  },
  {
    id: "credit_availability", category: "finance", label: "Credit availability",
    description: "Availability of financing to households, firms, and project developers.",
    unit: "index", baseline: 0.65, min: 0.20, max: 1.00,
    keywords: ["credit", "loan", "mortgage", "finance", "developer", "small business", "investment", "capital"]
  },
  {
    id: "unemployment_rate", category: "economy", label: "Unemployment",
    description: "Share of the labor force without work.",
    unit: "fraction", baseline: 0.05, min: 0.02, max: 0.15,
    keywords: ["jobs", "job", "employment", "unemployment", "workforce", "labor", "wage", "income"]
  },
  {
    id: "population_growth", category: "demographics", label: "Population growth",
    description: "Annual population change that affects demand and service load.",
    unit: "fraction/year", baseline: 0.01, min: -0.02, max: 0.05,
    keywords: ["population", "housing", "school", "healthcare", "transit", "city", "county", "regional", "neighborhood"]
  },
  {
    id: "migration_rate", category: "demographics", label: "Net migration",
    description: "Net migration pressure into or out of the affected area.",
    unit: "fraction/year", baseline: 0.005, min: -0.04, max: 0.06,
    keywords: ["migration", "immigration", "housing", "city", "regional", "neighborhood", "population", "refugee"]
  },
  {
    id: "household_size", category: "demographics", label: "Household size",
    description: "Average household size, which changes per-capita demand for housing and services.",
    unit: "people/household", baseline: 2.5, min: 1.8, max: 4.0,
    keywords: ["housing", "household", "family", "childcare", "rent", "home"]
  },
  {
    id: "construction_cost_change", category: "construction", label: "Construction cost change",
    description: "Change in labor, material, financing, and project delivery costs.",
    unit: "fraction", baseline: 0.00, min: -0.20, max: 0.35,
    keywords: ["housing", "construction", "build", "building", "infrastructure", "transit", "road", "school", "hospital", "development"]
  },
  {
    id: "labor_availability", category: "labor", label: "Labor availability",
    description: "Availability of workers needed to implement the plan.",
    unit: "index", baseline: 0.70, min: 0.25, max: 1.00,
    keywords: ["labor", "workforce", "staff", "staffing", "teacher", "nurse", "doctor", "construction", "worker", "hiring"]
  },
  {
    id: "permitting_delay_months", category: "government", label: "Permitting delay",
    description: "Time required for permits, approvals, reviews, and related administrative gates.",
    unit: "months", baseline: 8, min: 1, max: 36,
    keywords: ["permit", "permitting", "zoning", "construction", "housing", "development", "approval", "review"]
  },
  {
    id: "land_availability", category: "geography", label: "Land availability",
    description: "Availability of suitable land at locations where the plan needs it.",
    unit: "index", baseline: 0.55, min: 0.10, max: 0.95,
    keywords: ["land", "housing", "zoning", "development", "density", "transit-oriented", "build"]
  },
  {
    id: "infrastructure_capacity", category: "infrastructure", label: "Infrastructure capacity",
    description: "Available capacity in transport, water, power, schools, broadband, or other supporting systems.",
    unit: "index", baseline: 0.70, min: 0.25, max: 1.00,
    keywords: ["infrastructure", "transit", "road", "water", "electric", "electricity", "grid", "school", "broadband", "sewer", "hospital"]
  },
  {
    id: "technology_improvement", category: "technology", label: "Technology improvement",
    description: "Rate at which relevant technology improves cost, speed, quality, or capacity.",
    unit: "index", baseline: 0.50, min: 0.10, max: 1.00,
    keywords: ["technology", "automation", "ai", "software", "digital", "modular", "innovation", "robot", "new materials"]
  },
  {
    id: "citizen_behavior_change", category: "behavior", label: "Citizen behavior change",
    description: "Degree to which residents change behavior in response to the intervention.",
    unit: "fraction", baseline: 0.45, min: 0.05, max: 0.95,
    keywords: ["behavior", "adoption", "participation", "resident", "citizen", "incentive", "ridership", "recycling", "voluntary"]
  },
  {
    id: "private_sector_response", category: "behavior", label: "Private-sector response",
    description: "Strength and direction of business, investor, developer, employer, or landlord response.",
    unit: "index", baseline: 0.55, min: 0.05, max: 1.00,
    keywords: ["developer", "business", "employer", "landlord", "investor", "market", "private", "industry", "supplier"]
  },
  {
    id: "political_turnover_probability", category: "politics", label: "Political turnover probability",
    description: "Annual chance that elections or leadership changes materially alter implementation.",
    unit: "probability/year", baseline: 0.12, min: 0.02, max: 0.35,
    keywords: ["election", "political", "legislature", "congress", "mayor", "governor", "administration", "leadership"]
  },
  {
    id: "polarization", category: "politics", label: "Political polarization",
    description: "Degree of polarization surrounding the plan and related institutions.",
    unit: "index", baseline: 0.50, min: 0.10, max: 0.95,
    keywords: ["polarization", "partisan", "political", "election", "opposition", "controversial"]
  },
  {
    id: "public_trust", category: "social", label: "Public trust",
    description: "Trust in the institutions and actors implementing the plan.",
    unit: "index", baseline: 0.55, min: 0.15, max: 0.90,
    keywords: ["trust", "community", "public", "government", "institution", "participation", "democracy"]
  },
  {
    id: "inequality", category: "social", label: "Inequality",
    description: "Distributional inequality that can change who benefits, who bears costs, and who can adapt.",
    unit: "index", baseline: 0.50, min: 0.15, max: 0.90,
    keywords: ["inequality", "poverty", "affordability", "low-income", "income", "wealth", "equity", "rent"]
  },
  {
    id: "community_cohesion", category: "social", label: "Community cohesion",
    description: "Strength of local cooperation, mutual support, and coordination.",
    unit: "index", baseline: 0.60, min: 0.15, max: 0.95,
    keywords: ["community", "neighborhood", "cooperation", "social", "belonging", "local"]
  },
  {
    id: "media_sentiment", category: "information", label: "Media sentiment",
    description: "Information environment around the plan, from strongly negative to strongly positive.",
    unit: "index", baseline: 0.00, min: -1.00, max: 1.00,
    keywords: ["media", "misinformation", "information", "awareness", "campaign", "communication", "news"]
  },
  {
    id: "climate_stress", category: "environment", label: "Climate stress",
    description: "Background climate stress affecting people, infrastructure, insurance, and operating costs.",
    unit: "index", baseline: 0.35, min: 0.05, max: 0.90,
    keywords: ["climate", "heat", "flood", "wildfire", "storm", "hurricane", "drought", "insurance", "resilience"]
  },
  {
    id: "major_disruption_probability", category: "shocks", label: "Major disruption probability",
    description: "Annual chance of a domain-specific severe disruption beyond ordinary variation.",
    unit: "probability/year", baseline: 0.04, min: 0.005, max: 0.15,
    keywords: ["pandemic", "war", "recession", "disaster", "hurricane", "wildfire", "flood", "supply chain", "energy shock"]
  }
];

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function textOf(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (isObject(value)) return Object.values(value).map(textOf).join(" ");
  return "";
}

function matchesTemplate(template, haystack) {
  if (template.always) return { matched: true, evidence: ["core implementation variable"] };
  const evidence = (template.keywords || []).filter((keyword) => haystack.includes(keyword.toLowerCase()));
  return { matched: evidence.length > 0, evidence: evidence.slice(0, 6) };
}

function triangular(min, mode, max) {
  return { type: "triangular", min, mode, max };
}

function normalizeOverrides(overrides) {
  if (Array.isArray(overrides)) {
    return Object.fromEntries(overrides.filter(isObject).filter((row) => typeof row.id === "string").map((row) => [row.id, row]));
  }
  return isObject(overrides) ? overrides : {};
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyOverride(variable, rawOverride) {
  if (!isObject(rawOverride)) return variable;
  const override = rawOverride;
  const range = isObject(override.range) ? override.range : {};
  const minCandidate = Number.isFinite(Number(range.min ?? override.min)) ? Number(range.min ?? override.min) : variable.range.min;
  const maxCandidate = Number.isFinite(Number(range.max ?? override.max)) ? Number(range.max ?? override.max) : variable.range.max;
  const min = Math.min(minCandidate, maxCandidate);
  const max = Math.max(minCandidate, maxCandidate);
  const baselineCandidate = Number.isFinite(Number(override.baseline)) ? Number(override.baseline) : variable.baseline;
  const baseline = clamp(baselineCandidate, min, max);

  return {
    ...variable,
    baseline,
    range: { min, max },
    distribution: triangular(min, baseline, max),
    locked: typeof override.locked === "boolean" ? override.locked : variable.locked,
    source: "user-override",
    confidence: 1,
    reason: typeof override.reason === "string" && override.reason.trim() ? override.reason.trim() : variable.reason,
  };
}

function createVariable(template, evidence) {
  const confidence = template.always ? 0.55 : Math.min(0.75, 0.35 + evidence.length * 0.08);
  return {
    id: template.id,
    category: template.category,
    label: template.label,
    description: template.description,
    kind: "continuous",
    unit: template.unit,
    baseline: template.baseline,
    range: { min: template.min, max: template.max },
    distribution: triangular(template.min, template.baseline, template.max),
    confidence,
    source: "heuristic-default",
    evidence,
    reason: template.always
      ? "Included in every civic simulation because implementation quality and shocks can change outcomes."
      : `Included because the plan mentions: ${evidence.join(", ")}.`,
    locked: false,
  };
}

export function extractSimulationParameters(plan, overrides = {}) {
  const haystack = textOf(plan).toLowerCase();
  const overrideMap = normalizeOverrides(overrides);
  const variables = [];

  for (const template of TEMPLATES) {
    const { matched, evidence } = matchesTemplate(template, haystack);
    if (!matched && !Object.prototype.hasOwnProperty.call(overrideMap, template.id)) continue;
    const variable = createVariable(template, evidence);
    variables.push(applyOverride(variable, overrideMap[template.id]));
  }

  // Preserve user-defined variables even when they are not in the built-in catalog.
  for (const [id, raw] of Object.entries(overrideMap)) {
    if (variables.some((variable) => variable.id === id) || !isObject(raw)) continue;
    const min = Number.isFinite(Number(raw.min ?? raw.range?.min)) ? Number(raw.min ?? raw.range?.min) : 0;
    const max = Number.isFinite(Number(raw.max ?? raw.range?.max)) ? Number(raw.max ?? raw.range?.max) : 1;
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    const baseline = clamp(Number.isFinite(Number(raw.baseline)) ? Number(raw.baseline) : (low + high) / 2, low, high);
    variables.push({
      id,
      category: typeof raw.category === "string" ? raw.category : "custom",
      label: typeof raw.label === "string" ? raw.label : id.replace(/[-_]+/g, " "),
      description: typeof raw.description === "string" ? raw.description : "User-defined simulation variable.",
      kind: "continuous",
      unit: typeof raw.unit === "string" ? raw.unit : "index",
      baseline,
      range: { min: low, max: high },
      distribution: triangular(low, baseline, high),
      confidence: 1,
      source: "user-override",
      evidence: [],
      reason: typeof raw.reason === "string" ? raw.reason : "Explicitly supplied by the user.",
      locked: Boolean(raw.locked),
    });
  }

  return variables;
}

export function summarizeParameterExtraction(variables) {
  const categories = {};
  for (const variable of variables) categories[variable.category] = (categories[variable.category] || 0) + 1;
  return {
    strategy: "deterministic-keyword-v1",
    variableCount: variables.length,
    coreVariableCount: variables.filter((variable) => CORE_IDS.has(variable.id)).length,
    categories,
    editable: true,
    defaultsAreEmpirical: false,
    warning: "Baselines and ranges are modeling assumptions, not measured forecasts. Review or override them before treating simulation output as decision evidence."
  };
}

export const __test = { TEMPLATES, CORE_IDS, textOf, normalizeOverrides };
