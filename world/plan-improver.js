const KNOWN_IMPROVEMENTS = {
  agency_capacity: {
    title: "Add implementation capacity and surge staffing",
    description: "Add staffing, technical assistance, delivery milestones, and backup implementation capacity.",
    direction: "increase",
  },
  funding_delivery_rate: {
    title: "Make funding automatic and staged",
    description: "Use pre-authorized funding tranches, clear release conditions, and contingency reserves to reduce delivery failure.",
    direction: "increase",
  },
  local_compliance: {
    title: "Add local implementation incentives and support",
    description: "Pair requirements with implementation grants, technical support, transparent milestones, and escalation paths.",
    direction: "increase",
  },
  enforcement_rate: {
    title: "Add measurable enforcement and audit capacity",
    description: "Define enforcement ownership, reporting cadence, audit triggers, and corrective-action procedures.",
    direction: "increase",
  },
  implementation_delay_months: {
    title: "Add a phased launch with deadline triggers",
    description: "Start with parallel pilots and automatic escalation when administrative milestones are missed.",
    direction: "decrease",
  },
  public_support: {
    title: "Add public feedback and visible early wins",
    description: "Use pilots, transparent progress reporting, and citizen feedback loops to build durable support.",
    direction: "increase",
  },
  external_shock_probability: {
    title: "Add an automatic shock contingency",
    description: "Define reserves, fallback operating modes, and automatic triggers for recession, disaster, or supply disruption.",
    direction: "decrease",
  },
  permitting_delay_months: {
    title: "Pre-clear permitting paths",
    description: "Create standardized approvals, concurrent review, deadlines, and pre-approved project patterns.",
    direction: "decrease",
  },
  interest_rate: {
    title: "Add a financing-rate backstop",
    description: "Use rate buydowns, guarantees, or counter-cyclical financing support when borrowing costs spike.",
    direction: "decrease",
  },
  construction_cost_change: {
    title: "Add cost-indexed funding and procurement flexibility",
    description: "Index budgets to material/labor costs and permit alternative procurement when prices move sharply.",
    direction: "decrease",
  },
  labor_availability: {
    title: "Add workforce capacity before rollout",
    description: "Fund training, credential acceleration, retention, and surge capacity before implementation peaks.",
    direction: "increase",
  },
  infrastructure_capacity: {
    title: "Sequence enabling infrastructure first",
    description: "Gate rollout on water, power, transport, school, broadband, or other required capacity.",
    direction: "increase",
  },
  political_turnover_probability: {
    title: "Make implementation durable across administrations",
    description: "Use multi-year commitments, transparent milestones, distributed ownership, and automatic continuation rules.",
    direction: "decrease",
  },
  polarization: {
    title: "Reduce partisan single points of failure",
    description: "Broaden implementation ownership and use measurable outcomes that survive leadership changes.",
    direction: "decrease",
  },
};

