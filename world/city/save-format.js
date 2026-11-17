// Save format is independent of simulation/rules versions. Never rewrite outcomes.
export const SAVE_FORMAT_VERSION = 1;
export function migrateCitySave(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid City save');
  const manifest = structuredClone(input);
  const from = Object.hasOwn(manifest, 'saveFormatVersion') ? manifest.saveFormatVersion : 0;
  if (!Number.isInteger(from) || from < 0 || from > SAVE_FORMAT_VERSION) throw new Error('Unsupported City save format version');
  const migrations = [];
  if (from === 0) {
    if (typeof manifest.version !== 'string' || !manifest.initial || !Array.isArray(manifest.scenarios)) throw new Error('Invalid legacy City save');
    manifest.saveFormatVersion = 1;
    migrations.push({from:0,to:1,outcomeChanged:false,message:'Added save format metadata; recorded outcomes are unchanged. Legacy replay verification covers stored final metrics only.'});
  }
  return {manifest,migrations};
}
export function compareSavedOutcome(expected, actual) {
  if (!expected || !Object.keys(expected).length) return {status:'unavailable',message:'No recorded outcome available; replay equivalence cannot be verified.'};
  const differences = [];
  for (const key of new Set([...Object.keys(expected), ...Object.keys(actual ?? {})])) {
    if (!Number.isFinite(expected[key]) || !Number.isFinite(actual?.[key]) || expected[key] !== actual[key]) differences.push({metric:key,recorded:expected[key] ?? null,replayed:actual?.[key] ?? null});
  }
  return {status:differences.length?'mismatch':'matched',scope:'final-metrics',differences};
}
