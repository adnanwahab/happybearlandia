// Matched-seed impact evidence contract. Never invent preview metrics.
const MAX_METRICS = 16;
function label(value, max = 120) {
  return typeof value === 'string' && value.length > 0 && value.length <= max &&
    !/[\u0000-\u001f\u007f]/.test(value);
}
function parseRun(run) {
  if (!run || typeof run !== 'object' || !['recorded'].includes(run.source) ||
      !label(run.modelVersion) || !label(run.rulesVersion) || !label(run.runId) ||
      !/^[0-9a-f]{64}$/i.test(run.evidenceSha256 || '')) throw new Error('Impact run needs recorded provenance and a SHA-256 evidence digest.');
  if (!Array.isArray(run.metrics) || !run.metrics.length || run.metrics.length > MAX_METRICS) throw new Error('Impact metrics are missing or too numerous.');
  const seen = new Set();
  const metrics = run.metrics.map(m => {
    if (!m || !/^[a-z][a-z0-9_]{0,39}$/.test(m.key || '') || !label(m.label, 60) ||
        !label(m.unit, 32) || typeof m.value !== 'number' || !Number.isFinite(m.value) || seen.has(m.key)) {
      throw new Error('Impact metric has an invalid key, value, unit, or duplicate.');
    }
    seen.add(m.key);
    return { key: m.key, label: m.label, unit: m.unit, value: m.value };
  });
  return { runId: run.runId, modelVersion: run.modelVersion, rulesVersion: run.rulesVersion,
    source: 'recorded', evidenceSha256: run.evidenceSha256.toLowerCase(), metrics };
}
export function validatePatchImpact(raw, expectedCandidateId) {
  if (!raw || raw.schemaVersion !== 'hbl.patch-impact.v1' ||
      raw.candidateId !== expectedCandidateId || !/^[A-Za-z0-9_-]{1,32}$/.test(expectedCandidateId) ||
      !label(raw.seed) || !label(raw.startingStateId) || !label(raw.scenarioId) ||
      !label(raw.recordedAt) || !Number.isFinite(Date.parse(raw.recordedAt))) {
    throw new Error('Impact must identify a candidate, matched seed, starting state, scenario, and capture time.');
  }
  const before = parseRun(raw.before), after = parseRun(raw.after);
  if (before.runId === after.runId) throw new Error('Before and after must be distinct recorded runs.');
  const a = new Map(after.metrics.map(m => [m.key, m]));
  if (before.metrics.length !== a.size || before.metrics.some(m => !a.has(m.key) || a.get(m.key).unit !== m.unit)) {
    throw new Error('Before/after metrics and units must match exactly.');
  }
  const metrics = before.metrics.map(m => ({
    key: m.key, label: m.label, unit: m.unit, before: m.value,
    after: a.get(m.key).value, delta: a.get(m.key).value - m.value
  }));
  return { schemaVersion: 'hbl.patch-impact.v1', candidateId: expectedCandidateId, seed: raw.seed,
    startingStateId: raw.startingStateId, scenarioId: raw.scenarioId, recordedAt: raw.recordedAt,
    before, after, metrics, caveat: 'Recorded model output, not an empirical forecast.' };
}
