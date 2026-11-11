// Read-only presentation of legacy World records. Never maps Population or City IDs.
const finite = value => typeof value === 'number' && Number.isFinite(value);
const value = number => finite(number) ? number : null;
const list = rows => Array.isArray(rows) ? rows : [];
export function configuredFeedback(policy = {}) {
  return { kind: 'configured', title: 'Configured plan', source: policy.source || 'World policy configuration',
    text: `${policy.label || policy.id || 'No plan'} configured. Effects have not been established by this selection.`,
    proposalIds: [...list(policy.proposalIds)], year: value(policy.year) };
}
export function observedFeedback(resident, { minute, seed } = {}) {
  const needs = resident?.needs;
  const values = ['hunger', 'energy', 'fun', 'social'].map(key => needs?.[key]);
  const mood = values.every(finite) ? values.reduce((a, b) => a + b, 0) / 4 : null;
  return { kind: 'observed', title: 'Observed playback', source: 'Legacy World live resident', seed: seed ?? null,
    minute: value(minute), residentIndex: Number.isInteger(resident?.index) ? resident.index : null,
    name: resident?.name || 'Resident', activity: resident?.doing || 'Activity unavailable', mood,
    text: 'Current activity and needs describe this playback. A mood change alone does not establish a policy effect.' };
}
export function stormFeedback(record = {}, { minute, seed } = {}) {
  return { kind: 'observed', title: 'Observed storm', source: 'Legacy World storm event', seed: seed ?? null,
    minute: value(minute), floodedParcels: value(record.floodedNow), displacedResidents: value(record.displaced),
    text: 'Displaced residents counts completed moves to a safe home; flooded residents without a safe destination may be uncounted.' };
}
export function matchedWeekFeedback(result, { seed, source = 'Legacy World cycle.worker.js', minute } = {}) {
  const noPlan = value(result?.avg?.noPlan), withPlan = value(result?.avg?.withPlan);
  const available = noPlan !== null && withPlan !== null;
  const resident = result?.best;
  return { kind: 'matched', title: 'Measured matched comparison', source, seed: seed ?? null, minute: value(minute),
    available, days: value(result?.days), cycle: value(result?.cycle), year: value(result?.year),
    controlLabel: result?.cycle > 1 ? `Keep plan ${result.cycle - 1}` : 'No plan',
    planLabel: result?.cycle > 1 ? `Plan ${result.cycle}` : 'With plan',
    noPlan, withPlan, delta: available ? withPlan - noPlan : null, unit: 'well-being points (0–100)',
    improved: value(result?.improved), worse: value(result?.worse), threshold: 5,
    resident: resident && Number.isInteger(resident.index) ? { ...resident } : null,
    unsupported: [...list(result?.unsupported)],
    text: 'Same-start model comparison. Score is day-averaged needs minus modeled frictions, not measured health or happiness. Counts use changes greater than +5 or less than −5 points. Playback and comparison clocks are separate.' };
}
export function tenYearFeedback(results, { seed } = {}) {
  return { kind: 'ten-year', title: 'Separate ten-year experiment', source: 'Legacy World experiment.worker.js', seed: seed ?? null,
    packages: Object.entries(results || {}).map(([label, record]) => ({ label, history: list(record?.history) })),
    text: 'Package histories belong to the ten-year experiment, not the matched week or current playback.' };
}
export function createFeedbackAdapter() {
  return {
    configured: input => ({ ...configuredFeedback(input), label: 'Configured policy' }),
    observed(input = {}) {
      const authority = input.authority === 'population' ? 'Population' : 'Legacy World';
      const record = observedFeedback({ name: input.name, doing: input.activity, needs: input.needs }, input);
      return { ...record, mood: value(input.mood) ?? record.mood, authority: input.authority,
        residentId: input.residentId ?? null, position: input.position ? { ...input.position } : null,
        label: 'Observed playback', source: `${authority} live resident` };
    },
    measured(result, provenance = {}) {
      return { ...matchedWeekFeedback(result, provenance), label: 'Measured matched comparison',
        provenance: { ...provenance, proposalIds: [...list(provenance.proposalIds)] } };
    },
  };
}
