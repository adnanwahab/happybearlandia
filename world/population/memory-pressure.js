// Only allocation-specific reports are evidence. Slow frames, deviceMemory,
// generic RangeErrors, worker timeouts and arbitrary worker crashes are not.
export function isAllocationFailure(error) {
  return error?.code === 'ALLOCATION_FAILED' || /out of memory|allocation (?:failed|failure)|array buffer allocation failed|failed to allocate|could not allocate memory/i.test(error?.message || '');
}
export function memoryRecovery(config, runtime, tick, modelVersion) {
  const before=config.population,after=Math.max(1,Math.floor(before/2));
  return {schemaVersion:'population-memory-recovery.v1',reason:'reported-allocation-failure',modelVersion,beforePopulation:before,afterPopulation:after,canReduce:after<before,seed:config.seed,sourceConfig:structuredClone(config),beforeMeasuredActiveAgents:null,afterMeasuredActiveAgents:null,sourceRuntime:runtime,sourceTick:tick,fidelity:'fewer-synthetic-individuals',note:'Fresh reset/reseed with fewer individual states. Identities and trajectories change; no matched-person precision or cohort fallback is claimed. Population counts are allocated model individuals, not measured independently active agents.'};
}
