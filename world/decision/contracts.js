import { validateBuildingProposal, validateBuildingPlacement } from "../buildings/proposal.js";
import { validateWorldVisuals, WORLD_EDIT_LIMITS } from "../ai/edit-schema.js";

/** Shared Decision Platform wire contract. Browser-safe, with no server imports.
 * Runs count is PER scenario; matching run indices share a seed across scenarios.
 * A frozen manifest can be POSTed directly, or as {manifest}, to reproduce inputs.
 * Runtime-only IDs/status/timestamps in an imported experiment are ignored.
 */
export const DECISION_SCHEMA_VERSION = "decision-experiment.v1";
export const DECISION_MANIFEST_VERSION = "decision-manifest.v1";
export const DECISION_ENGINE_VERSION = "hbl-decision-kernel.v1";
// Measured 181500 project states (500 futures × 3 projects × 121 months)
// used ~518 MiB RSS locally before HTTP result serialization. Keep headroom
// within the existing 1 GiB VM; this limit also applies across active workers.
export const DECISION_LIMITS = Object.freeze({ maxBodyBytes: 512 * 1024, maxScenarios: 8, maxRuns: 1000, maxYears: 50, maxTimelinePoints: 120000, maxProjectStates: 200000, maxMonthlyMetricPoints: 600000, maxReplayWeight: 650000, maxCachedObservations: 200000, maxExperiments: 100, maxPreviews: 20, maxActive: 2 });
export function decisionReplayWorkload(input, model) {
  const months = input.years * 12 + 1;
  const projects = input.runs * input.scenarios.reduce((sum, scenario) => sum + (scenario.projects?.length || 0) + (scenario.timelineFork?.operations || []).filter((operation) => operation.op === "add_building").length, 0) * months;
  const monthly = model.monthlyTimeline ? input.runs * input.scenarios.length * months : 0;
  return { projects, monthly, weight: projects * 2 + monthly };
}
export const TERMINAL_STATUSES = Object.freeze(["completed", "cancelled", "failed"]);
export const isTerminal = (status) => TERMINAL_STATUSES.includes(status);
export const validId = (id) => typeof id === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(id);
export const clone = (value) => JSON.parse(JSON.stringify(value));
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const numeric = (value) => typeof value === "number" && Number.isFinite(value);

/** Recorded outcome semantics, shared by runner, analysis and visualizations.
 * successCriterion retains binary success/failure behavior. outcomeCriteria
 * requires BOTH success/failure arrays: failure=ANY rule, success=ALL rules;
 * failure has precedence, otherwise neither matches => mixed. Without recorded
 * criteria outcome is unclassified, never an invented success threshold.
 */
export function classifyDecisionOutcome(metrics, scenario = {}) {
  const matches = (rule) => Number.isFinite(metrics?.[rule.metricId]) && (rule.operator === "gte" ? metrics[rule.metricId] >= rule.value : metrics[rule.metricId] <= rule.value);
  if (scenario.outcomeCriteria) {
    const { success, failure } = scenario.outcomeCriteria;
    if ([...success, ...failure].some((rule) => !Number.isFinite(metrics?.[rule.metricId]))) return "unclassified";
    if (failure.some(matches)) return "failure";
    return success.every(matches) ? "success" : "mixed";
  }
  if (scenario.successCriterion) return Number.isFinite(metrics?.[scenario.successCriterion.metricId]) ? matches(scenario.successCriterion) ? "success" : "failure" : "unclassified";
  return "unclassified";
}

/** Inherited scenarios: inheritsFrom=parent ID, overrides={parameters,
 * uncertainty,projects,...}. Canonical parameters are resolved for display;
 * explicit overrides remain authoritative on subsequent normalization. */
