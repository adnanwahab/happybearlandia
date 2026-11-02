const DERIVED_NODES = {
  delivery_capacity: { label: "Delivery capacity", direction: "higher-is-better" },
  political_durability: { label: "Political durability", direction: "higher-is-better" },
  public_confidence: { label: "Public confidence", direction: "higher-is-better" },
  financial_capacity: { label: "Financial capacity", direction: "higher-is-better" },
  demand_pressure: { label: "Demand pressure", direction: "context-dependent" },
  supply_capacity: { label: "Supply capacity", direction: "higher-is-better" },
  private_response: { label: "Private response", direction: "higher-is-better" },
  cost_pressure: { label: "Cost pressure", direction: "lower-is-better" },
  disruption_resilience: { label: "Disruption resilience", direction: "higher-is-better" },
};

const DEFAULT_EDGES = [
  ["agency_capacity", "delivery_capacity", 1, 0.78, "Agency capacity raises the ability to execute the plan."],
  ["funding_delivery_rate", "delivery_capacity", 1, 0.82, "Funding that actually arrives raises delivery capacity."],
  ["local_compliance", "delivery_capacity", 1, 0.66, "Local compliance improves implementation throughput."],
  ["enforcement_rate", "delivery_capacity", 1, 0.44, "Effective enforcement supports implementation."],
  ["implementation_delay_months", "delivery_capacity", -1, 0.68, "Implementation delay reduces effective delivery."],
  ["labor_availability", "delivery_capacity", 1, 0.30, "Available labor supports implementation."],

  ["public_support", "political_durability", 1, 0.66, "Public support increases political durability."],
  ["political_turnover_probability", "political_durability", -1, 0.78, "Leadership turnover threatens continuity."],
  ["polarization", "political_durability", -1, 0.62, "Polarization reduces durable political coordination."],
  ["public_trust", "political_durability", 1, 0.58, "Public trust supports durable implementation."],
  ["public_confidence", "political_durability", 1, 0.34, "Visible confidence can reinforce political durability."],

  ["public_trust", "public_confidence", 1, 0.62, "Trust supports confidence in the plan."],
  ["community_cohesion", "public_confidence", 1, 0.52, "Community cohesion supports confidence and participation."],
  ["public_support", "public_confidence", 1, 0.48, "Existing support raises confidence."],
  ["inequality", "public_confidence", -1, 0.34, "Higher inequality can reduce confidence and shared legitimacy."],
  ["delivery_capacity", "public_confidence", 1, 0.36, "Visible delivery can reinforce public confidence."],
  ["political_durability", "delivery_capacity", 1, 0.24, "Political continuity reduces implementation churn."],

  ["interest_rate", "financial_capacity", -1, 0.72, "Higher rates tighten financing capacity."],
  ["inflation_rate", "financial_capacity", -1, 0.48, "Inflation erodes purchasing and implementation capacity."],
  ["credit_availability", "financial_capacity", 1, 0.72, "Available credit supports investment and implementation."],
  ["economic_growth", "financial_capacity", 1, 0.44, "Economic growth supports fiscal and private capacity."],
  ["unemployment_rate", "financial_capacity", -1, 0.38, "High unemployment weakens financial capacity."],

  ["population_growth", "demand_pressure", 1, 0.52, "Population growth raises demand pressure."],
  ["migration_rate", "demand_pressure", 1, 0.64, "Migration can raise near-term demand pressure."],
  ["household_size", "demand_pressure", 1, 0.34, "Household composition changes aggregate demand."],

  ["land_availability", "supply_capacity", 1, 0.50, "Available land supports supply expansion."],
  ["permitting_delay_months", "supply_capacity", -1, 0.64, "Permitting delays constrain supply response."],
  ["labor_availability", "supply_capacity", 1, 0.62, "Labor availability supports supply response."],
  ["infrastructure_capacity", "supply_capacity", 1, 0.44, "Infrastructure capacity enables additional supply."],
  ["technology_improvement", "supply_capacity", 1, 0.42, "Technology can raise productive supply capacity."],
  ["construction_cost_change", "supply_capacity", -1, 0.54, "Higher construction costs constrain supply."],
  ["private_response", "supply_capacity", 1, 0.34, "Private response expands realized supply."],

  ["private_sector_response", "private_response", 1, 0.72, "Baseline private-sector responsiveness carries into the modeled response."],
  ["financial_capacity", "private_response", 1, 0.44, "Financing capacity enables private response."],
  ["technology_improvement", "private_response", 1, 0.24, "Technology can increase private responsiveness."],
  ["cost_pressure", "private_response", 1, 0.22, "Higher prices can create incentives for additional private supply."],

  ["construction_cost_change", "cost_pressure", 1, 0.66, "Construction costs raise overall cost pressure."],
  ["interest_rate", "cost_pressure", 1, 0.48, "Financing costs raise cost pressure."],
  ["inflation_rate", "cost_pressure", 1, 0.38, "Inflation raises cost pressure."],
  ["demand_pressure", "cost_pressure", 1, 0.40, "Demand pressure can raise prices and congestion."],
  ["supply_capacity", "cost_pressure", -1, 0.62, "Additional supply reduces cost pressure."],

  ["climate_stress", "disruption_resilience", -1, 0.56, "Climate stress reduces resilience."],
  ["external_shock_probability", "disruption_resilience", -1, 0.50, "Frequent external shocks reduce resilience."],
  ["major_disruption_probability", "disruption_resilience", -1, 0.72, "Major disruptions sharply reduce resilience."],
  ["infrastructure_capacity", "disruption_resilience", 1, 0.54, "Infrastructure capacity raises resilience."],
  ["community_cohesion", "disruption_resilience", 1, 0.26, "Community cohesion improves recovery capacity."],
  ["public_confidence", "disruption_resilience", 1, 0.18, "Confidence and coordination modestly improve resilience."],
  ["disruption_resilience", "public_confidence", 1, 0.16, "Resilience can reinforce confidence after shocks."],
].map(([from, to, sign, strength, description], index) => ({
  id: `edge_${String(index + 1).padStart(2, "0")}_${from}_${to}`,
  from,
  to,
  sign,
  strength,
  description,
  kind: DERIVED_NODES[from] ? "feedback" : "structural",
}));

