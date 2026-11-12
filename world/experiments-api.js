// Server side of plan experiments (server-only; not served to browsers).
//
//   POST /api/world/experiments        start a paired experiment → 202 { experimentId, statusUrl }
//   GET  /api/world/experiments/:id    status, progress, and the result when done
//   GET  /api/world/experiments        recent experiments
//
// Body (all optional except a plan):
// {
//   "plan": PlanSpec | { "proposalIds": [...] },   or
//   "proposalIds": ["t_bus", ...],                  or
//   "package": "Balanced",     // synthesize the current Dear Congress plan and use this package
//   "location": { "lat": 29.7286, "lng": -95.4746 },
//   "seeds": 8, "years": 5, "checkpoints": [1, 3, 5], "maxPeople": 120, "baseSeed": "hbl"
// }

import { readExperimentInput, validateExperimentInput, validateImportedPlan } from "./experiment-input.js";
import { buildTown } from "./gen.js";
import { runPairedExperiment } from "./paired.js";
import { compilePlan } from "./planspec.js";

export const LIMITS = Object.freeze({
  seeds: { def: 8, max: 32 },
  years: { def: 5, max: 10 },
  maxPeople: { def: 120, max: 300 },
  keepJobs: 50,
});

export const DEFAULT_LOCATION = Object.freeze({ lat: 29.7286, lng: -95.4746, name: "Gulfton, Houston" });

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
};

const json = (body, status = 200) => Response.json(body, { status, headers: CORS });

function clampInt(v, { def, max }) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(max, n);
}

function packageRows(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.packages || payload?.results || payload?.items || [];
}

/** Pick a Dear Congress package by name (case-insensitive, exact then substring) or id. */
export function findPackage(payload, name) {
  const rows = packageRows(payload);
  const needle = String(name || "").toLowerCase().trim();
  const label = (r) => String(r?.name || r?.title || r?.label || "").toLowerCase();
  return rows.find((r) => label(r) === needle || String(r?.id || "").toLowerCase() === needle)
    || rows.find((r) => needle && label(r).includes(needle))
    || null;
}

/**
 * createExperimentsHandler({ fetchPlan, getArea, runner })
 *  fetchPlan(body) → Dear Congress synthesize payload (packages)
 *  getArea(lat, lng) → OSM area, or throws (falls back to a procedural town)
 *  runner → runPairedExperiment (swappable in tests)
 */
export function createExperimentsHandler({ fetchPlan, getArea, runner = runPairedExperiment } = {}) {
  const jobs = new Map(); // id → job
  let queue = Promise.resolve(); // one experiment at a time; they are CPU-bound

  function publicJob(job, withResult = true) {
    const out = {
      experimentId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      plan: { planId: job.plan.planId, label: job.plan.label, unsupported: job.plan.unsupported },
      params: job.params,
      progress: job.progress,
      statusUrl: `/api/world/experiments/${job.id}`,
    };
    if (job.error) out.error = job.error;
    if (withResult && job.result) out.result = job.result;
    return out;
  }

  async function resolvePlan(body) {
    if (body.plan) return compilePlan(body.plan);
    if (Array.isArray(body.proposalIds)) return compilePlan({ proposalIds: body.proposalIds, label: body.label || "Custom plan" });
    if (body.package) {
      if (!fetchPlan) throw new Error("no Dear Congress connection configured");
      const payload = await fetchPlan({});
      const pkg = findPackage(payload, body.package);
      if (!pkg) throw new Error(`Dear Congress has no package named "${body.package}"`);
      validateImportedPlan(pkg);
      return compilePlan(pkg);
    }
    throw new Error('Pass "plan", "proposalIds", or "package"');
  }

  async function buildExperimentTown(location, maxPeople, procedural = false) {
    let area = null;
    if (getArea && !procedural) {
      try {
        area = await getArea(location.lat, location.lng);
      } catch {
        area = null;
      }
    }
    return buildTown({ lat: location.lat, lng: location.lng }, area, { maxPeople });
  }

  async function start(request) {
    let body;
    try {
      body = await readExperimentInput(request);
      validateExperimentInput(body);
    } catch (error) {
      return json({ error: error.message }, error.status || 400);
    }
    body = body || {};

    let plan;
    try {
      plan = await resolvePlan(body);
    } catch (err) {
      return json({ error: String(err?.message || err) }, 400);
    }

    const lat = Number(body.location?.lat), lng = Number(body.location?.lng);
    const location = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 85 && Math.abs(lng) <= 180
      ? { lat, lng, name: body.location?.name || null }
      : { ...DEFAULT_LOCATION };
    const years = clampInt(body.years, LIMITS.years);
    const checkpoints = Array.isArray(body.checkpoints)
      ? body.checkpoints.map(Number).filter((y) => Number.isInteger(y) && y >= 0 && y <= LIMITS.years.max)
      : null;
    const params = {
      seeds: clampInt(body.seeds, LIMITS.seeds),
      years,
      checkpoints: checkpoints?.length ? checkpoints : null,
      maxPeople: clampInt(body.maxPeople, LIMITS.maxPeople),
      baseSeed: String(body.baseSeed || "hbl").slice(0, 64),
      location,
      procedural: body.procedural === true,
    };

    const id = `exp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const job = { id, status: "queued", createdAt: new Date().toISOString(), plan, params, progress: { step: 0, totalSteps: 0 }, result: null, error: null };
    jobs.set(id, job);
    while (jobs.size > LIMITS.keepJobs) jobs.delete(jobs.keys().next().value);

    queue = queue.then(async () => {
      job.status = "running";
      try {
        const town = await buildExperimentTown(location, params.maxPeople, params.procedural);
        job.result = await runner({
          town,
          plan,
          seeds: params.seeds,
          years: params.years,
          checkpoints: params.checkpoints,
          baseSeed: params.baseSeed,
          onProgress: (p) => { job.progress = { step: p.step, totalSteps: p.totalSteps }; },
          shouldStop: () => !jobs.has(id),
        });
        job.result.meta.location = location;
        job.status = "done";
      } catch (err) {
        job.status = "error";
        job.error = String(err?.message || err);
      }
    });

    return json(publicJob(job, false), 202);
  }

  return async function handleExperiments(request) {
    const { pathname } = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const rest = pathname.replace(/^\/api\/world\/experiments\/?/, "");
    if (!rest) {
      if (request.method === "POST") return start(request);
      if (request.method === "GET") return json({ experiments: [...jobs.values()].reverse().map((j) => publicJob(j, false)) });
      return json({ error: "Use GET or POST" }, 405);
    }
    if (request.method !== "GET") return json({ error: "Use GET" }, 405);
    const job = jobs.get(decodeURIComponent(rest));
    if (!job) return json({ error: "No such experiment (they are kept in memory and reset on deploy)" }, 404);
    return json(publicJob(job));
  };
}
