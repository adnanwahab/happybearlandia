import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { DEFAULT_RECIPE } from '../world/future-machine/contracts.js';
import { createEngine, addIntervention } from '../world/city/engine.js';
import { initialForRecipe, normalizeReplay } from '../world/future-machine/data/index.js';
import { stateHash } from '../world/future-machine/data/core.js';
import { createEvidenceReport, decodeRecipe, encodeRecipe } from '../world/future-machine/share/index.js';

export const examplesDirectory = new URL('../test/fixtures/example-receipts/', import.meta.url);
export const exampleCases = [
  { name: 'housing-month-16', recipe: DEFAULT_RECIPE, month: 16 },
  { name: 'zero-control-month-120', recipe: { ...DEFAULT_RECIPE, seed: 7, intervention: null }, month: 120 },
];

// Exercise the same versioned generator, monthly engine, normalization and export
// used by Future Machine. No saved experiment or production record is created.
export async function generateExample({ recipe, month }) {
  recipe = decodeRecipe(encodeRecipe(recipe));
  const initial = initialForRecipe(recipe);
  const initialHash = await stateHash(initial);
  const engine = createEngine();
  const history = {
    recipe, experimentId: null, initialHash, modelVersion: recipe.modelVersion, seed: recipe.seed,
    baseline: normalizeReplay(initial, engine.run(initial, recipe.months)),
    plan: normalizeReplay(initial, engine.run(recipe.intervention ? addIntervention(initial, recipe.intervention) : initial, recipe.months)),
    provenance: {
      ...initial.provenance, modelManifest: engine.manifest, initialHash,
      replay: 'Local recipe recomputation; no independently recorded checkpoints.',
      authority: 'monthly City only',
    },
  };
  if (await stateHash(initial) !== initialHash) throw new Error('Initial state mutated');
  return createEvidenceReport(history, { month });
}

export async function checkExamples() {
  const hashes = JSON.parse(await readFile(new URL('hashes.json', examplesDirectory), 'utf8'));
  for (const example of exampleCases) {
    const expected = await readFile(new URL(`${example.name}.json`, examplesDirectory), 'utf8');
    const report = await generateExample(example);
    if (expected !== JSON.stringify(report, null, 2) + '\n' || hashes[example.name] !== await stateHash(report)) {
      throw new Error(`Example receipt mismatch: ${example.name}`);
    }
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--write', '--check'].includes(args[0])) throw new Error('Use --write or --check');
  if (args[0] === '--check') await checkExamples();
  else {
    await mkdir(examplesDirectory, { recursive: true });
    const hashes = {};
    for (const example of exampleCases) {
      const report = await generateExample(example);
      await writeFile(new URL(`${example.name}.json`, examplesDirectory), JSON.stringify(report, null, 2) + '\n');
      hashes[example.name] = await stateHash(report);
    }
    await writeFile(new URL('hashes.json', examplesDirectory), JSON.stringify(hashes, null, 2) + '\n');
  }
  console.log(`Example receipts ${args[0] === '--check' ? 'verified' : 'generated'}: ${exampleCases.length}`);
}
