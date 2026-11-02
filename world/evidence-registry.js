const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const asArray = (value) => Array.isArray(value) ? value : [];
const clamp01 = (value, fallback = 0.5) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : fallback;

export const EVIDENCE_TYPES = Object.freeze(["observed", "estimated", "heuristic", "user-override", "unknown"]);

export function normalizeEvidenceRecord(raw = {}, fallback = {}) {
  const row = isObject(raw) ? raw : {};
  const type = EVIDENCE_TYPES.includes(row.type) ? row.type : (EVIDENCE_TYPES.includes(fallback.type) ? fallback.type : "unknown");
  return {
    schemaVersion: "hbl-evidence.v1",
    id: String(row.id || fallback.id || "evidence_unknown"),
    type,
    sourceName: String(row.sourceName || row.source || fallback.sourceName || "HBL model assumption"),
    sourceType: String(row.sourceType || fallback.sourceType || (type === "observed" ? "official-statistic" : "model-assumption")),
    observedAt: row.observedAt || fallback.observedAt || null,
    geography: String(row.geography || fallback.geography || "unspecified"),
    value: Number.isFinite(Number(row.value)) ? Number(row.value) : (Number.isFinite(Number(fallback.value)) ? Number(fallback.value) : null),
    unit: String(row.unit || fallback.unit || "unknown"),
    url: typeof row.url === "string" ? row.url : (fallback.url || null),
    notes: typeof row.notes === "string" ? row.notes : (fallback.notes || null),
    confidence: clamp01(row.confidence, clamp01(fallback.confidence, type === "observed" ? 0.9 : 0.5)),
  };
}

function registryRows(registry, kind, id) {
  if (!isObject(registry)) return [];
  const group = isObject(registry[kind]) ? registry[kind] : registry;
  const raw = group?.[id];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function defaultVariableProvenance(variable) {
  if (variable?.source === "user-override") return { type: "user-override", confidence: 1 };
  if (variable?.source === "observed") return { type: "observed", confidence: clamp01(variable.confidence, 0.9) };
  return { type: "heuristic", confidence: clamp01(variable?.confidence, 0.5) };
}

function evidenceForVariable(variable, registry) {
  const provenance = defaultVariableProvenance(variable);
  const supplied = registryRows(registry, "variables", variable.id);
  const evidence = supplied.length
    ? supplied.map((row, index) => normalizeEvidenceRecord(row, {
        id: `evidence_${variable.id}_${index + 1}`,
        type: provenance.type,
        value: variable.baseline,
        unit: variable.unit,
        confidence: provenance.confidence,
      }))
    : [normalizeEvidenceRecord({}, {
        id: `evidence_${variable.id}_model`,
        type: provenance.type,
        sourceName: provenance.type === "user-override" ? "User-reviewed assumption" : "HBL parameter catalog",
        value: variable.baseline,
        unit: variable.unit,
        confidence: provenance.confidence,
        notes: variable.reason || null,
      })];
  const confidence = evidence.reduce((sum, row) => sum + row.confidence, 0) / evidence.length;
  const strongestType = evidence.some((row) => row.type === "observed") ? "observed" : provenance.type;
  return {
    ...variable,
    provenance: {
      schemaVersion: "hbl-provenance.v1",
      type: strongestType,
      confidence: clamp01(confidence),
      geography: evidence.find((row) => row.geography !== "unspecified")?.geography || "unspecified",
      observedAt: evidence.find((row) => row.observedAt)?.observedAt || null,
    },
    evidence,
    calibration: isObject(variable.calibration) ? variable.calibration : { status: "uncalibrated", method: null },
  };
}

function evidenceForEdge(edge, registry) {
  const supplied = registryRows(registry, "causalEdges", edge.id);
  const evidence = supplied.map((row, index) => normalizeEvidenceRecord(row, {
    id: `evidence_${edge.id}_${index + 1}`,
    type: "estimated",
    confidence: 0.45,
  }));
  return {
    ...edge,
    provenance: {
      schemaVersion: "hbl-provenance.v1",
      type: evidence.length ? (evidence.some((row) => row.type === "observed") ? "observed" : "estimated") : "heuristic",
      confidence: evidence.length ? clamp01(evidence.reduce((sum, row) => sum + row.confidence, 0) / evidence.length) : 0.35,
    },
    evidence,
    calibration: isObject(edge.calibration) ? edge.calibration : { status: "uncalibrated", method: null },
  };
}

function evidenceForMetric(metric, registry) {
  const supplied = registryRows(registry, "metrics", metric.id);
  return {
    ...metric,
    provenance: {
      schemaVersion: "hbl-provenance.v1",
      type: supplied.length ? "estimated" : "heuristic",
      confidence: supplied.length ? clamp01(supplied[0]?.confidence, 0.6) : 0.5,
    },
    evidence: supplied.map((row, index) => normalizeEvidenceRecord(row, {
      id: `evidence_metric_${metric.id}_${index + 1}`,
      type: "estimated",
      unit: metric.unit,
      confidence: 0.6,
    })),
  };
}

export function attachEvidenceLayer(experiment, options = {}) {
  const registry = options.evidenceRegistry || options.evidence || {};
  const variables = asArray(experiment?.worldModel?.variables).map((row) => evidenceForVariable(row, registry));
  const causalEdges = asArray(experiment?.worldModel?.causalEdges).map((row) => evidenceForEdge(row, registry));
  const metricRegistry = asArray(experiment?.outcomes?.metricRegistry).map((row) => evidenceForMetric(row, registry));
  const counts = variables.reduce((acc, variable) => {
    const key = variable.provenance?.type || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    ...experiment,
    evidenceLayer: {
      schemaVersion: "hbl-evidence-layer.v1",
      variableCountsByType: counts,
      calibratedVariables: variables.filter((row) => row.calibration?.status === "calibrated").length,
      note: "Evidence metadata describes provenance and confidence; it does not by itself establish causality or predictive validity.",
    },
    worldModel: { ...experiment.worldModel, variables, causalEdges },
    outcomes: { ...experiment.outcomes, metricRegistry },
  };
}

export function summarizeEvidence(experiment) {
  const variables = asArray(experiment?.worldModel?.variables);
  return variables.reduce((acc, row) => {
    const type = row.provenance?.type || "unknown";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
}
