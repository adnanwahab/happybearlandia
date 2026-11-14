/** Observational projection. Never infer simulated agents from scene instances. */
export function simulationBudget(snapshot, now = performance.now()) {
  if (!snapshot?.runtime) return null;
  const timing = snapshot.runtime.diagnostics;
  const finite = value => Number.isFinite(value) && value >= 0 ? value : null;
  return {
    authority: 'World Population', modelVersion: snapshot.modelVersion,
    runId: snapshot.runtime.id, revision: snapshot.runtime.revision,
    seed: snapshot.config?.seed, tick: snapshot.runtime.tick, minute: snapshot.minute,
    paused: snapshot.runtime.paused,
    residentStates: finite(snapshot.population),
    activeChangedResidents: null,
    representedResidents: finite(snapshot.metrics?.representedPopulation),
    // This is main-thread elapsed time, including queue, transfer and snapshot work.
    cpuStepEstimateMs: finite(timing?.cpuStepEstimateMs),
    sampleAgeMs: timing && Number.isFinite(now) ? finite(now - timing.completedAt) : null,
    steps: timing?.steps ?? null,
    interactionsPerSecond: null,
    interactionStatus: 'unavailable: no complete pair-interaction counter in Population',
    memoryBytes: null,
  };
}
const number = value => Number.isFinite(value) ? value.toFixed(2) : 'unavailable';
export function formatSimulationBudget(budget) {
  if (!budget) return 'SIMULATION · unavailable (Living City inactive or not ready)';
  return `SIMULATION · ${budget.authority} · ${budget.paused ? 'paused' : 'running'}\nResident states ${budget.residentStates ?? 'unavailable'} (allocated independent states)\nActive changed residents unavailable: no full-state change counter\nRepresented residents ${budget.representedResidents ?? 'unavailable'} (weighted)\nCompute step CPU estimate ${number(budget.cpuStepEstimateMs)} ms\nIncludes queue/transfer/snapshot · batch ${budget.steps ?? 'unavailable'} · age ${number(budget.sampleAgeMs)} ms\nInteractions/s ${budget.interactionStatus}\nSimulation memory unavailable\n${budget.modelVersion} · seed ${budget.seed} · tick ${budget.tick}\nRun ${budget.runId}:${budget.revision}`;
}
