import { applySimulationEffectsToWorld } from "./plan-improver.js";
import { createHttpCivicSimulator, simulatorBridgeConfig, validateCivicSimulationResult } from "./hbl-simulator-bridge.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, finite(value, 0)));
}

function mean(values, fallback = 0.5) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  return finiteValues.length ? finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length : fallback;
}

function normalizedCondition(world, variableId, fallback = 0.5) {
  const value = world?.normalized?.[variableId];
  return Number.isFinite(value) ? clamp01(value) : fallback;
}

function metric(value) {
  return Math.round(clamp01(value) * 1000) / 10;
}

function statusFor(score) {
  if (score >= 70) return "positive";
  if (score >= 45) return "mixed";
  return "negative";
}

export function createSimulationAdapter({
  id,
  label = id,
  predictive = false,
  modelClass = "custom",
  simulateWorld,
  description = "",
}) {
  if (!id || typeof simulateWorld !== "function") throw new Error("A simulation adapter requires id and simulateWorld");
  return { id, label, predictive: Boolean(predictive), modelClass, simulateWorld, description };
}

export function createImplementationStressAdapter() {
  return createSimulationAdapter({
    id: "implementation-stress.v1",
    label: "Implementation stress test",
    predictive: false,
    modelClass: "stress-test",
    description: "Generic stress test of implementation capacity. It does not predict the domain outcome of the civic plan.",
    simulateWorld({ experiment, world }) {
      const agency = normalizedCondition(world, "agency_capacity");
      const funding = normalizedCondition(world, "funding_delivery_rate");
      const compliance = normalizedCondition(world, "local_compliance");
      const enforcement = normalizedCondition(world, "enforcement_rate");
      const labor = normalizedCondition(world, "labor_availability", 0.6);
      const delay = 1 - normalizedCondition(world, "implementation_delay_months", 0.3);
      const support = normalizedCondition(world, "public_support", 0.55);
      const turnover = 1 - normalizedCondition(world, "political_turnover_probability", 0.35);
      const polarization = 1 - normalizedCondition(world, "polarization", 0.45);
      const trust = normalizedCondition(world, "public_trust", 0.55);
      const externalShock = 1 - normalizedCondition(world, "external_shock_probability", 0.35);
      const majorShock = 1 - normalizedCondition(world, "major_disruption_probability", 0.2);

      const delivery = mean([agency, funding, compliance, enforcement, labor, delay]);
      const political = mean([support, turnover, polarization, trust]);
      const disruption = mean([externalShock, majorShock]);
      const viability = delivery * 0.55 + political * 0.25 + disruption * 0.20;

      const metrics = {
        implementationViability: metric(viability),
        deliveryReliability: metric(delivery),
        politicalDurability: metric(political),
        disruptionResilience: metric(disruption),
      };

      return {
        score: metrics.implementationViability,
        status: statusFor(metrics.implementationViability),
        metrics,
        model: {
          id: "implementation-stress.v1",
          predictive: false,
          planId: experiment?.plan?.id || null,
        },
        trace: [
          { component: "delivery", weight: 0.55, value: metric(delivery) },
          { component: "political", weight: 0.25, value: metric(political) },
          { component: "disruption", weight: 0.20, value: metric(disruption) },
        ],
        disclaimer: "Implementation stress score only; connect an HBL domain simulator for policy-outcome predictions.",
      };
    },
  });
}

export function createGlobalSimulationAdapter(globalObject = globalThis) {
  const runner = globalObject?.HBL_CIVIC_SIMULATOR;
  if (typeof runner !== "function") return null;
  const meta = globalObject?.HBL_CIVIC_SIMULATOR_META || {};
  return createSimulationAdapter({
    id: meta.id || "hbl-global-simulator",
    label: meta.label || "HBL simulator",
    predictive: Boolean(meta.predictive),
    modelClass: meta.modelClass || "hbl-domain",
    description: meta.description || "HBL simulator exposed through window.HBL_CIVIC_SIMULATOR.",
    async simulateWorld({ experiment, world, options }) {
      const result = await runner({ experiment, world, options });
      const validation = validateCivicSimulationResult(result, experiment?.outcomes?.metricRegistry || []);
      if (!validation.ok) throw new Error(`Invalid HBL civic simulation result: ${validation.errors.join("; ")}`);
      return result;
    },
  });
}

