import { handleExperimentApi } from "./experiment-api.js";
import { loadServerExperiment } from "./server-experiment-store.js";
import { generateWorlds } from "./world-generator.js";
import { RunJobManager, createRunApiHandler } from "./run-job-manager.js";
import {
  createAgentCivicAdapter,
  createHblCivicDynamicsAdapter,
  createImplementationStressAdapter,
} from "./simulation-adapter.js";

function finiteInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function errorStatus(error, fallback = 400) {
  const status = Number(error?.status);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : fallback;
}

function apiError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeAdapterName(value) {
  return String(value || "hbl-civic-dynamics.v2").trim().toLowerCase();
}

export function resolveServerSimulationAdapter(body = {}) {
  const requested = normalizeAdapterName(body.adapter || body.adapterId);
  if (requested === "agent" || requested.includes("agent-civic")) {
    return createAgentCivicAdapter(body.agentOptions || {});
  }
  if (requested === "stress" || requested.includes("implementation-stress")) {
    return createImplementationStressAdapter();
  }
  return createHblCivicDynamicsAdapter();
}

function snapshotExperiment(record) {
  const snapshot = record?.snapshot;
  if (!snapshot || typeof snapshot !== "object") return { experiment: null, worldBatch: null };
  if (snapshot.experiment?.schemaVersion === "civic-experiment.v1") {
    return { experiment: snapshot.experiment, worldBatch: snapshot.worldBatch || null };
  }
  if (snapshot.schemaVersion === "civic-experiment.v1") {
    return { experiment: snapshot, worldBatch: null };
  }
  return { experiment: snapshot.experiment || null, worldBatch: snapshot.worldBatch || null };
}

/**
 * Resolve the flexible POST /api/runs body into the input expected by
 * RunJobManager.createJob(). A run can reference an immutable saved experiment
 * or provide an experiment/world batch inline for local development.
 */
export async function resolveServerRunInput(body = {}, options = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw apiError("Run request body must be a JSON object", 400);
  }

  let experiment = body.experiment || body.snapshot?.experiment || null;
  let worldBatch = body.worldBatch || body.snapshot?.worldBatch || null;
  const savedExperimentId = body.experimentId || body.recordId || null;

  if (!experiment && savedExperimentId) {
    const record = await loadServerExperiment(savedExperimentId, { root: options.experimentRoot });
    if (!record) throw apiError(`Experiment not found: ${savedExperimentId}`, 404);
    const resolved = snapshotExperiment(record);
    experiment = resolved.experiment;
    worldBatch ||= resolved.worldBatch;
  }

  if (!experiment?.id || experiment.schemaVersion !== "civic-experiment.v1") {
    throw apiError("Run request requires a civic-experiment.v1 experiment or a valid saved experimentId", 400);
  }

  if (!worldBatch?.worlds?.length) {
    worldBatch = generateWorlds(experiment, {
      runs: finiteInteger(body.runs, experiment?.experiment?.runs || 100, 1, 100000),
      seed: body.seed ?? experiment?.experiment?.seed,
      overrides: body.overrides || {},
      scenarioFamilies: body.scenarioFamilies,
    });
  }

  return {
    experiment,
    worldBatch,
    adapter: options.resolveAdapter
      ? await options.resolveAdapter(body, experiment)
      : resolveServerSimulationAdapter(body),
    chunkSize: finiteInteger(body.chunkSize, 250, 1, 10000),
    concurrency: finiteInteger(body.concurrency, 16, 1, 64),
  };
}

/**
 * Create one handler for the server-only civic APIs added in patches 25/33.
 * The manager intentionally lives for the lifetime of the Bun process so run
 * status can be polled while a job is executing.
 */
export function createServerCivicApiHandler(options = {}) {
  const runManager = options.runManager || new RunJobManager({ cache: options.runCache });
  const runHandler = createRunApiHandler(
    runManager,
    (body) => resolveServerRunInput(body, options),
  );

  return async function handleServerCivicApi(request) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/experiments" || pathname.startsWith("/api/experiments/")) {
      return handleExperimentApi(request, { root: options.experimentRoot });
    }

    if (pathname === "/api/runs" || pathname.startsWith("/api/runs/")) {
      try {
        return await runHandler(request);
      } catch (error) {
        return Response.json(
          { error: String(error?.message || error) },
          { status: errorStatus(error), headers: { "cache-control": "no-store" } },
        );
      }
    }

    return null;
  };
}
