// Maintainer-curated ballot. Public suggestions never become agent instructions directly.
// IDs correspond to existing UPCOMING sprint tasks; these are NOT new assignments.
export const approvedPatchCandidates = Object.freeze([
  {
    id: 'U03', cadence: 'weekly', title: 'Keep the city fast during repeated time travel',
    summary: 'Measure and improve memory usage while scrubbing through both futures.',
    dependencies: ['R01'], area: 'performance',
    acceptance: 'Repeat scrub/focus/dispose with the native renderer and report actual memory/object counts, preserving replay identity.',
    verification: ['bun test test/future-machine-scene.test.js'],
    ownedPaths: ['world/future-machine/scene/', 'test/future-machine-scene.test.js']
  },
  {
    id: 'U06', cadence: 'daily', title: 'Show how each future affects household budgets',
    summary: 'Make rent, savings, and housing outcomes readable without opening raw JSON.',
    dependencies: ['R02'], area: 'gameplay',
    acceptance: 'Display only model-supported amounts and units, including missing-data caveats, in existing comparison UI.',
    verification: ['bun test test/future-machine-ui.test.js'],
    ownedPaths: ['world/future-machine/ui/', 'test/future-machine-ui.test.js']
  },
  {
    id: 'U08', cadence: 'daily', title: 'Make the divergence reveal accessible',
    summary: 'Respect reduced-motion preferences without hiding selected buildings or measured differences.',
    dependencies: ['R01', 'R05'], area: 'accessibility',
    acceptance: 'A browser reduced-motion toggle removes animated pulses but preserves exact entity focus and visible deltas.',
    verification: ['bun test test/future-machine-canvas.test.js'],
    ownedPaths: ['world/future-machine/scene/', 'test/future-machine-canvas.test.js']
  },
  {
    id: 'U09', cadence: 'weekly', title: 'Make shared futures reliably reopen',
    summary: 'Recover helpfully when a shared recipe is missing, corrupt, or from an older model.',
    dependencies: ['R01', 'R03'], area: 'sharing',
    acceptance: 'Test missing record, version mismatch and corrupted share; never silently substitute or claim an unsupported replay.',
    verification: ['bun test test/future-machine-share.test.js'],
    ownedPaths: ['world/future-machine/share/', 'test/future-machine-share.test.js']
  },
  {
    id: 'U13', cadence: 'weekly', title: 'Show which browsers the demo really supports',
    summary: 'Verify and report actual browsers instead of implying untested coverage.',
    dependencies: ['R06'], area: 'compatibility',
    acceptance: 'Exercise available browser engines; report unavailable platforms as unverified, without invented pass results.',
    verification: ['bun test test/future-machine-ui.test.js'],
    ownedPaths: ['test/', 'docs/']
  }
]);
