/** Planning evidence only. No architecture adapter or measurement is implied. */
export const CANDIDATES = Object.freeze([
  ['A', 'SHE-143', 'flat WebGPU microagents'],
  ['B', 'SHE-144', 'hierarchical cohorts'],
  ['C', 'SHE-145', 'spatial-tiled event queues'],
  ['D', 'SHE-146', 'adaptive CPU/GPU multi-fidelity'],
  ['E', 'SHE-147', 'worker/shard computation'],
].map(row => Object.freeze(row)));

export function createShootoutPreflight({ seed = 42 } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw Error('Expected uint32 seed');
  return {
    schemaVersion: 'architecture-shootout-preflight.v1',
    status: 'blocked',
    measurementPerformed: false,
    seed,
    workload: null,
    blockers: [
      'No common versioned workload implemented across the five architectures in this checkout.',
      'No integrated candidate adapters with CPU-oracle equivalence evidence.',
      'No shared render ON/OFF driver or full-device peak-memory instrumentation.',
    ],
    cases: CANDIDATES.flatMap(([architecture, dependency, label]) =>
      [10000, 100000, 1000000].flatMap(residents => [false, true].map(render => ({
        id: `${architecture}-${residents}-render-${render ? 'on' : 'off'}`,
        architecture, dependency, label, residents, render, seed,
        status: 'blocked', modelVersion: null, rulesVersion: null, adapterVersion: null,
        device: null, browser: null,
        metrics: {
          activeAgents: null, stateTransitionsPerSecond: null, interactionsPerSecond: null,
          simStepP50Ms: null, simStepP95Ms: null, renderFPS: null, peakMemoryBytes: null,
        },
        validationErrors: null,
        artifacts: [],
        unavailableReason: 'Candidate/common-workload integration is absent; this case was not run.',
      })))),
    limitations: [
      'Requested residents are scenario sizes, not measured active-agent counts.',
      'Null means unmeasured; validationErrors null does not mean zero errors.',
      'This manifest is not a benchmark result and cannot rank architectures.',
    ],
  };
}
