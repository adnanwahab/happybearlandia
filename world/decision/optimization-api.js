/** Server-only persisted OptimizationJob API. POST/GET /api/decision-optimizations;
 * POST :id/start|cancel; GET :id/results|manifest. Start is explicit. Jobs never
 * apply candidates. Worker runs the same executeDecisionExperiment used by the
 * flagship; summaries retain inputs/seeds, not every monthly screen replay.
 */
import { join } from "node:path";
import { createDecisionStore } from "./store.js";
import { normalizeOptimizationInput, executeOptimizationJob, OPTIMIZATION_LIMITS } from "./optimization.js";
import { clone, validId, DecisionValidationError, isTerminal, DECISION_ENGINE_VERSION } from "./contracts.js";
const base = "/api/decision-optimizations";
const json = (value, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } });
async function body(request) {
  if (Number(request.headers.get("content-length")) > 524288) throw new DecisionValidationError(["Optimization input exceeds 512 KiB"], 413);
  const reader = request.body?.getReader(); if (!reader) throw new DecisionValidationError(["JSON body required"]);
  let text = "", bytes = 0; const decoder = new TextDecoder();
  for (;;) { const next = await reader.read(); if (next.done) break; bytes += next.value.byteLength; if (bytes > 524288) { await reader.cancel(); throw new DecisionValidationError(["Optimization input exceeds 512 KiB"], 413); } text += decoder.decode(next.value, { stream: true }); }
  try { return JSON.parse(text + decoder.decode()); } catch { throw new DecisionValidationError(["Invalid JSON"]); }
}
export function createOptimizationApiHandler(options = {}) {
  const baseStore = options.store || createDecisionStore(options);
  const store = options.optimizationStore || createDecisionStore({ directory: join(baseStore.directory || process.env.TMPDIR || "/tmp", "decision-optimizations") });
  const active = new Map(); const cache = new Map(); const writes = new Map();
  const save = (job) => { const previous = writes.get(job.id) || Promise.resolve(); const snapshot = clone(job); const next = previous.catch(() => {}).then(() => store.save({ experiment: snapshot, runs: [] })); writes.set(job.id, next); return next; };
  const load = async (id) => { let job = cache.get(id) || (await store.load(id))?.experiment; if (!job) return null; if (job.status === "running" && !active.has(id)) { job.status = "failed"; job.error = "Server restarted during optimization; stored completed candidate summaries remain available."; await save(job); } cache.set(id, job); return job; };
  const moduleFor = async (version) => {
    if (options.model) return { housingModel: options.model, simulateHousingRun: options.simulateRun, applyStressPresets: options.applyStressPresets };
    const module = await import(version === "1.0.0" ? "../models/housing/legacy-v1.js" : version === "1.1.0" ? "../models/housing/legacy-v1.1.js" : "../models/housing/index.js");
    if (version && module.housingModel.version !== version) throw new DecisionValidationError(["Requested model version is unavailable"]);
    return module;
  };
  async function start(job) {
    if (job.status !== "created") throw new DecisionValidationError(["Only a created optimization can start"], 409);
    if (active.size) throw new DecisionValidationError(["An optimization is already active; cancel or wait"], 429);
    const state = { cancelled: false, worker: null, finished: false, lastSave: 0 }; active.set(job.id, state);
    job.status = "running"; job.startedAt = new Date().toISOString();
    try { await save(job); } catch (error) { active.delete(job.id); job.status = "created"; throw error; }
    const update = (value) => { if (state.finished) return; Object.assign(job, value); if (performance.now() - state.lastSave > 750) { state.lastSave = performance.now(); save(job).catch((error) => finish("failed", error.message)); } };
    const finish = async (status, error) => { if (state.finished) return; state.finished = true; job.status = status; job.completedAt = new Date().toISOString(); if (error) job.error = error; state.worker?.terminate(); try { await save(job); } catch (failure) { job.status = "failed"; job.error = `Persistence failed: ${failure.message}`; } finally { active.delete(job.id); } };
    try {
    if (!options.model && options.useWorker !== false && typeof Worker !== "undefined") {
      const worker = new Worker(new URL("./worker.js", import.meta.url).href, { type: "module" }); state.worker = worker;
      worker.onmessage = ({ data }) => { if (data.type === "optimization-progress") update(data.update); if (data.type === "optimization-done") { update(data.result); void finish(state.cancelled ? "cancelled" : data.result.status); } if (data.type === "error") void finish("failed", data.error); };
      worker.onerror = (event) => { event.preventDefault?.(); void finish("failed", event.message || "Optimization worker failed"); };
      worker.postMessage({ type: "optimize", config: job.config });
    } else {
      const module = await moduleFor(job.config.input.modelVersion);
      void executeOptimizationJob({ config: job.config, model: module.housingModel, simulateRun: module.simulateHousingRun, simulateFork: module.simulateHousingFork, applyStressPresets: module.applyStressPresets, shouldCancel: () => state.cancelled, onProgress: update }).then((result) => { update(result); return finish(result.status); }).catch((error) => finish("failed", error.message));
    }
    } catch (error) { await finish("failed", error.message); }
  }
  const handle = async (request) => {
    try {
      const pathname = new URL(request.url).pathname;
      if (pathname !== base && !pathname.startsWith(`${base}/`)) return json({ error: "Not found" }, 404);
      const parts = pathname.slice(base.length).split("/").filter(Boolean);
      if (parts.length > 2 || parts.some((part) => !validId(part))) return json({ error: "Invalid optimization route" }, 400);
      if (!parts.length) {
        if (request.method === "GET") { const jobs = []; for (const record of await store.list()) jobs.push(await load(record.experiment.id)); return json({ jobs }); }
        if (request.method !== "POST") return json({ error: "Use GET or POST" }, 405);
        if ((await store.list()).length >= OPTIMIZATION_LIMITS.maxJobs) throw new DecisionValidationError(["Optimization history limit reached (30)"], 409);
        let raw = await body(request);
        const manifest = raw?.manifest || raw;
        if (manifest?.schemaVersion === "optimization-manifest.v1") { if (manifest.engineVersion !== DECISION_ENGINE_VERSION) throw new DecisionValidationError(["Optimization engine version is unavailable"]); raw = manifest.config; }
        const module = await moduleFor(raw.input?.modelVersion);
        const config = normalizeOptimizationInput(raw, module.housingModel);
        const job = { schemaVersion: "optimization-job.v1", id: `optimization_${crypto.randomUUID()}`, config, status: "created", createdAt: new Date().toISOString(), candidates: [], pareto: [], progress: { completed: 0, total: config.candidateCount * 200 + config.finalists * 1000, successful: 0, failed: 0, phase: "created" } };
        await save(job); cache.set(job.id, job); return json({ job }, 201);
      }
      const job = await load(parts[0]); if (!job) return json({ error: "Optimization not found" }, 404);
      if (request.method === "POST" && parts[1] === "start") { await start(job); return json({ job }, 202); }
      if (request.method === "POST" && parts[1] === "cancel") { const state = active.get(job.id); if (state) { state.cancelled = true; state.worker?.postMessage({ type: "cancel" }); job.cancelRequestedAt = new Date().toISOString(); } else if (job.status === "created") { job.status = "cancelled"; await save(job); } return json({ job }); }
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      if (!parts[1] || parts[1] === "results") return json({ job });
      if (parts[1] === "manifest") return json({ schemaVersion: "optimization-manifest.v1", engineVersion: DECISION_ENGINE_VERSION, config: job.config, jobId: job.id, modelVersion: job.config.input.modelVersion, sampling: "Matched run-index seeds; 100 screen, 500 finalists", summaries: job.candidates });
      return json({ error: "Not found" }, 404);
    } catch (error) { return json({ error: error.message || "Optimization request failed" }, error.status || 500); }
  };
  handle.close = async () => { for (const [id, state] of active) { state.cancelled = true; state.finished = true; state.worker?.terminate(); const job = cache.get(id); if (!isTerminal(job.status)) { job.status = "cancelled"; job.completedAt = new Date().toISOString(); await save(job); } } active.clear(); await Promise.allSettled([...writes.values()]); };
  return handle;
}
