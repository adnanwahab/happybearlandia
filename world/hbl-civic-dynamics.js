function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function mean(values, fallback = 0.5) {
  const rows = values.filter((value) => Number.isFinite(value));
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : fallback;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(finite(value) * factor) / factor;
}

function hashString(value) {
  let hash = 0x811c9dc5;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function deterministicUnit(...parts) {
  return hashString(parts.join("\u241f")) / 0xffffffff;
}

function normalized(world, id, fallback = 0.5) {
  const value = world?.normalized?.[id];
  return Number.isFinite(value) ? clamp01(value) : fallback;
}

function condition(world, id, fallback = 0) {
  return finite(world?.conditions?.[id], fallback);
}

function good(world, id, fallback = 0.5) {
  return normalized(world, id, fallback);
}

function bad(world, id, fallback = 0.5) {
  return 1 - normalized(world, id, fallback);
}

function statusFor(score) {
  if (score >= 70) return "positive";
  if (score >= 45) return "mixed";
  return "negative";
}

const METRIC_BASELINES = {
  housing_units_permitted: { value: 10000, sensitivity: 1.15, floor: 0 },
  median_housing_cost: { value: 100, sensitivity: 0.25, floor: 25 },
  housing_cost_burden: { value: 0.31, sensitivity: 0.28, floor: 0.05, ceiling: 0.8 },
  homelessness_rate: { value: 0.006, sensitivity: 0.45, floor: 0.0005, ceiling: 0.03 },
  displacement_rate: { value: 0.03, sensitivity: 0.35, floor: 0.002, ceiling: 0.15 },

  graduation_rate: { value: 0.82, sensitivity: 0.14, floor: 0.3, ceiling: 0.99 },
  student_teacher_ratio: { value: 16, sensitivity: 0.18, floor: 8, ceiling: 35 },
  teacher_retention: { value: 0.84, sensitivity: 0.13, floor: 0.4, ceiling: 0.99 },
  learning_outcome_index: { value: 100, sensitivity: 0.22, floor: 50 },

  coverage_rate: { value: 0.90, sensitivity: 0.10, floor: 0.4, ceiling: 0.995 },
  care_wait_time: { value: 21, sensitivity: 0.30, floor: 2, ceiling: 120 },
  preventable_mortality: { value: 150, sensitivity: 0.24, floor: 20, ceiling: 500 },
  provider_capacity: { value: 100, sensitivity: 0.28, floor: 30 },

  transit_access: { value: 0.56, sensitivity: 0.32, floor: 0.05, ceiling: 0.98 },
  median_travel_time: { value: 31, sensitivity: 0.22, floor: 8, ceiling: 90 },
  transit_reliability: { value: 0.76, sensitivity: 0.22, floor: 0.2, ceiling: 0.99 },
  ridership: { value: 100, sensitivity: 0.42, floor: 20 },

  emissions: { value: 100, sensitivity: 0.28, floor: 20 },
  climate_risk: { value: 100, sensitivity: 0.25, floor: 20 },
  infrastructure_resilience: { value: 100, sensitivity: 0.32, floor: 25 },
  households_exposed: { value: 100000, sensitivity: 0.30, floor: 1000 },

  employment_rate: { value: 0.95, sensitivity: 0.05, floor: 0.6, ceiling: 0.995 },
  median_income: { value: 65000, sensitivity: 0.18, floor: 15000 },
  cost_of_living: { value: 100, sensitivity: 0.18, floor: 45 },
  business_formation: { value: 100, sensitivity: 0.35, floor: 15 },

  implementation_viability: { value: 50, sensitivity: 0.90, floor: 0, ceiling: 100 },
  delivery_reliability: { value: 50, sensitivity: 0.90, floor: 0, ceiling: 100 },
  political_durability: { value: 50, sensitivity: 0.90, floor: 0, ceiling: 100 },
  disruption_resilience: { value: 50, sensitivity: 0.90, floor: 0, ceiling: 100 },
};

const DOMAIN_WEIGHTS = {
  implementation: {
    delivery: 0.55,
    political: 0.25,
    resilience: 0.20,
  },
  housing: {
    delivery: 0.28,
    supply: 0.30,
    infrastructure: 0.12,
    privateResponse: 0.12,
    technology: 0.08,
    demandPenalty: -0.12,
    financePenalty: -0.12,
    costPenalty: -0.09,
    disruptionPenalty: -0.13,
  },
  education: {
    delivery: 0.34,
    labor: 0.24,
    infrastructure: 0.16,
    support: 0.14,
    cohesion: 0.08,
    inequalityPenalty: -0.08,
    disruptionPenalty: -0.12,
  },
  health: {
    delivery: 0.28,
    labor: 0.22,
    infrastructure: 0.18,
    technology: 0.14,
    support: 0.08,
    inequalityPenalty: -0.08,
    climatePenalty: -0.08,
    disruptionPenalty: -0.12,
  },
  transit: {
    delivery: 0.27,
    infrastructure: 0.26,
    behavior: 0.18,
    technology: 0.12,
    labor: 0.09,
    costPenalty: -0.08,
    disruptionPenalty: -0.12,
  },
  climate: {
    delivery: 0.26,
    infrastructure: 0.27,
    technology: 0.19,
    cohesion: 0.10,
    support: 0.08,
    climatePenalty: -0.16,
    disruptionPenalty: -0.12,
  },
  economy: {
    delivery: 0.18,
    growth: 0.20,
    credit: 0.13,
    privateResponse: 0.16,
    technology: 0.10,
    labor: 0.10,
    unemploymentPenalty: -0.10,
    inflationPenalty: -0.08,
    disruptionPenalty: -0.12,
  },
};

function planIntensity(experiment) {
  const actions = experiment?.plan?.actions?.length || 0;
  const goals = experiment?.plan?.goals?.length || 0;
  const explicitMetrics = experiment?.plan?.metrics?.length || 0;
  const raw = 0.38 + Math.min(0.34, Math.log2(actions + 1) * 0.11) + Math.min(0.16, goals * 0.035) + Math.min(0.08, explicitMetrics * 0.02);
  return clamp(raw, 0.35, 0.92);
}

function metricDomain(metric) {
  return metric?.domain || "implementation";
}

function metricBaseline(metric) {
  const configured = METRIC_BASELINES[metric.id];
  if (configured) return configured;
  if (metric.unit === "fraction" || metric.unit === "probability") return { value: 0.5, sensitivity: 0.25, floor: 0, ceiling: 1 };
  if (metric.unit === "count") return { value: 100, sensitivity: 0.35, floor: 0 };
  if (metric.unit === "currency") return { value: 100, sensitivity: 0.20, floor: 1 };
  if (metric.unit === "time") return { value: 30, sensitivity: 0.25, floor: 0 };
  return { value: 100, sensitivity: 0.25, floor: 0 };
}

function applyImprovementToMetric(metric, improvement) {
  const baseline = metricBaseline(metric);
  const direction = metric.direction || "context-dependent";
  const sign = direction === "lower-is-better" ? -1 : 1;
  const factor = 1 + sign * clamp(improvement, -1, 1) * baseline.sensitivity;
  return round(clamp(baseline.value * factor, baseline.floor ?? -Infinity, baseline.ceiling ?? Infinity), 6);
}

function driverRows(world) {
  return [
    ["agency capacity", good(world, "agency_capacity", 0.6) - 0.5],
    ["funding delivery", good(world, "funding_delivery_rate", 0.7) - 0.5],
    ["local compliance", good(world, "local_compliance", 0.6) - 0.5],
    ["public support", good(world, "public_support", 0.55) - 0.5],
    ["labor availability", good(world, "labor_availability", 0.6) - 0.5],
    ["infrastructure capacity", good(world, "infrastructure_capacity", 0.6) - 0.5],
    ["technology improvement", good(world, "technology_improvement", 0.5) - 0.5],
    ["private-sector response", good(world, "private_sector_response", 0.5) - 0.5],
    ["public trust", good(world, "public_trust", 0.5) - 0.5],
    ["implementation delay", -(normalized(world, "implementation_delay_months", 0.2) - 0.5)],
    ["financing costs", -(normalized(world, "interest_rate", 0.4) - 0.5)],
    ["inflation", -(normalized(world, "inflation_rate", 0.3) - 0.5)],
    ["unemployment", -(normalized(world, "unemployment_rate", 0.3) - 0.5)],
    ["polarization", -(normalized(world, "polarization", 0.4) - 0.5)],
    ["climate stress", -(normalized(world, "climate_stress", 0.3) - 0.5)],
    ["construction cost pressure", -(normalized(world, "construction_cost_change", 0.4) - 0.5)],
  ].map(([label, effect]) => ({ label, effect: round(effect, 4) }));
}

function staticContext(world) {
  const deliveryCapacity = mean([
    good(world, "agency_capacity", 0.65),
    good(world, "funding_delivery_rate", 0.75),
    good(world, "local_compliance", 0.6),
    good(world, "enforcement_rate", 0.65),
    good(world, "labor_availability", 0.6),
  ]);
  const politicalDurability = mean([
    good(world, "public_support", 0.55),
    bad(world, "political_turnover_probability", 0.55),
    bad(world, "polarization", 0.55),
    good(world, "public_trust", 0.55),
  ]);
  const financePressure = mean([
    normalized(world, "interest_rate", 0.4),
    normalized(world, "inflation_rate", 0.3),
    bad(world, "credit_availability", 0.4),
  ]);
  const demandPressure = mean([
    normalized(world, "population_growth", 0.5),
    normalized(world, "migration_rate", 0.5),
    normalized(world, "household_size", 0.45),
  ]);
  return {
    deliveryCapacity,
    politicalDurability,
    financePressure,
    demandPressure,
    supply: mean([
      good(world, "land_availability", 0.55),
      bad(world, "permitting_delay_months", 0.55),
      good(world, "labor_availability", 0.6),
    ]),
    infrastructure: good(world, "infrastructure_capacity", 0.6),
    technology: good(world, "technology_improvement", 0.5),
    behavior: good(world, "citizen_behavior_change", 0.5),
    privateResponse: good(world, "private_sector_response", 0.5),
    labor: good(world, "labor_availability", 0.6),
    support: good(world, "public_support", 0.55),
    cohesion: good(world, "community_cohesion", 0.55),
    inequalityPenalty: normalized(world, "inequality", 0.45),
    climatePenalty: normalized(world, "climate_stress", 0.3),
    costPenalty: normalized(world, "construction_cost_change", 0.4),
    unemploymentPenalty: normalized(world, "unemployment_rate", 0.3),
    inflationPenalty: normalized(world, "inflation_rate", 0.3),
    growth: good(world, "economic_growth", 0.55),
    credit: good(world, "credit_availability", 0.55),
  };
}

function weightedSignal(domain, context) {
  const weights = DOMAIN_WEIGHTS[domain] || DOMAIN_WEIGHTS.implementation;
  let total = 0;
  let normalization = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const source = key === "resilience" ? context.resilience : context[key];
    if (!Number.isFinite(source)) continue;
    const centered = (clamp01(source) - 0.5) * 2;
    total += centered * weight;
    normalization += Math.abs(weight);
  }
  return normalization ? clamp(total / normalization, -1, 1) : 0;
}