export function resolveInheritedScenarios(scenarios = []) {
  const byId = new Map(scenarios.map((scenario) => [scenario?.id, scenario]));
  const resolving = new Set();
  const resolved = new Map();
  function resolve(scenario) {
    if (!scenario || typeof scenario !== "object") return scenario;
    if (resolved.has(scenario.id)) return resolved.get(scenario.id);
    const parentId = scenario.inheritsFrom || scenario.extendsScenarioId;
    if (!parentId) return scenario;
    if (resolving.has(scenario.id)) throw new DecisionValidationError(["Scenario inheritance contains a cycle"]);
    const parent = byId.get(parentId);
    if (!parent) throw new DecisionValidationError([`Unknown inherited scenario: ${parentId}`]);
    resolving.add(scenario.id);
    const base = resolve(parent);
    const overrides = scenario.overrides || Object.fromEntries(Object.entries(scenario).filter(([key]) => !["id", "name", "kind", "inheritsFrom", "extendsScenarioId"].includes(key)));
    if (!object(overrides) || Object.keys(overrides).some((key) => !["parameters", "uncertainty", "projects", "stressPresets", "scheduledStress", "worldVisuals", "successCriterion", "outcomeCriteria", "timelineFork"].includes(key))) throw new DecisionValidationError(["Invalid inherited scenario overrides"]);
    const result = { ...clone(base), ...clone(overrides), id: scenario.id, name: scenario.name, kind: scenario.kind || "alternative", inheritsFrom: parentId, overrides: clone(overrides), parameters: { ...base.parameters, ...overrides.parameters }, uncertainty: { ...base.uncertainty, ...overrides.uncertainty } };
    resolving.delete(scenario.id); resolved.set(scenario.id, result); return result;
  }
  return scenarios.map(resolve);
}

export class DecisionValidationError extends Error {
  constructor(errors, status = 400) { super(errors.join("; ")); this.name = "DecisionValidationError"; this.errors = errors; this.status = status; }
}

