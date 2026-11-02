const DOMAIN_METRICS = {
  housing: {
    keywords: ["housing", "rent", "zoning", "home", "apartment", "permit", "homeless"],
    metrics: [
      ["housing_units_permitted", "Housing units permitted", "count", "higher-is-better"],
      ["median_housing_cost", "Median housing cost", "currency", "lower-is-better"],
      ["housing_cost_burden", "Housing cost burden", "fraction", "lower-is-better"],
      ["homelessness_rate", "Homelessness rate", "fraction", "lower-is-better"],
      ["displacement_rate", "Displacement rate", "fraction", "lower-is-better"],
    ],
  },
  education: {
    keywords: ["school", "teacher", "student", "education", "class size", "graduation"],
    metrics: [
      ["graduation_rate", "Graduation rate", "fraction", "higher-is-better"],
      ["student_teacher_ratio", "Student / teacher ratio", "ratio", "lower-is-better"],
      ["teacher_retention", "Teacher retention", "fraction", "higher-is-better"],
      ["learning_outcome_index", "Learning outcome index", "index", "higher-is-better"],
    ],
  },
  health: {
    keywords: ["health", "hospital", "clinic", "insurance", "patient", "medical", "care"],
    metrics: [
      ["coverage_rate", "Coverage rate", "fraction", "higher-is-better"],
      ["care_wait_time", "Care wait time", "time", "lower-is-better"],
      ["preventable_mortality", "Preventable mortality", "rate", "lower-is-better"],
      ["provider_capacity", "Provider capacity", "index", "higher-is-better"],
    ],
  },
  transit: {
    keywords: ["transit", "bus", "rail", "commute", "transport", "mobility"],
    metrics: [
      ["transit_access", "Transit access", "fraction", "higher-is-better"],
      ["median_travel_time", "Median travel time", "time", "lower-is-better"],
      ["transit_reliability", "Transit reliability", "fraction", "higher-is-better"],
      ["ridership", "Ridership", "count", "higher-is-better"],
    ],
  },
  climate: {
    keywords: ["climate", "flood", "wildfire", "emission", "carbon", "heat", "hurricane", "resilience"],
    metrics: [
      ["emissions", "Emissions", "mass", "lower-is-better"],
      ["climate_risk", "Climate risk", "index", "lower-is-better"],
      ["infrastructure_resilience", "Infrastructure resilience", "index", "higher-is-better"],
      ["households_exposed", "Households exposed", "count", "lower-is-better"],
    ],
  },
  economy: {
    keywords: ["job", "employment", "wage", "income", "economy", "business", "cost of living"],
    metrics: [
      ["employment_rate", "Employment rate", "fraction", "higher-is-better"],
      ["median_income", "Median income", "currency", "higher-is-better"],
      ["cost_of_living", "Cost of living", "index", "lower-is-better"],
      ["business_formation", "Business formation", "count", "higher-is-better"],
    ],
  },
};

const GENERIC_METRICS = [
  ["implementation_viability", "Implementation viability", "index", "higher-is-better"],
  ["delivery_reliability", "Delivery reliability", "index", "higher-is-better"],
  ["political_durability", "Political durability", "index", "higher-is-better"],
  ["disruption_resilience", "Disruption resilience", "index", "higher-is-better"],
];

function idify(value) {
  return String(value || "metric")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "metric";
}

function labelify(value) {
  return String(value || "metric")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferDirection(id) {
  const value = id.toLowerCase();
  if (/(cost|price|burden|mortality|wait|delay|risk|emission|homeless|displacement|exposed|pollution|crime)/.test(value)) return "lower-is-better";
  if (/(rate|access|reliability|income|retention|capacity|units|ridership|employment|resilience|graduation)/.test(value)) return "higher-is-better";
  return "context-dependent";
}

function normalizeExplicitMetric(metric, index) {
  if (typeof metric === "string") {
    const id = idify(metric);
    return {
      id,
      label: labelify(metric),
      unit: "unspecified",
      direction: inferDirection(id),
      source: "dear-congress",
      weight: null,
    };
  }
  if (!metric || typeof metric !== "object") return null;
  const id = idify(metric.id || metric.key || metric.name || metric.label || `metric_${index + 1}`);
  return {
    id,
    label: String(metric.label || metric.name || metric.title || labelify(id)),
    unit: metric.unit || "unspecified",
    direction: metric.direction || metric.optimization || inferDirection(id),
    source: "dear-congress",
    weight: Number.isFinite(Number(metric.weight)) ? Number(metric.weight) : null,
    target: metric.target,
  };
}

function templateMetric(tuple, domain) {
  const [id, label, unit, direction] = tuple;
  return { id, label, unit, direction, domain, source: "domain-registry", weight: null };
}

export function detectMetricDomains(plan) {
  const text = JSON.stringify(plan || {}).toLowerCase();
  return Object.entries(DOMAIN_METRICS)
    .map(([domain, definition]) => ({
      domain,
      matches: definition.keywords.filter((keyword) => text.includes(keyword)),
    }))
    .filter((row) => row.matches.length > 0)
    .sort((a, b) => b.matches.length - a.matches.length || a.domain.localeCompare(b.domain));
}

export function deriveMetricRegistry(plan) {
  const registry = [];
  const seen = new Set();
  const add = (metric) => {
    if (!metric || seen.has(metric.id)) return;
    seen.add(metric.id);
    registry.push(metric);
  };

  const explicit = Array.isArray(plan?.metrics) ? plan.metrics : [];
  explicit.map(normalizeExplicitMetric).forEach(add);
  detectMetricDomains(plan).forEach(({ domain, matches }) => {
    DOMAIN_METRICS[domain].metrics.forEach((tuple) => add({ ...templateMetric(tuple, domain), evidence: matches }));
  });
  GENERIC_METRICS.forEach((tuple) => add(templateMetric(tuple, "implementation")));

  return registry;
}

export const __test = { DOMAIN_METRICS, inferDirection, idify, normalizeExplicitMetric };
