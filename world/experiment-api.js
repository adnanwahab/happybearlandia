import { gymEnvironment, rebuildGym, runGym } from './agent-training-gym.js';
import { replayExperimentRecord } from "./experiment-registry.js";
import {
  forkServerExperiment,
  listExperimentChildren,
  listServerExperiments,
  loadServerExperiment,
  saveServerExperiment,
} from "./server-experiment-store.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

async function bodyJson(request) {
  try { return await request.json(); } catch { return {}; }
}

export async function handleExperimentApi(request, options = {}) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "api" || parts[1] !== "experiments") return null;
  const id = parts[2] || null;
  const action = parts[3] || null;
  const store = { root: options.root, filters: Object.fromEntries(url.searchParams) };

  try {
    if (id === "gym" && !action && request.method === "POST") {
      const body = await bodyJson(request);
      if (Object.keys(body).length) throw new Error("Only the supported pinned gym declaration can be registered");
      const record = await saveServerExperiment({ id: 'gym_declaration',
        schemaVersion: 'hbl-gym-declaration.v1', environment: gymEnvironment(),
        registry: { resultKind: 'synthetic', modelVersion: 'hbl-resource-gym.v1', hypothesis: 'Resource control reward declaration' } }, store);
      return json(record, 201);
    }
    if (id && action === "gym-run" && request.method === "POST") {
      const declaration = await loadServerExperiment(id, store);
      if (!declaration) return json({ error: 'Experiment not found' }, 404);
      if (declaration.snapshot?.schemaVersion !== 'hbl-gym-declaration.v1') throw new Error('A saved reward declaration is required');
      const body = await bodyJson(request);
      if (Object.keys(body).some(key => key !== 'policyVersion')) throw new Error('Environment and reward overrides are forbidden; create a new revision');
      const environment = rebuildGym(declaration.snapshot.environment);
      const snapshot = runGym(environment, body.policyVersion);
      return json(await saveServerExperiment(snapshot, { ...store, parentExperimentId: id, relationship: 'gym-run' }), 201);
    }
    if (!id && request.method === "POST") {
      const body = await bodyJson(request);
      const snapshot = body.snapshot || body;
      const record = await saveServerExperiment(snapshot, { ...store, parentExperimentId: body.parentExperimentId, relationship: body.relationship });
      return json(record, 201);
    }
    if (!id && request.method === "GET") return json(await listServerExperiments(store));
    if (id && action === "replay" && request.method === "POST") {
      const record = await loadServerExperiment(id, store);
      return record ? json(await replayExperimentRecord(record)) : json({ error: "Experiment not found" }, 404);
    }
    if (id && action === "children" && request.method === "GET") return json(await listExperimentChildren(id, store));
    if (id && action === "fork" && request.method === "POST") {
      const body = await bodyJson(request);
      const record = await forkServerExperiment(id, body.snapshot || body, { ...store, relationship: body.relationship || "fork" });
      return json(record, 201);
    }
    if (id && !action && request.method === "GET") {
      const record = await loadServerExperiment(id, store);
      return record ? json(record) : json({ error: "Experiment not found" }, 404);
    }
    return json({ error: "Unsupported experiment API operation" }, 405);
  } catch (error) {
    return json({ error: String(error?.message || error) }, 400);
  }
}
