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
  const store = { root: options.root };

  try {
    if (!id && request.method === "POST") {
      const body = await bodyJson(request);
      const snapshot = body.snapshot || body;
      const record = await saveServerExperiment(snapshot, { ...store, parentExperimentId: body.parentExperimentId, relationship: body.relationship });
      return json(record, 201);
    }
    if (!id && request.method === "GET") return json(await listServerExperiments(store));
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
