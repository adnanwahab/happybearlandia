/** Hydrate only the exact stored same-seed baseline into the existing two-run
 * cache. A failed baseline must not discard the selected future or invent zeros.
 * Call after selected hydration; the caller must recheck generation afterwards.
 */
export async function hydrateComparisonBaseline({ results, selectedRun, loadRun, isCurrent = () => true }) {
  if (results?.model?.id !== 'housing.v1' || !isCurrent()) return null;
  const baselineId = results.experiment?.scenarios?.find(s => s.kind === 'baseline')?.id;
  const version = selectedRun?.modelVersion || results.model.version;
  const baseline = results.runs?.find(run => run.scenarioId === baselineId && run.seed === selectedRun?.seed &&
    (run.modelVersion || results.model.version) === version && run.status === 'completed');
  if (!baseline || baseline.id === selectedRun?.id) return null;
  try {
    const full = await loadRun(results.experiment.id, baseline.id);
    return isCurrent() && full?.id === baseline.id && full.seed === selectedRun.seed ? full : null;
  } catch { return null; }
}
