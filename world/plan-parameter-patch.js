export const PLAN_PARAMETER_PATCH_SCHEMA_VERSION = "hbl-parameter-patch.v1";

const HEURISTIC_RULES = Object.freeze([
  {
    id: "staffing-capacity",
    parameterId: "agency_capacity",
    terms: ["agency capacity", "staffing", "hire staff", "hiring staff", "caseworker", "administrator"],
    normalizedDelta: 0.08,
    reason: "The plan explicitly calls for more administrative or staffing capacity.",
  },
  {
    id: "funding-delivery",
    parameterId: "funding_delivery_rate",
    terms: ["appropriation", "appropriations", "grant funding", "dedicated funding", "funding stream", "funding mechanism"],
    normalizedDelta: 0.08,
    reason: "The plan specifies a funding mechanism intended to improve delivery reliability.",
  },
  {
    id: "enforcement-strength",
    parameterId: "enforcement_rate",
    terms: ["enforcement", "inspection", "inspections", "audit", "audits", "penalty", "penalties"],
    normalizedDelta: 0.08,
    reason: "The plan adds enforcement, inspection, audit, or penalty capacity.",
  },
  {
    id: "faster-permitting",
    parameterId: "permitting_delay_months",
    terms: ["permit reform", "permitting reform", "expedited permit", "expedited approval", "streamline permitting", "zoning reform", "by-right"],
    normalizedDelta: -0.18,
    reason: "The plan explicitly targets permitting or approval delays.",
  },
  {
    id: "infrastructure-capacity",
    parameterId: "infrastructure_capacity",
    terms: ["infrastructure investment", "transit investment", "grid upgrade", "water system", "sewer", "broadband expansion", "road capacity"],
    normalizedDelta: 0.08,
    reason: "The plan adds supporting infrastructure capacity.",
  },
  {
    id: "technology-improvement",
    parameterId: "technology_improvement",
    terms: ["automation", "artificial intelligence", " ai ", "digital system", "digital service", "new technology"],
    normalizedDelta: 0.10,
    reason: "The plan explicitly relies on technology to improve cost, speed, quality, or capacity.",
  },
  {
    id: "behavior-adoption",
    parameterId: "citizen_behavior_change",
    terms: ["behavior change", "adoption incentive", "participation incentive", "ridership incentive", "public outreach"],
    normalizedDelta: 0.08,
    reason: "The plan includes an adoption, participation, or behavior-change mechanism.",
  },
  {
    id: "private-response",
    parameterId: "private_sector_response",
    terms: ["private-sector partnership", "private sector partnership", "developer incentive", "business incentive", "employer incentive"],
    normalizedDelta: 0.08,
    reason: "The plan explicitly attempts to change private-sector response.",
  },
  {
    id: "public-trust",
    parameterId: "public_trust",
    terms: ["public trust", "transparency measure", "community engagement", "participatory process"],
    normalizedDelta: 0.06,
    reason: "The plan includes a trust, transparency, or community-engagement mechanism.",
  },
  {
    id: "public-support",
    parameterId: "public_support",
    terms: ["public support", "coalition building", "public campaign", "stakeholder coalition"],
    normalizedDelta: 0.06,
    reason: "The plan explicitly includes coalition-building or public-support work.",
  },
]);

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const asArray = (value) => Array.isArray(value) ? value : [];
const finite = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function hashString(value) {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function textOf(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (isObject(value)) return Object.values(value).map(textOf).join(" ");
  return "";
}

function currentBaseline(variable, override) {
  const min = finite(override?.min ?? override?.range?.min, finite(variable?.range?.min, 0));
  const max = finite(override?.max ?? override?.range?.max, finite(variable?.range?.max, 1));
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return clamp(finite(override?.baseline, finite(variable?.baseline, (low + high) / 2)), low, high);
}

function explicitRows(plan) {
  const rows = [
    ...asArray(plan?.parameterEdits),
    ...asArray(plan?.parameter_edits),
    ...asArray(plan?.simulationParameters),
    ...asArray(plan?.simulation_parameters),
  ];
  for (const action of asArray(plan?.actions)) {
    rows.push(
      ...asArray(action?.parameterEdits),
      ...asArray(action?.parameter_edits),
      ...asArray(action?.simulationParameters),
      ...asArray(action?.simulation_parameters),
      ...asArray(action?.simulationEffects),
      ...asArray(action?.simulation_effects),
    );
  }
  return rows.filter(isObject);
}

function rowParameterId(row) {
  const value = row.parameterId ?? row.parameter_id ?? row.parameter ?? row.id ?? row.key;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rowOperation(row) {
  const raw = String(row.operation || row.op || "").toLowerCase();
  if (["set", "add", "multiply"].includes(raw)) return raw;
  if (finite(row.add ?? row.delta) !== null) return "add";
  if (finite(row.multiply ?? row.factor) !== null) return "multiply";
  return "set";
}

function rowOperand(row, operation) {
  if (operation === "add") return finite(row.add ?? row.delta ?? row.value ?? row.amount);
  if (operation === "multiply") return finite(row.multiply ?? row.factor ?? row.value);
  return finite(row.value ?? row.target ?? row.baseline ?? row.to);
}

function applyOperation(current, operation, operand) {
  if (!Number.isFinite(operand)) return current;
  if (operation === "add") return current + operand;
  if (operation === "multiply") return current * operand;
  return operand;
}

function additionRange(row, proposedValue) {
  const rawMin = finite(row.min ?? row.range?.min);
  const rawMax = finite(row.max ?? row.range?.max);
  if (rawMin !== null || rawMax !== null) {
    const a = rawMin ?? Math.min(0, proposedValue);
    const b = rawMax ?? Math.max(1, proposedValue);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  if (proposedValue >= 0 && proposedValue <= 1) return { min: 0, max: 1 };
  if (proposedValue >= 0) return { min: 0, max: Math.max(proposedValue * 2, proposedValue + 1) };
  return { min: Math.min(proposedValue * 2, proposedValue - 1), max: 0 };
}

function makeAddition(row, id) {
  const proposedCandidate = finite(row.value ?? row.target ?? row.baseline ?? row.to, 0.5);
  const range = additionRange(row, proposedCandidate);
  const proposedValue = clamp(proposedCandidate, range.min, range.max);
  const label = typeof row.label === "string" && row.label.trim() ? row.label.trim() : id.replace(/[-_]+/g, " ");
  const reason = typeof row.reason === "string" && row.reason.trim()
    ? row.reason.trim()
    : "The plan explicitly declares a simulation parameter that is not in the current world model.";
  return {
    parameterId: id,
    proposedValue,
    reason,
    source: "explicit-plan-parameter",
    connected: Boolean(row.modelBinding ?? row.model_binding),
    variable: {
      id,
      category: typeof row.category === "string" && row.category.trim() ? row.category.trim() : "custom",
      label,
      description: typeof row.description === "string" && row.description.trim() ? row.description.trim() : "Plan-defined simulation parameter.",
      kind: "continuous",
      unit: typeof row.unit === "string" && row.unit.trim() ? row.unit.trim() : "index",
      baseline: proposedValue,
      range,
      distribution: { type: "triangular", min: range.min, mode: proposedValue, max: range.max },
      confidence: 1,
      source: "plan-parameter-patch",
      evidence: [],
      reason,
      locked: Boolean(row.locked),
      modelBinding: row.modelBinding ?? row.model_binding ?? null,
      connected: Boolean(row.modelBinding ?? row.model_binding),
    },
  };
}

function canonicalExplicitRow(row) {
  const id = rowParameterId(row);
  if (!id) return null;
  const operation = rowOperation(row);
  return { id, operation, operand: rowOperand(row, operation) };
}

function lineageHasPatch(experiment, sourceFingerprint) {
  return asArray(experiment?.lineage?.parameterPatches).some((row) => row?.sourceFingerprint === sourceFingerprint);
}

export function compilePlanParameterPatch(experiment, overrides = {}) {
  if (!isObject(experiment?.plan)) throw new Error("compilePlanParameterPatch requires a civic experiment with plan");
  const variables = asArray(experiment?.worldModel?.variables);
  const byId = new Map(variables.map((variable) => [variable.id, variable]));
  const currentById = new Map(variables.map((variable) => [variable.id, currentBaseline(variable, overrides?.[variable.id])]));
  const explicit = explicitRows(experiment.plan);
  const explicitState = new Map();
  const additionsById = new Map();
  const warnings = [];

  for (const row of explicit) {
    const id = rowParameterId(row);
    if (!id) continue;
    const variable = byId.get(id);
    if (!variable) {
      additionsById.set(id, makeAddition(row, id));
      continue;
    }
    const operation = rowOperation(row);
    const operand = rowOperand(row, operation);
    if (!Number.isFinite(operand)) {
      warnings.push(`Ignored explicit parameter edit for ${id}: no numeric operand.`);
      continue;
    }
    const prior = explicitState.get(id)?.to ?? currentById.get(id);
    const min = finite(variable.range?.min, 0);
    const max = finite(variable.range?.max, 1);
    const unclamped = applyOperation(prior, operation, operand);
    const next = clamp(unclamped, Math.min(min, max), Math.max(min, max));
    if (next !== unclamped) warnings.push(`Clamped ${id} to its declared range.`);
    const reason = typeof row.reason === "string" && row.reason.trim()
      ? row.reason.trim()
      : `Explicit plan parameter ${operation} operation.`;
    const previous = explicitState.get(id);
    explicitState.set(id, {
      parameterId: id,
      label: variable.label || id,
      category: variable.category || "custom",
      unit: variable.unit || "index",
      from: currentById.get(id),
      to: next,
      operation: "set",
      requestedOperation: operation,
      source: "explicit-plan-parameter",
      reason: previous ? `${previous.reason} ${reason}` : reason,
      evidence: [],
      confidence: 1,
    });
  }

  const haystack = ` ${textOf(experiment.plan).toLowerCase()} `;
  const heuristicMatches = [];
  const heuristicById = new Map();
  for (const rule of HEURISTIC_RULES) {
    if (explicitState.has(rule.parameterId)) continue;
    const variable = byId.get(rule.parameterId);
    if (!variable) continue;
    const evidence = rule.terms.filter((term) => haystack.includes(term.toLowerCase()));
    if (!evidence.length) continue;
    heuristicMatches.push({ ruleId: rule.id, parameterId: rule.parameterId, evidence });
    const previous = heuristicById.get(rule.parameterId) || { normalizedDelta: 0, rules: [], evidence: [], reasons: [] };
    previous.normalizedDelta = clamp(previous.normalizedDelta + rule.normalizedDelta, -0.25, 0.25);
    previous.rules.push(rule.id);
    previous.evidence.push(...evidence);
    previous.reasons.push(rule.reason);
    heuristicById.set(rule.parameterId, previous);
  }

  const heuristicEdits = [];
  for (const [id, match] of heuristicById.entries()) {
    const variable = byId.get(id);
    const min = finite(variable.range?.min, 0);
    const max = finite(variable.range?.max, 1);
    const low = Math.min(min, max), high = Math.max(min, max);
    const from = currentById.get(id);
    const to = clamp(from + match.normalizedDelta * (high - low), low, high);
    if (Math.abs(to - from) < 1e-12) continue;
    heuristicEdits.push({
      parameterId: id,
      label: variable.label || id,
      category: variable.category || "custom",
      unit: variable.unit || "index",
      from,
      to,
      operation: "set",
      requestedOperation: "normalized-shift",
      normalizedDelta: match.normalizedDelta,
      source: "heuristic-plan-mapping",
      reason: [...new Set(match.reasons)].join(" "),
      evidence: [...new Set(match.evidence)].slice(0, 8),
      ruleIds: match.rules,
      confidence: 0.55,
    });
  }

  const edits = [...explicitState.values(), ...heuristicEdits].sort((a, b) => a.parameterId.localeCompare(b.parameterId));
  const additions = [...additionsById.values()].sort((a, b) => a.parameterId.localeCompare(b.parameterId));
  const explicitSignature = explicit.map(canonicalExplicitRow).filter(Boolean);
  const sourceFingerprint = `ppsrc_${hashString(stableStringify({
    planId: experiment.plan.id || experiment.id || "plan",
    explicit: explicitSignature,
    heuristicRules: heuristicMatches.map((row) => row.ruleId).sort(),
  }))}`;
  const id = `ppatch_${hashString(stableStringify({ sourceFingerprint, edits: edits.map((row) => [row.parameterId, row.to]), additions: additions.map((row) => [row.parameterId, row.proposedValue]) }))}`;
  const alreadyApplied = lineageHasPatch(experiment, sourceFingerprint);

  return {
    schemaVersion: PLAN_PARAMETER_PATCH_SCHEMA_VERSION,
    id,
    sourceFingerprint,
    planId: experiment.plan.id || null,
    experimentId: experiment.id || null,
    edits,
    additions,
    warnings,
    alreadyApplied,
    summary: {
      editCount: edits.length,
      additionCount: additions.length,
      explicitEditCount: edits.filter((row) => row.source === "explicit-plan-parameter").length,
      heuristicEditCount: edits.filter((row) => row.source === "heuristic-plan-mapping").length,
      unconnectedAdditionCount: additions.filter((row) => !row.connected).length,
    },
  };
}

function clone(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function extractionSummary(variables, previous = {}) {
  const categories = {};
  for (const variable of variables) categories[variable.category || "custom"] = (categories[variable.category || "custom"] || 0) + 1;
  return { ...previous, variableCount: variables.length, categories, editable: true };
}

export function applyPlanParameterPatch(experiment, patch, existingOverrides = {}, now = new Date()) {
  if (patch?.schemaVersion !== PLAN_PARAMETER_PATCH_SCHEMA_VERSION) throw new Error(`Unsupported parameter patch schema: ${patch?.schemaVersion || "missing"}`);
  const nextExperiment = clone(experiment);
  const nextOverrides = clone(existingOverrides || {});
  nextExperiment.worldModel ||= {};
  nextExperiment.worldModel.variables ||= [];
  nextExperiment.lineage ||= {};
  nextExperiment.lineage.parameterPatches ||= [];

  if (lineageHasPatch(nextExperiment, patch.sourceFingerprint)) {
    return { experiment: nextExperiment, overrides: nextOverrides, applied: false, alreadyApplied: true, patch };
  }

  const variablesById = new Map(nextExperiment.worldModel.variables.map((variable) => [variable.id, variable]));
  for (const addition of asArray(patch.additions)) {
    if (!addition?.variable?.id || variablesById.has(addition.variable.id)) continue;
    const variable = clone(addition.variable);
    nextExperiment.worldModel.variables.push(variable);
    variablesById.set(variable.id, variable);
  }

  for (const edit of asArray(patch.edits)) {
    const variable = variablesById.get(edit.parameterId);
    if (!variable || !Number.isFinite(Number(edit.to))) continue;
    const previous = nextOverrides[edit.parameterId] || {};
    nextOverrides[edit.parameterId] = {
      baseline: Number(edit.to),
      min: finite(previous.min ?? previous.range?.min, finite(variable.range?.min, 0)),
      max: finite(previous.max ?? previous.range?.max, finite(variable.range?.max, 1)),
      locked: typeof previous.locked === "boolean" ? previous.locked : Boolean(variable.locked),
      reason: `Applied from plan parameter patch ${patch.id}: ${edit.reason}`,
    };
  }

  for (const addition of asArray(patch.additions)) {
    const variable = variablesById.get(addition?.parameterId);
    if (!variable) continue;
    nextOverrides[variable.id] = {
      baseline: Number(addition.proposedValue),
      min: Number(variable.range?.min),
      max: Number(variable.range?.max),
      locked: Boolean(variable.locked),
      reason: `Added from plan parameter patch ${patch.id}: ${addition.reason}`,
    };
  }

  nextExperiment.worldModel.parameterExtraction = extractionSummary(
    nextExperiment.worldModel.variables,
    nextExperiment.worldModel.parameterExtraction || {},
  );
  nextExperiment.lineage.parameterPatches.push({
    id: patch.id,
    sourceFingerprint: patch.sourceFingerprint,
    appliedAt: now.toISOString(),
    editCount: patch.summary?.editCount ?? patch.edits?.length ?? 0,
    additionCount: patch.summary?.additionCount ?? patch.additions?.length ?? 0,
  });

  return { experiment: nextExperiment, overrides: nextOverrides, applied: true, alreadyApplied: false, patch };
}

export const __test = {
  HEURISTIC_RULES,
  explicitRows,
  rowOperation,
  rowOperand,
  textOf,
  hashString,
};