const DEFAULT_FEEDBACK_LOOPS = [
  {
    id: "implementation_trust_loop",
    label: "Implementation ↔ trust reinforcing loop",
    type: "reinforcing",
    nodes: ["delivery_capacity", "public_confidence", "political_durability"],
    description: "Visible delivery can build confidence and political durability, which in turn can make continued delivery easier.",
  },
  {
    id: "supply_price_balancing_loop",
    label: "Supply ↔ price balancing loop",
    type: "balancing",
    nodes: ["private_response", "supply_capacity", "cost_pressure"],
    description: "Higher cost pressure can induce supply response; additional supply then reduces cost pressure.",
  },
  {
    id: "resilience_confidence_loop",
    label: "Resilience ↔ confidence reinforcing loop",
    type: "reinforcing",
    nodes: ["disruption_resilience", "public_confidence"],
    description: "Resilience can preserve confidence during shocks, while confidence and coordination can modestly improve resilience.",
  },
];

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeEdge(raw, index, allowedNodes) {
  if (!isObject(raw)) return null;
  const from = typeof raw.from === "string" ? raw.from.trim() : "";
  const to = typeof raw.to === "string" ? raw.to.trim() : "";
  if (!allowedNodes.has(from) || !DERIVED_NODES[to]) return null;
  const sign = Number(raw.sign) < 0 ? -1 : 1;
  const strength = clamp(Math.abs(finite(raw.strength, 0.5)), 0.01, 1);
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `custom_edge_${index + 1}`,
    from,
    to,
    sign,
    strength,
    description: typeof raw.description === "string" ? raw.description : `${from} ${sign > 0 ? "increases" : "reduces"} ${to}.`,
    kind: typeof raw.kind === "string" ? raw.kind : (DERIVED_NODES[from] ? "feedback" : "structural"),
  };
}

export function deriveCausalGraph(variables = [], configuredEdges = []) {
  const variableIds = new Set((variables || []).map((variable) => variable?.id).filter(Boolean));
  const allowedNodes = new Set([...variableIds, ...Object.keys(DERIVED_NODES)]);
  const source = Array.isArray(configuredEdges) && configuredEdges.length ? configuredEdges : DEFAULT_EDGES;
  const edges = source
    .map((edge, index) => sanitizeEdge(edge, index, allowedNodes))
    .filter(Boolean);

  const participatingDerivedNodes = new Set(edges.flatMap((edge) => [edge.from, edge.to]).filter((id) => DERIVED_NODES[id]));
  const feedbackLoops = DEFAULT_FEEDBACK_LOOPS
    .filter((loop) => loop.nodes.every((node) => participatingDerivedNodes.has(node)))
    .map((loop) => ({ ...loop }));

  return {
    schemaVersion: "hbl-causal-graph.v1",
    nodes: [
      ...[...variableIds].map((id) => ({ id, kind: "input" })),
      ...Object.entries(DERIVED_NODES).map(([id, meta]) => ({ id, kind: "derived", ...meta })),
    ],
    edges,
    feedbackLoops,
  };
}

function inputState(world) {
  const state = {};
  for (const [id, value] of Object.entries(world?.normalized || {})) {
    if (Number.isFinite(value)) state[id] = clamp(value);
  }
  return state;
}

