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

  const score = result.score == null ? null : finiteNumber(result.score);
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
    // Retry the identical simulation input once; never substitute generated output.
    const body = JSON.stringify({ schemaVersion: "civic-simulation-request.v1", experiment, world, options: runOptions || {} });
    const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? Math.min(options.timeoutMs, 60000) : 10000;
    let payload;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      let timer;
      let retryable = true;
      try {
        payload = await Promise.race([
          (async () => {
            const response = await fetchImpl(endpoint, {
              method: "POST",
              headers: { "content-type": "application/json", accept: "application/json" },
              body,
              signal: controller.signal,
            });
            retryable = response.status >= 500 || response.status === 408 || response.status === 429;
            if (!response.ok) throw new Error(`Civic simulator returned HTTP ${response.status}`);
            // Missing/malformed data is an explicit failure, never a zero score.
            retryable = false;
            return await response.json();
          })(),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              retryable = true;
              reject(new Error(`Civic simulator timed out after ${timeoutMs}ms`));
              controller.abort();
            }, timeoutMs);
          }),
        ]);
        break;
      } catch (error) {
        clearTimeout(timer);
        if (!retryable || attempt === 1) throw new Error(`Simulation unavailable: ${error.message}`, { cause: error });
        await new Promise(resolve => setTimeout(resolve, 250));
      } finally {
        clearTimeout(timer);
      }
    }
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
