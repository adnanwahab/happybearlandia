function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pct(value) {
  const number = finite(value);
  return number == null ? "unknown" : `${(number * 100).toFixed(1)}%`;
}

export function buildRevisionNarrative({ experiment, improvement, comparison } = {}) {
  if (!experiment?.plan) throw new Error("experiment.plan is required");
  if (!improvement) throw new Error("improvement is required");

  const title = experiment.plan.title || "Civic plan";
  const before = comparison?.before || {};
  const after = comparison?.after || {};
  const lines = [
    `Simulation revision hypothesis for: ${title}`,
    "",
    `Proposed change: ${improvement.title || improvement.description || improvement.id || "Untitled improvement"}`,
  ];

  if (improvement.description) lines.push(`Rationale: ${improvement.description}`);
  if (improvement.targetVariableLabel) lines.push(`Stress-test variable: ${improvement.targetVariableLabel}`);

  if (comparison) {
    lines.push(
      "",
      "Paired HBL stress-test comparison (same sampled worlds):",
      `- robustness: ${pct(before.robustness)} -> ${pct(after.robustness)}`,
      `- expected score: ${finite(before.expectedScore) ?? "unknown"} -> ${finite(after.expectedScore) ?? "unknown"}`,
    );
    const scoreDelta = finite(comparison.scoreDelta);
    if (scoreDelta != null) lines.push(`- expected-score delta: ${scoreDelta >= 0 ? "+" : ""}${scoreDelta.toFixed(3)}`);
  }

  lines.push(
    "",
    "Interpretation: this is a simulation-derived revision hypothesis, not causal evidence or a forecast. Review the assumptions and evidence before adopting the change.",
  );

  return lines.join("\n");
}

export function buildDearCongressRevisionDraft({ experiment, improvement, comparison, recordId = null, context = null } = {}) {
  const text = buildRevisionNarrative({ experiment, improvement, comparison });
  return {
    kind: "journal",
    text,
    source: "happybearlandia",
    metadata: {
      schemaVersion: "hbl-revision-feedback.v1",
      experimentId: experiment?.id || null,
      planId: experiment?.plan?.id || null,
      recordId,
      ...(context ? { continuity: structuredClone(context) } : {}),
      improvementId: improvement?.id || null,
      pairedWorlds: comparison?.worldCount || comparison?.after?.worldCount || comparison?.before?.worldCount || null,
      generatedFromSimulation: true,
      warning: "Simulation-derived hypothesis; not causal evidence or a forecast.",
    },
  };
}

export function mapRevisionDraftForDearCongress(draft, globalObject = globalThis) {
  const mapper = globalObject?.HBL_DEAR_CONGRESS_REVISION_MAPPER;
  if (typeof mapper === "function") return mapper(draft);
  return draft;
}

export async function postDearCongressRevisionDraft(draft, {
  endpoint = "/api/publish_draft",
  fetchImpl = globalThis.fetch,
  voterId = null,
  globalObject = globalThis,
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");
  const body = mapRevisionDraftForDearCongress(draft, globalObject);
  const headers = { "content-type": "application/json", accept: "application/json" };
  if (voterId) headers["x-voter-id"] = voterId;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const message = payload?.error || payload?.message || `Dear Congress returned HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}
