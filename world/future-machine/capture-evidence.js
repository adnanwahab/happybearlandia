import {compareHistory} from './diff/index.js';

/** Plan captures from recorded City frames, independently of presentation timing.
 * Physical scene divergence includes buildings and links; financial/policy changes
 * are not a claim that rendered geometry has changed. Missing history fails closed.
 */
export function captureEvidencePlan(history) {
  if (!history?.recipe?.schemaVersion || history.recipe.seed !== history.seed || history.recipe.modelVersion !== history.modelVersion) throw new Error('Capture requires a matching versioned recipe');
  const diffs = compareHistory(history);
  if (diffs.some(diff => !diff.available)) throw new Error('Capture requires complete comparable monthly evidence');
  const first = diffs.find(diff => diff.physicalCount > 0);
  return {
    schemaVersion:'future-machine-capture.v1',
    scenarioVersion:history.recipe.schemaVersion,
    modelVersion:history.modelVersion, seed:history.seed,
    experimentId:history.experimentId, initialHash:history.initialHash,
    recipe:history.recipe, provenance:history.provenance,
    divergenceScope:'First recorded physical building or link change; not first metric or policy change',
    divergenceMonth:first?.month ?? null,
    status:first ? 'diverged' : 'no-physical-divergence',
    changedEntities:first?.entities.filter(entity => entity.physical) ?? [],
    captureMonths:first ? [0, first.month] : [0],
    limitations:['Synthetic, uncalibrated City model. Recomputed history is not independent replay verification.'],
  };
}
