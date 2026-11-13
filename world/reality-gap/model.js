const finite = Number.isFinite;
const required = (value, name) => { if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`); };
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0,10) === value;
/** One metric, geography and unit basis per immutable comparison. No interpolation. */
export function compareHistory(input) {
  if (input?.schemaVersion !== 'reality-gap.v1') throw new Error('Expected reality-gap.v1.');
  for (const key of ['id','metric','unit','geography','source','modelVersion','rulesVersion','runId','cutoff']) required(input[key], key);
  if (!date(input.cutoff) || !Number.isInteger(input.seed) || input.seed < 0 || input.seed > 4294967295 || !input.parameters || typeof input.parameters !== 'object' || Array.isArray(input.parameters)) throw new Error('Valid cutoff, uint32 seed and parameters are required.');
  if (typeof input.synthetic !== 'boolean' || !finite(input.threshold) || input.threshold <= 0) throw new Error('Declare synthetic and a positive absolute-error threshold in metric units.');
  for (const key of ['observed','simulated']) {
    if (!Array.isArray(input[key]) || !input[key].length || input[key].length > 1000) throw new Error(`${key} must contain 1–1000 rows.`);
    const seen = new Set();
    for (const row of input[key]) {
      if (!date(row.date) || seen.has(row.date)) throw new Error(`Invalid or duplicate ${key} date.`);
      seen.add(row.date);
      if (row.value === null) { if (row.lower != null || row.upper != null) throw new Error('Missing values cannot have intervals.'); continue; }
      if (![row.value,row.lower,row.upper].every(finite) || row.lower > row.value || row.value > row.upper) throw new Error('Each value needs finite lower ≤ value ≤ upper uncertainty bounds.');
      if (key === 'observed' && (!date(row.availableAt) || row.availableAt < row.date)) throw new Error('Observed values require an availability date on or after measurement.');
    }
  }
  const observed = new Map(input.observed.map(row => [row.date,row]));
  const simulated = new Map(input.simulated.map(row => [row.date,row]));
  const rows = [...new Set([...observed.keys(),...simulated.keys()])].sort().map(date => {
    const actual = observed.get(date), model = simulated.get(date);
    const scored = actual?.value != null && model?.value != null && date > input.cutoff;
    const signedError = scored ? model.value - actual.value : null;
    const absoluteError = scored ? Math.abs(signedError) : null;
    const percentageError = scored && actual.value !== 0 ? absoluteError / Math.abs(actual.value) * 100 : null;
    if (scored && (!finite(signedError) || !finite(absoluteError) || (percentageError !== null && !finite(percentageError)))) throw new Error('Error calculation overflow.');
    return { date, observed: actual ?? null, simulated: model ?? null, signedError, absoluteError, percentageError, large: scored && absoluteError >= input.threshold, status: date <= input.cutoff ? 'initialization' : scored ? 'scored' : 'missing' };
  });
  return { ...structuredClone(input), rows };
}
export function draftGap(comparison, row) {
  if (!row.large || !comparison.rows.includes(row)) throw new Error('Select a measured large gap.');
  return { schemaVersion: 'reality-gap-draft.v1', status: 'triage', requiresHumanReview: true,
    key: JSON.stringify([comparison.id, comparison.runId, comparison.modelVersion, comparison.rulesVersion, row.date, comparison.metric, comparison.geography, comparison.unit]),
    title: `Investigate ${comparison.metric} gap in ${comparison.geography} on ${row.date}`,
    question: 'Could missing construction delays, changing demand, observation revisions or model assumptions explain this gap? These are hypotheses, not established causes.',
    evidence: { comparison: Object.fromEntries(Object.entries(comparison).filter(([key]) => key !== 'rows')), gap: structuredClone(row) },
    acceptance: 'Verify observation provenance and availability; test hypotheses with pre-cutoff inputs only; rerun the same seeds and report new errors against this immutable validation record.' };
}
export function enqueueDraft(queue, draft) {
  const existing = queue.find(item => item.key === draft.key);
  if (existing && JSON.stringify(existing) !== JSON.stringify(draft)) throw new Error('This comparison identity already has different evidence. Import a new comparison/run ID.');
  return existing ? queue : [...queue, draft];
}