function groupedEdges(edges) {
  const byTarget = new Map();
  for (const edge of edges || []) {
    if (!byTarget.has(edge.to)) byTarget.set(edge.to, []);
    byTarget.get(edge.to).push(edge);
  }
  return byTarget;
}

export function evaluateCausalGraph({ world, edges = [], previousState = {}, modifiers = {}, iterations = 4 } = {}) {
  const inputs = inputState(world);
  const byTarget = groupedEdges(edges);
  let state = { ...inputs };
  for (const id of Object.keys(DERIVED_NODES)) {
    state[id] = clamp(previousState?.[id], 0, 1);
    if (!Number.isFinite(previousState?.[id])) state[id] = 0.5;
  }

  const passes = Math.max(1, Math.min(12, Math.round(finite(iterations, 4))));
  for (let pass = 0; pass < passes; pass++) {
    const next = { ...state, ...inputs };
    for (const target of Object.keys(DERIVED_NODES)) {
      const incoming = byTarget.get(target) || [];
      if (!incoming.length) continue;
      let signed = 0;
      let weight = 0;
      for (const edge of incoming) {
        const sourceValue = clamp(state[edge.from], 0, 1);
        signed += ((sourceValue - 0.5) * 2) * edge.sign * edge.strength;
        weight += Math.abs(edge.strength);
      }
      const networkSignal = weight ? signed / weight : 0;
      const previous = clamp(state[target], 0, 1);
      const desired = clamp(0.5 + networkSignal * 0.46 + finite(modifiers?.[target], 0), 0, 1);
      // Preserve some state between years/passes so feedback loops behave as a
      // damped system rather than an unstable algebraic cycle.
      next[target] = clamp(previous * 0.28 + desired * 0.72, 0, 1);
    }
    state = next;
  }

  const contributions = [];
  for (const edge of edges || []) {
    const sourceValue = clamp(state[edge.from], 0, 1);
    contributions.push({
      edgeId: edge.id,
      from: edge.from,
      to: edge.to,
      sign: edge.sign,
      strength: edge.strength,
      sourceValue,
      targetValue: clamp(state[edge.to], 0, 1),
      effect: ((sourceValue - 0.5) * 2) * edge.sign * edge.strength,
      description: edge.description,
      kind: edge.kind,
    });
  }

  const loopStates = DEFAULT_FEEDBACK_LOOPS.map((loop) => {
    const values = loop.nodes.map((node) => clamp(state[node], 0, 1));
    const activity = values.length ? values.reduce((sum, value) => sum + Math.abs(value - 0.5) * 2, 0) / values.length : 0;
    return {
      ...loop,
      activity: clamp(activity),
      values: Object.fromEntries(loop.nodes.map((node) => [node, clamp(state[node], 0, 1)])),
    };
  });

  return { state, contributions, feedbackLoops: loopStates };
}

function contributionMap(contributions) {
  const byTarget = new Map();
  for (const row of contributions || []) {
    if (!byTarget.has(row.to)) byTarget.set(row.to, []);
    byTarget.get(row.to).push(row);
  }
  for (const rows of byTarget.values()) rows.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
  return byTarget;
}

function bestPathTo(target, byTarget, seen = new Set(), depth = 0) {
  if (seen.has(target) || depth > 4) return null;
  const incoming = byTarget.get(target) || [];
  if (!incoming.length) return null;
  const edge = incoming[0];
  const nextSeen = new Set(seen);
  nextSeen.add(target);
  if (!DERIVED_NODES[edge.from]) {
    return {
      nodes: [edge.from, target],
      effect: edge.effect,
      edges: [edge],
    };
  }
  const upstream = bestPathTo(edge.from, byTarget, nextSeen, depth + 1);
  if (!upstream) return { nodes: [edge.from, target], effect: edge.effect, edges: [edge] };
  return {
    nodes: [...upstream.nodes, target],
    effect: upstream.effect * edge.sign * Math.max(0.2, edge.strength),
    edges: [...upstream.edges, edge],
  };
}

export function traceCausalPathways(evaluation, targets = ["delivery_capacity", "political_durability", "supply_capacity", "cost_pressure", "disruption_resilience"], limit = 8) {
  const byTarget = contributionMap(evaluation?.contributions || []);
  const rows = [];
  for (const target of targets) {
    const path = bestPathTo(target, byTarget);
    if (!path) continue;
    rows.push({
      target,
      nodes: path.nodes,
      effect: finite(path.effect),
      direction: path.effect >= 0 ? "positive" : "negative",
      description: path.nodes.join(" → "),
    });
  }
  return rows.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)).slice(0, Math.max(1, limit));
}

export const __test = {
  DERIVED_NODES,
  DEFAULT_EDGES,
  DEFAULT_FEEDBACK_LOOPS,
  sanitizeEdge,
  inputState,
  bestPathTo,
};
