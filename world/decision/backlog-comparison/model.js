import { storedMetricSnapshot } from '../../buildings/renderer.js';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const supported = new Set(['1.0.0', '1.1.0', '1.2.0']);

/** Stored Decision housing records only. No Population or geographic identities. */
export function pairedHousingScene({ results, selectedRun, month = 0 } = {}) {
  const runs = results?.runs || [];
  const selected = runs.find(run => run.id === selectedRun?.id);
  const baselineId = results?.experiment?.scenarios?.find(s => s.kind === 'baseline')?.id;
  const baseline = runs.find(run => run.scenarioId === baselineId && run.seed === selected?.seed);
  const version = selected?.modelVersion || results?.model?.version;
  const unavailable = reason => ({ available: false, reason, month, arms: [] });
  if (!Number.isInteger(month) || month < 0) return unavailable('Select a nonnegative integer month.');
  if (!selected || !baseline) return unavailable('A stored selected future and same-seed baseline are required.');
  if (results?.model?.id !== 'housing.v1' || !supported.has(version)) return unavailable('Unsupported housing model identity or version.');
  if ((baseline.modelVersion || results.model.version) !== version) return unavailable('Model versions differ.');
  if (![selected, baseline].every(run => ['completed', 'successful', 'succeeded'].includes(run.status))) return unavailable('Both stored futures must be complete.');
  const arms = [baseline, selected].map(run => {
    const row = storedMetricSnapshot(run, month);
    const exact = row?.month === month;
    const projects = (run.projects || []).flatMap(record => {
      const proposal = record.proposal;
      const state = record.states?.find(state => state.month === month);
      if (!proposal || !state) return [];
      return [{ id: record.projectId, proposal, state: structuredClone(state), source: { runId: run.id, projectId: record.projectId, month } }];
    });
    return { runId: run.id, scenarioId: run.scenarioId, seed: run.seed, month,
      available: exact, recordedMonth: row?.month ?? null,
      supply: exact && finite(row.metrics?.housing_supply) ? row.metrics.housing_supply : null,
      vacancy: exact && finite(row.metrics?.vacancy_rate) ? row.metrics.vacancy_rate : null,
      projects: exact ? projects : [], source: { runId: run.id, month, modelVersion: version } };
  });
  const supplyMax = Math.max(1, ...[baseline, selected].flatMap(run => (run.monthlyTimeline || run.timeline || []).map(row => row.metrics?.housing_supply).filter(finite)));
  const supplyDelta = arms.every(arm => finite(arm.supply)) ? arms[1].supply - arms[0].supply : null;
  return { available: true, month, modelVersion: version, seed: selected.seed, arms, supplyMax, vacancyDomain: [0, 100], supplyDelta,
    caveat: 'Exploratory housing model. Schematic aggregate stock and vacancy; no parcel vacancy, geographic placement, Population identity, or empirical calibration. Project IDs are scoped to their stored housing run.' };
}
