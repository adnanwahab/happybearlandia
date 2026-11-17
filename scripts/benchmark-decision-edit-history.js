import { createEditHistory } from '../world/decision/edit-history.js';
import { createHousingScenarios } from '../world/models/housing/index.js';
const draft = { scenarios: createHousingScenarios(), metadata: {}, evidence: [], fields: { seed: '42' } };
const history = createEditHistory(draft);
const samples = [];
for (let i = 0; i < 1000; i++) {
  draft.scenarios[1].parameters.permitting_months = i % 36;
  const start = performance.now(); history.record(draft); history.undo(); history.redo(); samples.push(performance.now() - start);
}
samples.sort((a,b) => a-b);
console.log(JSON.stringify({ fixture: 'four synthetic housing scenarios, 100-revision cap', runtime: Bun.version,
  operations: 1000, measurement: 'record + undo + redo, milliseconds; excludes DOM rendering and simulation',
  medianMs: samples[500], p95Ms: samples[950], maxMs: samples[999] }, null, 2));
