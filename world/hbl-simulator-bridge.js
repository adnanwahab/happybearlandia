function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function validateCivicSimulationResult(result, metricRegistry = []) {
  const errors = [];
  if (!isObject(result)) return { ok: false, errors: ["simulation result must be an object"] };

  const score = finiteNumber(result.score);
  if (score === null) errors.push("score must be finite");
  if (result.metrics !== undefined && !isObject(result.metrics)) errors.push("metrics must be an object when present");

  for (const [key, value] of Object.entries(result.metrics || {})) {
    if (typeof value === "number" && !Number.isFinite(value)) errors.push(`metric ${key} must be finite`);
  }
  if (result.events !== undefined && !Array.isArray(result.events)) errors.push("events must be an array when present");
  if (result.timeline !== undefined && !Array.isArray(result.timeline)) errors.push("timeline must be an array when present");

  const known = new Set((metricRegistry || []).map((metric) => metric.id));
  const unknownMetrics = Object.keys(result.metrics || {}).filter((id) => !known.has(id));
  return { ok: errors.length === 0, errors, score, unknownMetrics };
}

export function registerHblCivicSimulator(globalObject, simulate, meta = {}) {
  if (!globalObject || typeof simulate !== "function") throw new Error("registerHblCivicSimulator requires a global object and simulate function");
  globalObject.HBL_CIVIC_SIMULATOR = simulate;
  globalObject.HBL_CIVIC_SIMULATOR_META = {
    id: meta.id || "hbl-domain-simulator",
    label: meta.label || "HBL domain simulator",
    predictive: Boolean(meta.predictive),
    modelClass: meta.modelClass || "hbl-domain",
    description: meta.description || "HappyBearLandia civic domain simulator",
    version: meta.version || "1",
  };
  return globalObject.HBL_CIVIC_SIMULATOR_META;
}

export function createHttpCivicSimulator(endpoint, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (!endpoint || typeof fetchImpl !== "function") throw new Error("HTTP civic simulator requires endpoint and fetch");

  return async ({ experiment, world, options: runOptions }) => {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        schemaVersion: "civic-simulation-request.v1",
        experiment,
        world,
        options: runOptions || {},
      }),
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`Civic simulator ${endpoint} returned non-JSON (${response.status})`);
    }
    if (!response.ok) throw new Error(payload?.error || `Civic simulator ${endpoint} returned HTTP ${response.status}`);
    const result = payload?.result && isObject(payload.result) ? payload.result : payload;
    const validation = validateCivicSimulationResult(result, experiment?.outcomes?.metricRegistry || []);
    if (!validation.ok) throw new Error(`Invalid civic simulation result: ${validation.errors.join("; ")}`);
    return result;
  };
}

export function simulatorBridgeConfig(globalObject = globalThis) {
  const endpoint = typeof globalObject?.HBL_CIVIC_SIMULATOR_ENDPOINT === "string"
    ? globalObject.HBL_CIVIC_SIMULATOR_ENDPOINT.trim()
    : "";
  return {
    hasGlobalRunner: typeof globalObject?.HBL_CIVIC_SIMULATOR === "function",
    endpoint: endpoint || null,
    meta: globalObject?.HBL_CIVIC_SIMULATOR_META || null,
  };
}
