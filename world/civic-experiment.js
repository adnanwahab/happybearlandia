import { extractSimulationParameters, summarizeParameterExtraction } from "./parameter-extractor.js";
import { deriveMetricRegistry } from "./metric-registry.js";

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const asObject = (value) => isObject(value) ? value : {};
const asArray = (value) => Array.isArray(value) ? value : [];

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function firstNumber(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashString(value) {
  // FNV-1a 32-bit. This is an identity/fingerprint, not a security primitive.
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (!isObject(item)) return "";
      return firstString(item.title, item.name, item.label, item.text, item.description) || "";
    })
    .filter(Boolean);
}

function normalizePackageList(synthesis) {
  if (Array.isArray(synthesis)) return synthesis.filter(isObject);
  const root = asObject(synthesis);

  for (const candidate of [root.packages, root.plans, root.results]) {
    if (Array.isArray(candidate) && candidate.some(isObject)) return candidate.filter(isObject);
  }

  if (isObject(root.package)) return [root.package];
  if (isObject(root.plan)) return [root.plan];
  return Object.keys(root).length ? [root] : [];
}

function normalizeAction(item, index) {
  const row = asObject(item);
  const proposal = isObject(row.proposal) ? row.proposal : row;
  const id = firstString(proposal.id, proposal.proposalId, row.proposalId, row.id) || `action_${index + 1}`;
  const title = firstString(proposal.title, proposal.name, proposal.label, row.title, row.name) || `Action ${index + 1}`;

  return compact({
    id,
    title,
    description: firstString(proposal.description, proposal.summary, proposal.text, proposal.rationale, row.description),
    needId: firstString(proposal.needId, proposal.need_id, row.needId, row.need_id),
    changeLevel: firstString(proposal.changeLevel, proposal.change_level, row.changeLevel),
    score: firstNumber(row.score, row.utility, row.support, proposal.score),
    cost: proposal.cost ?? row.cost,
    timeline: proposal.timeline ?? row.timeline,
    implementation: proposal.implementation ?? row.implementation,
    dependencies: stringList(proposal.dependencies ?? row.dependencies),
    metrics: asArray(proposal.metrics ?? row.metrics),
  });
}

function normalizeGoal(goal, index) {
  if (typeof goal === "string") return { id: `goal_${index + 1}`, title: goal.trim() };
  const row = asObject(goal);
  return compact({
    id: firstString(row.id, row.needId, row.need_id) || `goal_${index + 1}`,
    title: firstString(row.title, row.name, row.label, row.text) || `Goal ${index + 1}`,
    metric: row.metric,
    target: row.target,
  });
}

function requestNumber(request, keys, fallback, min, max) {
  for (const key of keys) {
    const value = firstNumber(request[key]);
    if (value !== undefined) return Math.max(min, Math.min(max, value));
  }
  return fallback;
}

function sanitizeSeed(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value) >>> 0;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Math.floor(Number(value)) >>> 0;
  return null;
}

export function buildPlanManifest(synthesis, request = {}, now = new Date()) {
  const packages = normalizePackageList(synthesis);
  const primary = packages[0] || {};
  const items = asArray(primary.items ?? primary.actions ?? primary.proposals);
  const actions = items.map(normalizeAction);

  const explicitGoals = asArray(primary.goals ?? primary.objectives).map(normalizeGoal);
  const inferredGoalIds = [...new Set(actions.map((action) => action.needId).filter(Boolean))];
  const goals = explicitGoals.length
    ? explicitGoals
    : inferredGoalIds.map((needId) => ({ id: needId, title: `Improve ${needId.replace(/[-_]+/g, " ")}` }));

  const title = firstString(primary.title, primary.name, primary.label, primary.planTitle)
    || (actions.length ? actions.slice(0, 2).map((action) => action.title).join(" + ") : "Civic plan");
  const summary = firstString(primary.summary, primary.description, primary.rationale)
    || (actions.length ? actions.map((action) => action.title).join("; ") : "Synthesized civic plan");

  const sourcePackageId = firstString(primary.id, primary.packageId, primary.planId);
  const generatedAt = now.toISOString();
  const manifestCore = {
    schemaVersion: "plan-manifest.v1",
    source: compact({
      system: "dear-congress",
      endpoint: "/api/synthesize",
      synthesisId: firstString(asObject(synthesis).synthesisId, asObject(synthesis).id),
      packageId: sourcePackageId,
      packageIndex: packages.length ? 0 : undefined,
    }),
    title,
    summary,
    goals,
    actions,
    affectedPopulations: stringList(primary.affectedPopulations ?? primary.affected_populations ?? primary.populations),
    budget: primary.budget ?? primary.funding,
    timeline: primary.timeline ?? primary.milestones ?? [],
    dependencies: stringList(primary.dependencies),
    assumptions: asArray(primary.assumptions),
    metrics: asArray(primary.metrics ?? primary.outcomes),
    implementationSteps: asArray(primary.implementationSteps ?? primary.implementation_steps),
    failureConditions: asArray(primary.failureConditions ?? primary.failure_conditions ?? primary.risks),
    alternatives: packages.slice(1).map((pkg, index) => compact({
      id: firstString(pkg.id, pkg.packageId, pkg.planId) || `alternative_${index + 1}`,
      title: firstString(pkg.title, pkg.name, pkg.label) || `Alternative ${index + 1}`,
      summary: firstString(pkg.summary, pkg.description),
    })),
  };

  return {
    ...manifestCore,
    id: `plan_${hashString(stableStringify(manifestCore))}`,
    generatedAt,
  };
}

export function buildCivicExperiment(synthesis, request = {}, now = new Date()) {
  const safeRequest = asObject(request);
  const plan = buildPlanManifest(synthesis, safeRequest, now);
  const journalIds = asArray(safeRequest.journalIds ?? safeRequest.journal_ids)
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());

  const variables = extractSimulationParameters(plan, safeRequest.parameterOverrides ?? safeRequest.parameter_overrides);
  const metricRegistry = deriveMetricRegistry(plan);

  const experimentCore = {
    schemaVersion: "civic-experiment.v1",
    source: compact({
      system: "dear-congress",
      journalIds,
      synthesisId: plan.source.synthesisId,
      planManifestId: plan.id,
    }),
    plan,
    assumptions: plan.assumptions,
    worldModel: {
      variables,
      parameterExtraction: summarizeParameterExtraction(variables),
      causalEdges: [],
      scenarioFamilies: [],
    },
    experiment: {
      runs: Math.round(requestNumber(safeRequest, ["runs", "numRuns", "num_runs"], 100, 1, 100000)),
      horizonYears: requestNumber(safeRequest, ["horizonYears", "horizon_years", "years"], 10, 0.1, 200),
      seed: sanitizeSeed(safeRequest.seed),
    },
    outcomes: {
      metrics: plan.metrics,
      metricRegistry,
      worlds: [],
      clusters: [],
    },
    analysis: {
      robustness: null,
      sensitivities: [],
      tailRisks: [],
      failureModes: [],
      suggestedChanges: [],
    },
    lineage: {
      parentExperimentId: firstString(safeRequest.parentExperimentId, safeRequest.parent_experiment_id) || null,
      revision: Math.round(requestNumber(safeRequest, ["revision"], 1, 1, 1000000)),
    },
  };

  return {
    ...experimentCore,
    id: `exp_${hashString(stableStringify(experimentCore))}`,
    createdAt: now.toISOString(),
  };
}

export const __test = {
  hashString,
  normalizePackageList,
  normalizeAction,
};