function hashString(value) {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function variableMap(experiment) {
  return new Map((experiment?.worldModel?.variables || []).map((variable) => [variable.id, variable]));
}

function chooseDirection(sensitivity) {
  if (sensitivity?.direction === "higher-associated-with-worse") return "decrease";
  if (sensitivity?.direction === "higher-associated-with-better") return "increase";
  return null;
}

export function generatePlanImprovements(experiment, sensitivityAnalysis, options = {}) {
  const limit = Math.max(1, Math.min(20, Math.round(Number(options.limit || 5))));
  const variables = variableMap(experiment);
  const sensitivities = sensitivityAnalysis?.sensitivities || [];
  const failureById = new Map((sensitivityAnalysis?.failureModes || []).map((row) => [row.id, row]));
  const improvements = [];

  for (const sensitivity of sensitivities) {
    if (improvements.length >= limit) break;
    if ((sensitivity.absoluteCorrelation || 0) < (options.minimumCorrelation ?? 0.08)) continue;
    const variable = variables.get(sensitivity.id);
    if (!variable) continue;
    const known = KNOWN_IMPROVEMENTS[sensitivity.id];
    const direction = known?.direction || chooseDirection(sensitivity);
    if (!direction) continue;
    const failure = failureById.get(sensitivity.id);
    const strength = Math.max(0.05, Math.min(0.45, 0.12 + (sensitivity.absoluteCorrelation || 0) * 0.25));
    const label = variable.label || sensitivity.label || sensitivity.id;
    const title = known?.title || `${direction === "increase" ? "Strengthen" : "Reduce exposure to"} ${label}`;
    const description = known?.description || `Test whether making the plan more resilient to ${label} improves outcomes across the same sampled worlds.`;

    improvements.push({
      id: `improvement_${hashString(`${experiment?.plan?.id}:${sensitivity.id}:${direction}`)}`,
      type: "stress-test-hypothesis",
      title,
      description,
      targetVariableId: sensitivity.id,
      targetVariableLabel: label,
      simulationEffect: { variableId: sensitivity.id, direction, strength },
      evidence: {
        correlation: sensitivity.correlation,
        absoluteCorrelation: sensitivity.absoluteCorrelation,
        failurePattern: failure?.pattern || null,
        failureDelta: failure?.delta ?? null,
      },
      warning: "This is a simulation hypothesis derived from sensitivity, not evidence that the policy change will cause the modeled improvement.",
    });
  }

  return improvements;
}

export function applyPlanImprovement(experiment, improvement) {
  if (!improvement?.simulationEffect?.variableId) throw new Error("Improvement requires a simulationEffect.variableId");
  const revision = Math.max(1, Number(experiment?.lineage?.revision || 1) + 1);
  const existingActions = Array.isArray(experiment?.plan?.actions) ? experiment.plan.actions : [];
  const action = {
    id: improvement.id,
    title: improvement.title,
    description: improvement.description,
    kind: "simulated-plan-improvement",
    simulationEffect: improvement.simulationEffect,
  };
  const plan = {
    ...experiment.plan,
    actions: [...existingActions, action],
    simulationEffects: [...(experiment?.plan?.simulationEffects || []), improvement.simulationEffect],
  };
  const nextId = `exp_${hashString(`${experiment?.id}:${revision}:${improvement.id}`)}`;
  return {
    ...experiment,
    id: nextId,
    plan,
    outcomes: { ...(experiment?.outcomes || {}), worlds: [], clusters: [] },
    analysis: { ...(experiment?.analysis || {}), robustness: null, tailRisks: [], sensitivities: [], failureModes: [], suggestedChanges: [] },
    lineage: {
      ...(experiment?.lineage || {}),
      parentExperimentId: experiment?.id || null,
      revision,
      appliedImprovementId: improvement.id,
    },
  };
}

export function applySimulationEffectsToWorld(experiment, world) {
  const effects = experiment?.plan?.simulationEffects || [];
  if (!effects.length) return world;
  const definitions = variableMap(experiment);
  const conditions = { ...(world?.conditions || {}) };
  const normalized = { ...(world?.normalized || {}) };
  const deviations = { ...(world?.deviations || {}) };
  const applied = [];

  for (const effect of effects) {
    const id = effect?.variableId;
    const variable = definitions.get(id);
    if (!id || !variable || !Number.isFinite(Number(conditions[id]))) continue;
    const min = Number(variable.range?.min ?? 0);
    const max = Number(variable.range?.max ?? 1);
    const baseline = Number(variable.baseline ?? (min + max) / 2);
    const strength = clamp01(effect.strength ?? 0.2);
    const before = Number(conditions[id]);
    const after = effect.direction === "decrease"
      ? before - strength * (before - min)
      : before + strength * (max - before);
    conditions[id] = after;
    const span = max - min;
    normalized[id] = span > 0 ? (after - min) / span : 0.5;
    deviations[id] = span > 0 ? (after - baseline) / span : 0;
    applied.push({ variableId: id, direction: effect.direction, strength, before, after });
  }

  return {
    ...world,
    conditions,
    normalized,
    deviations,
    sourceConditions: world?.conditions || {},
    mitigationsApplied: applied,
  };
}

export const __test = { KNOWN_IMPROVEMENTS, chooseDirection, hashString, clamp01 };
