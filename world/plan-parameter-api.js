import { compilePlanParameterPatch } from "./plan-parameter-patch.js";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
};

const json = (body, status = 200) => Response.json(body, { status, headers: CORS });

export async function handlePlanParameterPatch(request) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return json({ error: "Use POST /api/world/parameter-patch" }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }

  const experiment = body?.civicExperiment ?? body?.experiment;
  if (!experiment?.plan || !Array.isArray(experiment?.worldModel?.variables)) {
    return json({ error: "Pass civicExperiment (or experiment) with plan and worldModel.variables" }, 400);
  }

  try {
    const patch = compilePlanParameterPatch(experiment, body?.parameterOverrides ?? body?.overrides ?? {});
    return json({ patch });
  } catch (error) {
    return json({ error: String(error?.message || error) }, 400);
  }
}