function event(year, type, severity, description, drivers = []) {
  return {
    year,
    type,
    severity: round(clamp01(severity), 3),
    description,
    drivers,
  };
}

function buildEventsForYear({ experiment, world, year, previous, delayYears, rollout, domains, priorEvents = [] }) {
  const events = [];
  if (year === 1 && delayYears > 0.25) {
    events.push(event(year, "implementation-delay", Math.min(1, delayYears / 3), `Meaningful implementation is delayed by roughly ${round(delayYears * 12, 1)} months.`, ["implementation_delay_months"]));
  }
  if (!previous.rolloutStarted && rollout > 0.05) {
    events.push(event(year, "rollout-start", rollout, "The modeled plan begins producing material implementation activity.", ["agency_capacity", "funding_delivery_rate", "local_compliance"]));
  }

  const externalProbability = clamp(condition(world, "external_shock_probability", 0.08), 0, 0.95);
  const majorProbability = clamp(condition(world, "major_disruption_probability", 0.02), 0, 0.75);
  const turnoverProbability = clamp(condition(world, "political_turnover_probability", 0.08), 0, 0.75);
  const worldKey = world?.id || experiment?.id || "world";

  if (deterministicUnit(worldKey, year, "external-shock") < externalProbability) {
    events.push(event(year, "external-shock", 0.35 + externalProbability, "An external disruption temporarily reduces delivery and increases implementation friction.", ["external_shock_probability"]));
  }
  if (deterministicUnit(worldKey, year, "major-disruption") < majorProbability) {
    events.push(event(year, "major-disruption", 0.6 + majorProbability, "A severe disruption creates a larger temporary setback across the modeled system.", ["major_disruption_probability"]));
  }
  if (deterministicUnit(worldKey, year, "political-turnover") < turnoverProbability) {
    events.push(event(year, "political-turnover", 0.35 + turnoverProbability, "Leadership turnover weakens continuity and slows implementation for this year.", ["political_turnover_probability", "public_support", "polarization"]));
  }

  const priorTypes = new Set(priorEvents.map((row) => row.type));
  for (const domain of domains) {
    const current = previous.domainMomentum?.[domain] || 0;
    const type = `${domain}-response`;
    if (!priorTypes.has(type) && current < 0.12 && rollout > 0.45 && deterministicUnit(worldKey, domain, "momentum-year") < year / Math.max(2, experiment?.experiment?.horizonYears || 10)) {
      events.push(event(year, type, 0.35 + rollout * 0.45, `${domain[0].toUpperCase()}${domain.slice(1)} outcomes begin responding materially to the implemented plan.`, ["delivery", domain]));
    }
  }
  return events;
}

