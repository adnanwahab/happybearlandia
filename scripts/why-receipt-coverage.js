/** Offline protocol v1: see docs/why-receipt-coverage.md. No service writes. */
import { readFile } from 'node:fs/promises';
import { DEFAULT_RECIPE } from '../world/future-machine/contracts.js';
import { initialForRecipe } from '../world/future-machine/data/index.js';
import { stateHash } from '../world/future-machine/data/core.js';
import { createEngine, addIntervention } from '../world/city/engine.js';
import { ENTITY_KINDS, compareEntities } from '../world/future-machine/diff/core.js';
import { explainChange } from '../world/future-machine/story/index.js';
import { constructionReceipts } from '../world/future-machine/evidence.js';

const ratio = (covered, changed) => changed ? covered / changed : null;
export function summarize(rows) {
  const entities = new Set(rows.map(r => JSON.stringify([r.collection, r.id])));
  const covered = new Set(rows.filter(r => r.receipts.length).map(r => JSON.stringify([r.collection, r.id])));
  const coveredTransitions = rows.filter(r => r.receipts.length).length;
  return { changedEntities: entities.size, coveredEntities: covered.size,
    entityCoverage: ratio(covered.size, entities.size), transitions: rows.length,
    coveredTransitions, transitionCoverage: ratio(coveredTransitions, rows.length) };
}

export function measureRun(initial, steps, arm) {
  if (!['baseline', 'plan'].includes(arm) || !Array.isArray(steps) || !steps.length) throw new Error('Run and arm required');
  const rows = [];
  let previous = initial;
  for (const step of steps) {
    const state = step.state;
    if (state?.month !== previous.month + 1 || state.seed !== initial.seed || state.version !== initial.version || !Array.isArray(step.events)) throw new Error('Missing or mismatched step');
    const diff = compareEntities(previous, state);
    if (diff.missing.length) throw new Error('Missing entity inventory');
    for (const collection of ENTITY_KINDS) for (const kind of ['added', 'removed', 'modified']) for (const change of diff.entities[collection][kind]) {
      const direct = explainChange({collection, entityId: change.id, month: state.month}, {a: step.events}).receipts;
      const construction = constructionReceipts({[arm]: [{month: state.month, state, events: step.events}]}, {collection, id: change.id}, state.month)
        .filter(r => r.month === state.month);
      const receipts = [...new Set([...direct, ...construction].map(r => r.eventId))].sort();
      rows.push({month: state.month, collection, id: change.id, kind,
        fields: change.fields.map(f => f.field), receipts});
    }
    previous = state;
  }
  return rows;
}

export async function generateCoverageReport() {
  const runs = [];
  for (const seed of [42, 7, 2911]) {
    const recipe = {...DEFAULT_RECIPE, seed};
    const common = initialForRecipe(recipe);
    for (const arm of ['baseline', 'plan']) {
      const initial = arm === 'plan' ? addIntervention(common, recipe.intervention) : common;
      const initialHash = await stateHash(initial);
      const replay = createEngine().run(initial, recipe.months);
      const rows = measureRun(initial, replay.steps, arm);
      if (await stateHash(initial) !== initialHash) throw new Error('Initial mutated');
      const byChangeType = ENTITY_KINDS.flatMap(collection => ['added', 'removed', 'modified'].map(kind => {
        const group = rows.filter(r => r.collection === collection && r.kind === kind);
        const uncovered = group.filter(r => !r.receipts.length);
        return {collection, kind, ...summarize(group), uncoveredTransitions: uncovered.length,
          uncoveredFields: [...new Set(uncovered.flatMap(r => r.fields))].sort(), uncoveredExamples: uncovered.slice(0, 3)};
      }));
      runs.push({seed, arm, recipe, modelVersion: initial.version, manifest: replay.manifest,
        provenance: initial.provenance, initialHash, terminalHash: await stateHash(replay.state),
        ledgerHash: await stateHash(rows), ...summarize(rows), byChangeType,
        constructionExample: rows.find(r => r.month === 16 && r.collection === 'buildings' && r.receipts.includes('16-0')) ?? null});
    }
  }
  const sources = {};
  for (const path of ['scripts/why-receipt-coverage.js', 'docs/why-receipt-coverage.md', 'world/city/engine.js', 'world/city/systems.js', 'world/city/residents.js', 'world/city/contracts.js', 'world/city/seed.js', 'world/future-machine/contracts.js', 'world/future-machine/data/index.js', 'world/future-machine/diff/core.js', 'world/future-machine/story/index.js', 'world/future-machine/evidence.js']) {
    sources[path] = await stateHash(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  }
  return {schemaVersion: 'why-receipt-coverage.v1', protocol: 'docs/why-receipt-coverage.md',
    evidence: 'Local deterministic synthetic recomputation; receipt presence is not causal completeness.',
    sourceDigestEncoding: 'SHA-256 of canonical JSON string of UTF-8 source text', sources, runs};
}

if (import.meta.main) console.log(JSON.stringify(await generateCoverageReport(), null, 2));
