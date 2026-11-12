import { readRunInput } from "./run-input.js";
import { fingerprint } from "./reproducibility.js";
import { simulateExperiment } from "./simulation-adapter.js";

function nowIso() { return new Date().toISOString(); }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

export class RunJobManager {
  constructor(options = {}) {
    this.jobs = new Map();
    this.cache = options.cache || new Map();
    this.listeners = new Map();
  }

  createJob({ experiment, worldBatch, adapter, chunkSize = 250, concurrency = 16 }) {
    if (!experiment || !worldBatch?.worlds || !adapter) throw new Error("Run job requires experiment, worldBatch, and adapter");
    const identity = { experimentId: experiment.id, plan: experiment.plan, model: experiment.model, seed: worldBatch.seed, worldIds: worldBatch.worlds.map((row) => row.id), adapter: adapter.id };
    const id = `run_${fingerprint(identity)}`;
    if (this.jobs.has(id)) return this.jobs.get(id).public;
    const internal = {
      id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: "queued",
      completed: 0,
      total: worldBatch.worlds.length,
      chunkSize: Math.max(1, Math.round(chunkSize)),
      concurrency: Math.max(1, Math.min(64, Math.round(concurrency))),
      experimentId: experiment.id || null,
      seed: worldBatch.seed ?? null,
      adapter: { id: adapter.id, label: adapter.label, predictive: adapter.predictive, modelClass: adapter.modelClass },
      simulations: new Array(worldBatch.worlds.length),
      error: null,
      public: null,
      promise: null,
    };
    internal.public = this.snapshot(internal);
    this.jobs.set(id, internal);
    internal.promise = this.#run(internal, { experiment, worldBatch, adapter });
    // Polling clients never await this promise; retain rejection for wait() callers.
    internal.promise.catch(() => {});
    return internal.public;
  }

  async #run(job, { experiment, worldBatch, adapter }) {
    job.status = "running";
    this.#emit(job);
    try {
      for (let start = 0; start < worldBatch.worlds.length; start += job.chunkSize) {
        const chunk = worldBatch.worlds.slice(start, start + job.chunkSize);
        const missing = [];
        const cachedRows = [];
        for (let offset = 0; offset < chunk.length; offset += 1) {
          const world = chunk[offset];
          const key = fingerprint({ plan: experiment.plan, model: experiment.model, adapter: adapter.id, world });
          if (this.cache.has(key)) cachedRows.push([start + offset, clone(this.cache.get(key)), key]);
          else missing.push({ index: start + offset, world, key });
        }
        for (const [index, row] of cachedRows) job.simulations[index] = row;
        if (missing.length) {
          const batch = await simulateExperiment(experiment, { worlds: missing.map((row) => row.world) }, adapter, { concurrency: job.concurrency });
          batch.simulations.forEach((simulation, index) => {
            const target = missing[index];
            job.simulations[target.index] = simulation;
            this.cache.set(target.key, clone(simulation));
          });
        }
        job.completed = Math.min(job.total, start + chunk.length);
        job.updatedAt = nowIso();
        this.#emit(job);
      }
      job.status = "complete";
      job.updatedAt = nowIso();
      this.#emit(job);
      return this.snapshot(job, true);
    } catch (error) {
      job.status = "failed";
      job.error = String(error?.message || error);
      job.updatedAt = nowIso();
      this.#emit(job);
      throw error;
    }
  }

  snapshot(jobOrId, includeResults = false) {
    const job = typeof jobOrId === "string" ? this.jobs.get(jobOrId) : jobOrId;
    if (!job) return null;
    return {
      schemaVersion: "hbl-run-job.v1",
      id: job.id,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      status: job.status,
      completed: job.completed,
      total: job.total,
      progress: job.total ? job.completed / job.total : 1,
      experimentId: job.experimentId,
      seed: job.seed,
      adapter: job.adapter,
      error: job.error,
      ...(includeResults || job.status === "complete" ? { simulationBatch: { schemaVersion: "simulation-batch.v1", experimentId: job.experimentId, adapter: job.adapter, simulations: job.simulations } } : {}),
    };
  }

  get(id, includeResults = false) { return this.snapshot(id, includeResults); }
  async wait(id) { const job = this.jobs.get(id); if (!job) throw new Error("Run job not found"); await job.promise; return this.snapshot(job, true); }
  onProgress(id, fn) {
    if (!this.listeners.has(id)) this.listeners.set(id, new Set());
    this.listeners.get(id).add(fn);
    return () => this.listeners.get(id)?.delete(fn);
  }
  #emit(job) {
    job.public = this.snapshot(job);
    for (const fn of this.listeners.get(job.id) || []) fn(job.public);
  }
}

export function createRunApiHandler(manager, resolveRunInput) {
  if (!manager) throw new Error("Run API requires a RunJobManager");
  return async function handleRunApi(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "api" || parts[1] !== "runs") return null;
    const id = parts[2] || null;
    if (!id && request.method === "POST") {
      const body = await readRunInput(request);
      const input = await resolveRunInput(body);
      return Response.json(manager.createJob(input), { status: 202 });
    }
    if (id && request.method === "GET") {
      const job = manager.get(id, url.searchParams.get("results") === "1");
      return job ? Response.json(job) : Response.json({ error: "Run not found" }, { status: 404 });
    }
    return Response.json({ error: "Unsupported run API operation" }, { status: 405 });
  };
}