export function createHttpSimulationAdapter(endpoint, options = {}) {
  const runner = createHttpCivicSimulator(endpoint, options);
  const meta = options.meta || {};
  return createSimulationAdapter({
    id: meta.id || "hbl-http-simulator",
    label: meta.label || "HBL HTTP simulator",
    predictive: Boolean(meta.predictive),
    modelClass: meta.modelClass || "hbl-domain-http",
    description: meta.description || `HBL civic simulator at ${endpoint}`,
    simulateWorld: runner,
  });
}

export function selectSimulationAdapter(globalObject = globalThis) {
  return createGlobalSimulationAdapter(globalObject) || createImplementationStressAdapter();
}

export async function resolveSimulationAdapter(globalObject = globalThis, options = {}) {
  const globalAdapter = createGlobalSimulationAdapter(globalObject);
  if (globalAdapter) return globalAdapter;
  const config = simulatorBridgeConfig(globalObject);
  if (config.endpoint) return createHttpSimulationAdapter(config.endpoint, {
    fetchImpl: options.fetchImpl,
    meta: config.meta || options.meta,
  });
  return createImplementationStressAdapter();
}

function normalizeSimulationResult(world, effectiveWorld, adapter, result) {
  const safe = result && typeof result === "object" ? result : {};
  const score = finite(safe.score ?? safe.metrics?.implementationViability, 0);
  return {
    id: `run_${world.id}`,
    worldId: world.id,
    world,
    effectiveWorld,
    adapter: {
      id: adapter.id,
      label: adapter.label,
      predictive: adapter.predictive,
      modelClass: adapter.modelClass,
    },
    score,
    status: safe.status || statusFor(score),
    metrics: safe.metrics || { score },
    trace: Array.isArray(safe.trace) ? safe.trace : [],
    model: safe.model || { id: adapter.id, predictive: adapter.predictive },
    disclaimer: safe.disclaimer || (adapter.predictive ? null : "Non-predictive simulation adapter."),
    raw: safe.raw,
  };
}

export async function simulateExperiment(experiment, worldBatch, adapter, options = {}) {
  if (!adapter?.simulateWorld) throw new Error("simulateExperiment requires a simulation adapter");
  const worlds = Array.isArray(worldBatch) ? worldBatch : worldBatch?.worlds || [];
  const concurrency = Math.max(1, Math.min(64, Math.round(finite(options.concurrency, 16))));
  const simulations = new Array(worlds.length);
  let completed = 0;

  for (let start = 0; start < worlds.length; start += concurrency) {
    const chunk = worlds.slice(start, start + concurrency);
    const results = await Promise.all(chunk.map(async (world, offset) => {
      const effectiveWorld = applySimulationEffectsToWorld(experiment, world);
      const result = await adapter.simulateWorld({ experiment, world: effectiveWorld, sourceWorld: world, options });
      return [start + offset, normalizeSimulationResult(world, effectiveWorld, adapter, result)];
    }));
    for (const [index, simulation] of results) {
      simulations[index] = simulation;
      completed += 1;
      if (typeof options.onProgress === "function") options.onProgress({ completed, total: worlds.length, simulation });
    }
  }

  return {
    schemaVersion: "simulation-batch.v1",
    experimentId: experiment?.id || null,
    adapter: {
      id: adapter.id,
      label: adapter.label,
      predictive: adapter.predictive,
      modelClass: adapter.modelClass,
      description: adapter.description,
    },
    simulations,
  };
}

export const __test = { normalizedCondition, metric, statusFor, normalizeSimulationResult };