function domainSignals(domains, context) {
  const signals = {};
  for (const domain of domains) signals[domain] = weightedSignal(domain, context);
  if (!signals.implementation) signals.implementation = weightedSignal("implementation", context);
  return signals;
}

function finalExplanation(world, context, events, domainMomentum) {
  const drivers = driverRows(world).sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
  const positiveDrivers = drivers.filter((row) => row.effect > 0.05).slice(0, 5);
  const negativeDrivers = drivers.filter((row) => row.effect < -0.05).slice(0, 5);
  const dominantDomains = Object.entries(domainMomentum)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 4)
    .map(([domain, value]) => ({ domain, effect: round(value, 3) }));
  return {
    positiveDrivers,
    negativeDrivers,
    dominantDomains,
    eventCount: events.length,
    endingState: {
      deliveryCapacity: round(context.delivery, 3),
      politicalDurability: round(context.political, 3),
      disruptionResilience: round(context.resilience, 3),
    },
  };
}

export function simulateHblCivicDynamics({ experiment, world }) {
  if (!experiment || !world) throw new Error("HBL civic dynamics requires experiment and world");
  const registry = Array.isArray(experiment?.outcomes?.metricRegistry) ? experiment.outcomes.metricRegistry : [];
  const horizon = Math.max(1, Math.min(100, Math.round(finite(experiment?.experiment?.horizonYears, 10))));
  const intensity = planIntensity(experiment);
  const delayYears = Math.max(0, condition(world, "implementation_delay_months", 6) / 12);
  const staticState = staticContext(world);
  const domains = [...new Set(registry.map(metricDomain).filter(Boolean))];
  if (!domains.length) domains.push("implementation");
  if (!domains.includes("implementation")) domains.push("implementation");

  const timeline = [];
  const events = [];
  let disruptionCarry = 0;
  let turnoverCarry = 0;
  let rolloutStarted = false;
  const domainMomentum = Object.fromEntries(domains.map((domain) => [domain, 0]));

  for (let year = 1; year <= horizon; year++) {
    const rampWindow = Math.max(1, horizon * 0.32);
    const rollout = clamp((year - delayYears) / rampWindow, 0, 1) * intensity;
    const yearEvents = buildEventsForYear({
      experiment,
      world,
      year,
      previous: { rolloutStarted, domainMomentum },
      delayYears,
      rollout,
      domains,
      priorEvents: events,
    });
    rolloutStarted ||= rollout > 0.05;
    events.push(...yearEvents);

    const shockSeverity = yearEvents
      .filter((row) => row.type === "external-shock" || row.type === "major-disruption")
      .reduce((sum, row) => sum + row.severity, 0);
    const turnoverSeverity = yearEvents
      .filter((row) => row.type === "political-turnover")
      .reduce((sum, row) => sum + row.severity, 0);
    disruptionCarry = clamp(disruptionCarry * 0.42 + shockSeverity * 0.48, 0, 0.95);
    turnoverCarry = clamp(turnoverCarry * 0.55 + turnoverSeverity * 0.38, 0, 0.8);

    const delivery = clamp(staticState.deliveryCapacity * (0.30 + rollout * 0.88) * (1 - disruptionCarry * 0.48) * (1 - turnoverCarry * 0.28), 0, 1);
    const political = clamp(staticState.politicalDurability * (1 - turnoverCarry * 0.55) * (0.88 + rollout * 0.16), 0, 1);
    const resilience = clamp(1 - disruptionCarry * 0.75 - normalized(world, "external_shock_probability", 0.25) * 0.12, 0, 1);
    const context = {
      ...staticState,
      delivery,
      political,
      resilience,
      disruptionPenalty: disruptionCarry,
    };
    const signals = domainSignals(domains, context);

    for (const domain of domains) {
      const inertia = domain === "implementation" ? 0.42 : 0.62;
      const target = clamp(signals[domain] * rollout + (domain === "implementation" ? (delivery - 0.5) * 0.75 : 0), -1, 1);
      domainMomentum[domain] = clamp(domainMomentum[domain] * inertia + target * (1 - inertia), -1, 1);
    }

    const metrics = {};
    for (const metric of registry) {
      const domain = metricDomain(metric);
      metrics[metric.id] = applyImprovementToMetric(metric, domainMomentum[domain] ?? domainMomentum.implementation ?? 0);
    }
    metrics.implementation_viability = round(clamp(50 + domainMomentum.implementation * 50, 0, 100), 2);
    metrics.delivery_reliability = round(delivery * 100, 2);
    metrics.political_durability = round(political * 100, 2);
    metrics.disruption_resilience = round(resilience * 100, 2);

    const domainValues = Object.values(domainMomentum);
    const aggregate = mean(domainValues, 0);
    const score = round(clamp(55 + aggregate * 90 - disruptionCarry * 12, 0, 100), 2);
    timeline.push({
      year,
      score,
      rollout: round(rollout, 3),
      delivery: round(delivery, 3),
      politicalDurability: round(political, 3),
      disruptionResilience: round(resilience, 3),
      domainEffects: Object.fromEntries(Object.entries(domainMomentum).map(([domain, value]) => [domain, round(value, 4)])),
      metrics,
      events: yearEvents.map((row) => row.type),
    });
  }

  const final = timeline.at(-1);
  const finalContext = {
    delivery: final?.delivery ?? 0,
    political: final?.politicalDurability ?? 0,
    resilience: final?.disruptionResilience ?? 0,
  };
  const explanation = finalExplanation(world, finalContext, events, domainMomentum);
  const score = final?.score ?? 0;

  return {
    score,
    status: statusFor(score),
    metrics: final?.metrics || {},
    timeline,
    events,
    explanation,
    trace: [
      { component: "plan-intensity", weight: 0.20, value: round(intensity * 100, 2) },
      { component: "delivery", weight: 0.30, value: round((final?.delivery || 0) * 100, 2) },
      { component: "political", weight: 0.20, value: round((final?.politicalDurability || 0) * 100, 2) },
      { component: "resilience", weight: 0.15, value: round((final?.disruptionResilience || 0) * 100, 2) },
      { component: "domain-response", weight: 0.15, value: round((mean(Object.values(domainMomentum), 0) + 1) * 50, 2) },
    ],
    model: {
      id: "hbl-civic-dynamics.v1",
      version: 1,
      predictive: false,
      modelClass: "time-stepped-civic-dynamics",
      horizonYears: horizon,
      domains,
    },
    disclaimer: "HBL civic dynamics is a deterministic systems-model hypothesis generator. It is not empirically calibrated and should not be interpreted as a real-world forecast.",
  };
}

export const __test = {
  METRIC_BASELINES,
  DOMAIN_WEIGHTS,
  deterministicUnit,
  planIntensity,
  staticContext,
  weightedSignal,
  applyImprovementToMetric,
};
