import { buildCivicExperiment } from "./civic-experiment.js";

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function isCivicExperiment(value) {
  return isObject(value) && value.schemaVersion === "civic-experiment.v1";
}

export function validateCivicExperiment(experiment) {
  const errors = [];
  if (!isCivicExperiment(experiment)) errors.push("schemaVersion must be civic-experiment.v1");
  if (!isObject(experiment?.plan)) errors.push("plan is required");
  if (experiment?.plan?.schemaVersion !== "plan-manifest.v1") errors.push("plan.schemaVersion must be plan-manifest.v1");
  if (!Array.isArray(experiment?.worldModel?.variables)) errors.push("worldModel.variables must be an array");
  if (!isObject(experiment?.experiment)) errors.push("experiment settings are required");
  if (!Number.isFinite(Number(experiment?.experiment?.runs)) || Number(experiment?.experiment?.runs) < 1) errors.push("experiment.runs must be >= 1");
  if (!Number.isFinite(Number(experiment?.experiment?.horizonYears)) || Number(experiment?.experiment?.horizonYears) <= 0) errors.push("experiment.horizonYears must be > 0");

  return {
    ok: errors.length === 0,
    errors,
    variableCount: Array.isArray(experiment?.worldModel?.variables) ? experiment.worldModel.variables.length : 0,
  };
}

export function resolveCivicExperimentPayload(payload, request = {}) {
  if (isCivicExperiment(payload?.civicExperiment)) {
    return {
      experiment: payload.civicExperiment,
      source: "server-envelope",
      warning: null,
    };
  }

  if (isCivicExperiment(payload)) {
    return {
      experiment: payload,
      source: "direct-experiment",
      warning: null,
    };
  }

  // Defensive compatibility path: older/stale HBL servers and pasted Dear Congress
  // responses may contain only the synthesis payload. Build the exact same v1
  // contract in the browser rather than blocking the lab. This is intentionally
  // visible to the user so a server integration regression cannot hide itself.
  const synthesis = isObject(payload?.synthesis) ? payload.synthesis : payload;
  if (!isObject(synthesis) && !Array.isArray(synthesis)) {
    throw new Error("JSON does not contain a civic experiment or Dear Congress synthesis payload");
  }

  const experiment = buildCivicExperiment(synthesis, request);
  return {
    experiment,
    source: "browser-normalized",
    warning: "The server response did not include civicExperiment.v1; the lab normalized the Dear Congress synthesis locally. Restart/check HBL if you expected the server contract.",
  };
}