export function normalizeDecisionInput(payload, model, { retainTraces = true } = {}) {
  const manifest = payload?.manifest || payload;
  if (!object(manifest)) throw new DecisionValidationError(["An experiment object is required"]);
  if (manifest.schemaVersion === DECISION_MANIFEST_VERSION && manifest.engineVersion !== DECISION_ENGINE_VERSION) {
    throw new DecisionValidationError(["Manifest engine version is unavailable; exact reproduction requires the original engine"]);
  }
  const input = manifest.schemaVersion === DECISION_MANIFEST_VERSION ? manifest.experiment : manifest;
  if (!object(input)) throw new DecisionValidationError(["Manifest experiment is missing"]);
  const errors = [];
  if (input.schemaVersion && input.schemaVersion !== DECISION_SCHEMA_VERSION) errors.push("Unsupported experiment schemaVersion");
  if (input.modelId && input.modelId !== model.id) errors.push(`Unsupported modelId: ${input.modelId}`);
  if (input.modelVersion && input.modelVersion !== model.version) errors.push(`Model version ${input.modelVersion} is unavailable; current version is ${model.version}`);
  const runs = input.runs ?? 100;
  const years = input.years ?? 10;
  const seed = input.seed ?? 42;
  if (!Number.isInteger(runs) || runs < 1 || runs > DECISION_LIMITS.maxRuns) errors.push("runs must be an integer from 1 to 1000 per scenario");
  if (!Number.isInteger(years) || years < 1 || years > DECISION_LIMITS.maxYears) errors.push("years must be an integer from 1 to 50");
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) errors.push("seed must be a uint32 integer");
  if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 200) errors.push("name must contain 1–200 characters");
  if (input.decision !== undefined && (typeof input.decision !== "string" || input.decision.length > 20000)) errors.push("decision must be text up to 20000 characters");
  if (input.metadata !== undefined && !object(input.metadata)) errors.push("metadata must be an object");
  const scenarios = resolveInheritedScenarios(Array.isArray(input.scenarios) ? input.scenarios : []);
  if (!scenarios.length || scenarios.length > DECISION_LIMITS.maxScenarios) errors.push("Provide 1–8 scenarios");
  if (runs * scenarios.length * (years + 1) > DECISION_LIMITS.maxTimelinePoints) errors.push("Experiment exceeds 120000 yearly observations; reduce runs, horizon, or scenarios");
  if (scenarios.filter((scenario) => scenario?.kind === "baseline").length !== 1) errors.push("Exactly one scenario must have kind baseline");
  const ids = new Set();
  const parameters = new Map(model.parameters.map((parameter) => [parameter.id, parameter]));
  const normalizedScenarios = scenarios.slice(0, DECISION_LIMITS.maxScenarios).map((scenario, index) => {
    if (!object(scenario)) { errors.push(`Scenario ${index + 1} must be an object`); return null; }
    const prefix = `Scenario ${scenario.id || index + 1}`;
    if (!validId(scenario.id) || ids.has(scenario.id)) errors.push(`${prefix}: IDs must be unique safe identifiers`);
    ids.add(scenario.id);
    if (typeof scenario.name !== "string" || !scenario.name.trim() || scenario.name.length > 200) errors.push(`${prefix}: name must contain 1–200 characters`);
    if (!["baseline", "plan-a", "plan-b", "stress", "alternative", "treatment"].includes(scenario.kind)) errors.push(`${prefix}: invalid scenario kind`);
    if (scenario.parameters !== undefined && !object(scenario.parameters)) errors.push(`${prefix}: parameters must be an object`);
    const values = Object.fromEntries(model.parameters.map((parameter) => [parameter.id, parameter.default]));
    for (const [id, value] of Object.entries(object(scenario.parameters) ? scenario.parameters : {})) {
      const definition = parameters.get(id);
      if (!definition) { errors.push(`${prefix}: unknown parameter ${id}`); continue; }
      if (!numeric(value) || value < definition.min || value > definition.max) errors.push(`${prefix}: ${id} must be finite and between ${definition.min} and ${definition.max}`);
      else values[id] = value;
    }
    if (scenario.uncertainty !== undefined && !object(scenario.uncertainty)) errors.push(`${prefix}: uncertainty must be an object`);
    const uncertainty = {};
    for (const [id, distribution] of Object.entries(object(scenario.uncertainty) ? scenario.uncertainty : {})) {
      const definition = parameters.get(id);
      if (!definition || !object(distribution)) { errors.push(`${prefix}: invalid uncertainty for ${id}`); continue; }
      const { type } = distribution;
      if (!["fixed", "uniform", "triangular", "normal"].includes(type)) { errors.push(`${prefix}: unsupported distribution for ${id}`); continue; }
      const bounded = (value) => numeric(value) && value >= definition.min && value <= definition.max;
      if (type === "fixed") {
        const value = distribution.value ?? values[id];
        if (!bounded(value)) errors.push(`${prefix}: invalid fixed ${id}`);
        uncertainty[id] = { type, value };
        continue;
      }
      const min = distribution.min ?? definition.min;
      const max = distribution.max ?? definition.max;
      if (!bounded(min) || !bounded(max) || min > max) errors.push(`${prefix}: invalid uncertainty range for ${id}`);
      const clean = { type, min, max };
      if (type === "triangular") {
        clean.mode = distribution.mode ?? Math.max(min, Math.min(max, values[id]));
        if (!numeric(clean.mode) || clean.mode < min || clean.mode > max) errors.push(`${prefix}: invalid triangular mode for ${id}`);
      }
      if (type === "normal") {
        clean.mean = distribution.mean ?? values[id];
        clean.stddev = distribution.stddev ?? (max - min) / 6;
        if (!numeric(clean.mean) || clean.mean < min || clean.mean > max || !numeric(clean.stddev) || clean.stddev < 0 || clean.stddev > definition.max - definition.min) errors.push(`${prefix}: invalid normal distribution for ${id}`);
      }
      uncertainty[id] = clean;
    }
    const presets = scenario.stressPresets ?? [];
    if (!Array.isArray(presets) || presets.length > 16 || presets.some((id) => typeof id !== "string" || id.length > 96)) errors.push(`${prefix}: invalid stressPresets`);
    const additions = {};
    if (scenario.timelineFork !== undefined) {
      const fork = scenario.timelineFork;
      if (!model.supportsForks || !object(fork) || !Number.isInteger(fork.month) || fork.month < 0 || fork.month >= years * 12 || !Array.isArray(fork.operations) || !fork.operations.length || fork.operations.length > 8) errors.push(`${prefix}: unsupported or invalid timeline fork`);
      else {
        for (const operation of fork.operations) {
          if (!object(operation) || Object.keys(operation).some((key) => !["op", "target", "value"].includes(key)) || !["set_parameter", "add_building", "apply_stress_preset"].includes(operation.op)) { errors.push(`${prefix}: fork permits parameter, new building and stress operations only`); continue; }
          if (operation.op === "set_parameter") { const definition = parameters.get(operation.target); if (!definition || !numeric(operation.value) || operation.value < definition.min || operation.value > definition.max) errors.push(`${prefix}: invalid fork parameter`); }
          if (operation.op === "add_building") { const checked = validateBuildingProposal(operation.value); if (!checked.valid) errors.push(...checked.errors); }
          if (operation.op === "apply_stress_preset" && typeof operation.value !== "string") errors.push(`${prefix}: fork stress value must be a preset ID`);
        }
        if (fork.mode !== undefined && !["scenario", "selected-future"].includes(fork.mode)) errors.push(`${prefix}: invalid fork mode`);
        if (fork.mode === "selected-future" && (runs !== 1 || !Number.isInteger(fork.sourceSeed) || fork.sourceSeed < 0 || fork.sourceSeed > 0xffffffff)) errors.push(`${prefix}: selected-future fork must have one run and a uint32 sourceSeed`);
        if (fork.sourceModelVersion && fork.sourceModelVersion !== model.version) errors.push(`${prefix}: fork source model version must match; old histories are not reinterpreted`);
        additions.timelineFork = { schemaVersion: "timeline-fork.v1", month: fork.month, operations: clone(fork.operations), mode: fork.mode || "scenario" };
        for (const key of ["sourceExperimentId", "sourceRunId", "sourceScenarioId", "sourceModelVersion", "sourceSeed"]) if (fork[key] !== undefined) additions.timelineFork[key] = fork[key];
      }
    }
    if (scenario.inheritsFrom) { additions.inheritsFrom = scenario.inheritsFrom; additions.overrides = clone(scenario.overrides); }
    if (scenario.outcomeCriteria !== undefined) {
      const definition = scenario.outcomeCriteria;
      const ruleValid = (rule) => object(rule) && Object.keys(rule).every((key) => ["metricId", "operator", "value"].includes(key)) && model.metrics.some((metric) => metric.id === rule.metricId) && ["gte", "lte"].includes(rule.operator) && numeric(rule.value);
      if (!object(definition) || Object.keys(definition).some((key) => !["success", "failure"].includes(key)) || ![definition.success, definition.failure].every((rules) => Array.isArray(rules) && rules.length > 0 && rules.length <= 8 && rules.every(ruleValid))) errors.push(`${prefix}: outcomeCriteria requires 1–8 success rules (ALL) and 1–8 failure rules (ANY; precedence)`);
      else additions.outcomeCriteria = clone(definition);
    }
    if (scenario.projects !== undefined) {
      if (!model.supportsProjects && scenario.projects?.length) errors.push(`${prefix}: this model version does not support building projects`);
      if (!Array.isArray(scenario.projects) || scenario.projects.length > WORLD_EDIT_LIMITS.maxProjects) errors.push(`${prefix}: projects must contain at most 24 proposals`);
      else {
        const projects = [];
        const projectIds = new Set();
        for (const project of scenario.projects) {
          const checked = validateBuildingProposal(project);
          if (!checked.valid) { errors.push(...checked.errors.map((error) => `${prefix}: ${error}`)); continue; }
          if (projectIds.has(checked.values.id)) errors.push(`${prefix}: duplicate building ID ${checked.values.id}`);
          projectIds.add(checked.values.id);
          const placement = validateBuildingPlacement(checked.values, { buildings: projects });
          if (!placement.valid) errors.push(...placement.errors.map((error) => `${prefix}: ${error}`));
          projects.push(checked.values);
        }
        additions.projects = projects;
      }
    }
    if (scenario.worldVisuals !== undefined) {
      const checked = validateWorldVisuals(scenario.worldVisuals);
      if (!checked.valid) errors.push(...checked.errors.map((error) => `${prefix}: ${error}`));
      else additions.worldVisuals = checked.values;
    }
    if (scenario.successCriterion !== undefined) {
      const criterion = scenario.successCriterion;
      if (!object(criterion) || Object.keys(criterion).some((key) => !["metricId", "operator", "value"].includes(key)) || !model.metrics.some((metric) => metric.id === criterion.metricId) || !["gte", "lte"].includes(criterion.operator) || !numeric(criterion.value)) errors.push(`${prefix}: invalid successCriterion`);
      else additions.successCriterion = clone(criterion);
    }
    if (scenario.scheduledStress !== undefined) {
      if (!Array.isArray(scenario.scheduledStress) || scenario.scheduledStress.length > 16) errors.push(`${prefix}: invalid scheduledStress`);
      else {
        if (scenario.scheduledStress.length && !model.supportsScheduledStress) errors.push(`${prefix}: this model version does not support timed stress`);
        for (const stress of scenario.scheduledStress) if (!object(stress) || Object.keys(stress).some((key) => !["presetId", "startMonth"].includes(key)) || !validId(stress.presetId) || !Number.isInteger(stress.startMonth) || stress.startMonth < 0 || stress.startMonth >= years * 12) errors.push(`${prefix}: timed stress needs a valid presetId and startMonth within the horizon`);
        additions.scheduledStress = clone(scenario.scheduledStress);
      }
    }
    return { id: scenario.id, name: scenario.name?.trim(), kind: scenario.kind, parameters: values, uncertainty, stressPresets: Array.isArray(presets) ? [...presets] : [], ...additions };
  });
  if (errors.length) throw new DecisionValidationError(errors);
  const projectStates = runs * normalizedScenarios.reduce((sum, scenario) => sum + (scenario.projects?.length || 0), 0) * (years * 12 + 1);
  if (retainTraces && projectStates > DECISION_LIMITS.maxProjectStates) throw new DecisionValidationError([`Projects require ${projectStates.toLocaleString("en-US")} monthly states; limit is ${DECISION_LIMITS.maxProjectStates}. Reduce runs, projects, scenarios, or horizon; no replay states are discarded.`]);
  const workload = decisionReplayWorkload({ runs, years, scenarios: normalizedScenarios }, model);
  if (retainTraces && (workload.projects > DECISION_LIMITS.maxProjectStates || workload.monthly > DECISION_LIMITS.maxMonthlyMetricPoints || workload.weight > DECISION_LIMITS.maxReplayWeight)) throw new DecisionValidationError(["Monthly replay exceeds memory budget (200000 project states, 600000 metric rows, or 650000 weighted observations). Reduce runs, projects, or horizon; no rows are silently dropped."]);
  return { schemaVersion: DECISION_SCHEMA_VERSION, name: input.name.trim(), decision: input.decision || "", modelId: model.id, modelVersion: model.version, seed, runs, years, scenarios: normalizedScenarios, metadata: clone(input.metadata || {}) };
}

export function createDecisionManifest(experiment, model) {
  const input = Object.fromEntries(["schemaVersion", "name", "decision", "modelId", "modelVersion", "seed", "runs", "years", "scenarios", "metadata"].map((key) => [key, experiment[key]]));
  return clone({ schemaVersion: DECISION_MANIFEST_VERSION, engineVersion: DECISION_ENGINE_VERSION, hblVersion: "decision-demo.v1", modelId: model.id, modelVersion: model.version, exportedAt: new Date().toISOString(), experiment: input, parameterDefinitions: model.parameters, metricDefinitions: model.metrics, limitations: model.limitations, sampling: "independent parameter streams; matched run-index seeds across scenarios; normal distributions clipped to configured bounds" });
}
