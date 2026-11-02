import { requestProviderJson } from "./ai/provider.js";

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  },
});

const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary"],
  properties: {
    summary: { type: "string", minLength: 1, maxLength: 2400 },
  },
};

const PROVIDERS = {
  openai: {
    key: "OPENAI_API_KEY",
    model: "OPENAI_MODEL",
    async run({ apiKey, model, data, fetchImpl, signal }) {
      const response = await requestProviderJson("https://api.openai.com/v1/responses", {
        headers: { authorization: `Bearer ${apiKey}` },
        body: {
          model,
          store: false,
          max_output_tokens: 650,
          input: [
            { role: "system", content: data.instructions },
            { role: "user", content: JSON.stringify(data.payload) },
          ],
          text: { format: { type: "json_schema", name: "constitution_simulation_summary", strict: true, schema: SUMMARY_SCHEMA } },
        },
        fetchImpl,
        signal,
      });
      const blocks = (response.output || []).flatMap((item) => item.content || []);
      const text = blocks.filter((block) => block.type === "output_text").map((block) => block.text).join("") || response.output_text;
      return JSON.parse(text);
    },
  },
  anthropic: {
    key: "ANTHROPIC_API_KEY",
    model: "ANTHROPIC_MODEL",
    async run({ apiKey, model, data, fetchImpl, signal }) {
      const response = await requestProviderJson("https://api.anthropic.com/v1/messages", {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: {
          model,
          max_tokens: 650,
          system: data.instructions,
          messages: [{ role: "user", content: JSON.stringify(data.payload) }],
          output_config: { format: { type: "json_schema", schema: SUMMARY_SCHEMA } },
        },
        fetchImpl,
        signal,
      });
      const text = (response.content || []).filter((block) => block.type === "text").map((block) => block.text).join("");
      return JSON.parse(text);
    },
  },
};

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmt(value, digits = 1) {
  const n = finite(value);
  if (n === null) return "n/a";
  return Math.abs(n) >= 1000 ? Math.round(n).toLocaleString("en-US") : n.toFixed(digits).replace(/\.0$/, "");
}

export function compactSimulationSummary(result) {
  const metrics = result?.final && typeof result.final === "object" ? result.final : {};
  const definitions = result?.meta?.metrics || {};
  const rows = Object.entries(metrics).map(([id, metric]) => ({
    id,
    label: definitions?.[id]?.label || id,
    unit: definitions?.[id]?.unit || "",
    better: definitions?.[id]?.better || null,
    baseline: finite(metric?.baseline?.mean),
    plan: finite(metric?.plan?.mean),
    deltaMean: finite(metric?.delta?.mean),
    deltaP10: finite(metric?.delta?.p10),
    deltaP90: finite(metric?.delta?.p90),
    improvedShare: finite(metric?.improvedShare),
  })).filter((row) => row.deltaMean !== null);

  return {
    plan: result?.meta?.plan || null,
    seeds: finite(result?.meta?.seeds),
    checkpoints: result?.meta?.checkpoints || [],
    population: finite(result?.meta?.population),
    futures: result?.futures || null,
    metrics: rows,
    disclaimer: result?.meta?.disclaimer || "Simulated outcomes are illustrative counterfactuals, not forecasts.",
  };
}

export function localConstitutionSummary({ planText, proposalIds = [], planActions = [], result } = {}) {
  const compact = compactSimulationSummary(result);
  const important = [...compact.metrics]
    .sort((a, b) => Math.abs(b.deltaMean || 0) - Math.abs(a.deltaMean || 0))
    .slice(0, 3);
  const metricText = important.length
    ? important.map((row) => {
        const interval = row.deltaP10 !== null && row.deltaP90 !== null
          ? `, paired spread p10–p90 ${fmt(row.deltaP10)} to ${fmt(row.deltaP90)} ${row.unit}`
          : "";
        return `${row.label}: ${fmt(row.baseline)} → ${fmt(row.plan)} ${row.unit} (Δ ${fmt(row.deltaMean)}${interval})`;
      }).join("; ")
    : "the current simulator did not return comparable final metrics";

  const actionLabels = planActions.map((action) => action?.title || action?.label || action?.id).filter(Boolean);
  const drainage = proposalIds.includes("f_drainage");
  const visual = drainage
    ? "The plan view adds schematic drainage channels, culverts, and detention basins so the physical intervention is visible; these shapes illustrate the modeled change and are not engineering drawings."
    : "The plan view highlights physical changes for proposal types that currently have a geometry adapter.";

  return `HappyBearLandia compared the same synthetic town and paired random seeds with and without “${String(planText || "the selected plan").trim()}.” ${actionLabels.length ? `The selected Dear Congress package includes ${actionLabels.slice(0, 4).join(", ")}. ` : ""}At the final checkpoint, ${metricText}. ${visual} ${compact.disclaimer}`;
}

function providerData({ planText, proposalIds, planActions, result }) {
  return {
    instructions: "Write exactly one neutral paragraph (80–150 words) summarizing a paired civic simulation. Use only the supplied structured data. Describe baseline versus plan, uncertainty/spread when present, and the physical plan visualization. Do not recommend passing or rejecting a policy, do not call the simulation a forecast, and do not invent causal claims or numbers. State that visible infrastructure geometry is schematic when applicable.",
    payload: {
      planText: String(planText || "").slice(0, 4000),
      proposalIds: Array.isArray(proposalIds) ? proposalIds.slice(0, 30) : [],
      planActions: Array.isArray(planActions) ? planActions.slice(0, 20).map((action) => ({ id: action?.id, title: action?.title, description: action?.description })) : [],
      simulation: compactSimulationSummary(result),
    },
  };
}

async function readJson(request) {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 262144) throw new Error("Summary input exceeds 256 KiB.");
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("A JSON summary request is required.");
  return body;
}

export function createConstitutionSummaryHandler({ env = process.env, fetchImpl = fetch, timeoutMs = 18000 } = {}) {
  return async function handleConstitutionSummary(request) {
    if (request.method !== "POST") return json({ error: "Use POST." }, 405);
    try {
      const url = new URL(request.url);
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin) return json({ error: "Summary requests must be same-origin." }, 403);
      const body = await readJson(request);
      const fallback = localConstitutionSummary(body);
      const requested = String(body.provider || env.CONSTITUTION_SUMMARY_PROVIDER || env.AI_PROVIDER || "demo").toLowerCase();
      const provider = PROVIDERS[requested];
      if (!provider) return json({ summary: fallback, provider: "local", fallback: true });
      const apiKey = env[provider.key]?.trim();
      const model = env[provider.model]?.trim();
      if (!apiKey || !model) return json({ summary: fallback, provider: "local", fallback: true });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(30000, timeoutMs)));
      try {
        const output = await provider.run({
          apiKey,
          model,
          data: providerData(body),
          fetchImpl,
          signal: controller.signal,
        });
        const summary = String(output?.summary || "").trim();
        if (!summary) return json({ summary: fallback, provider: "local", fallback: true });
        return json({ summary, provider: requested, fallback: false });
      } catch {
        return json({ summary: fallback, provider: "local", fallback: true });
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      return json({ error: String(error?.message || error) }, 400);
    }
  };
}
