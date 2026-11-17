import { validateRunReceipt, canonicalReceiptJSON } from '../../world/future-machine/share/run-receipt.js';
export async function fileHash(content) {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}

export const VERSION = 'scientific-export.v1';
export const fields = {
  dataset_id: ['string', 'Receipt checksum identifying the source dataset'],
  model_version: ['string', 'Monthly City model version'],
  seed: ['integer', 'Unsigned 32-bit simulation seed'],
  scenario: ['string', 'Matched arm: baseline or plan'],
  month: ['integer', 'Months since January 2026'],
  metric: ['string', 'Metric identifier from the source observation'],
  value: ['number', 'Finite modeled value; null means unavailable'],
  unit: ['string', 'Unit of the metric; unknown means not documented by the source'],
  evidence_kind: ['string', 'Source evidence classification; not empirical measurement'],
};
export const rowSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'array', minItems: 1, items: {type:'object', additionalProperties:false,
    required:Object.keys(fields), properties:Object.fromEntries(Object.entries(fields).map(([key,[type,description]]) =>
      [key,{type:key === 'value' ? ['number','null'] : type,description,
        ...(key === 'scenario' ? {enum:['baseline','plan']} : {}),
        ...(key === 'seed' ? {minimum:0,maximum:4294967295} : {}),
        ...(key === 'month' ? {minimum:0,maximum:120} : {})}]))},
};
export function validateRows(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('Empty metric dataset');
  const identities = new Set();
  for (const row of rows) {
    if (Object.keys(row).length !== Object.keys(fields).length) throw new Error('Unexpected row fields');
    for (const [key,[type]] of Object.entries(fields)) {
      const value = row[key];
      if (key === 'value' && value === null) continue;
      if (type === 'integer' ? !Number.isInteger(value) : typeof value !== type || (type === 'number' && !Number.isFinite(value))) throw new Error(`Invalid ${key}`);
    }
    if (!['baseline','plan'].includes(row.scenario) || row.seed < 0 || row.seed > 4294967295 || row.month < 0 || row.month > 120) throw new Error('Invalid row identity');
    const id = JSON.stringify([row.dataset_id,row.scenario,row.month,row.metric]);
    if (identities.has(id)) throw new Error('Duplicate metric');
    identities.add(id);
  }
  return rows;
}
const csvCell = value => value === null ? '' : '"' + String(value).replaceAll('"','""') + '"';
export async function createScientificExport(input) {
  const receipt = await validateRunReceipt(input), e = receipt.evidence;
  // This adapter only supports the declared synthetic generator. Unknown provenance
  // must acquire a reviewed adapter rather than silently losing measured sources.
  if (e.provenance?.type !== 'synthetic-assumption' || e.provenance.datasetVersion !== 'future-machine-synthetic.v1') throw new Error('Unsupported source provenance');
  const rows = validateRows(['baseline','plan'].flatMap(scenario => Object.entries(e.observations[scenario].metrics).map(([metric,value]) => ({
    dataset_id:receipt.checksum, model_version:e.modelVersion, seed:e.seed, scenario, month:e.month,
    metric,value,unit:receipt.units[metric] ?? 'unknown',evidence_kind:e.evidenceKind,
  }))));
  const dictionary = {schemaVersion:VERSION,columns:fields,metrics:Object.fromEntries([...new Set(rows.map(r=>r.metric))].map(metric=>[metric,{unit:receipt.units[metric] ?? 'unknown',description:`Monthly City ${metric}; modeled aggregate, see source receipt and limitations.`}]))};
  const files = {
    'metrics.json':canonicalReceiptJSON(rows)+'\n',
    'metrics.csv':Object.keys(fields).join(',')+'\r\n'+rows.map(row=>Object.keys(fields).map(key=>csvCell(row[key])).join(',')).join('\r\n')+'\r\n',
    'schema.json':JSON.stringify(rowSchema,null,2)+'\n',
    'data-dictionary.json':JSON.stringify(dictionary,null,2)+'\n',
    'provenance.json':canonicalReceiptJSON(receipt)+'\n',
  };
  const manifest = {schemaVersion:VERSION,id:`urn:sha256:${receipt.checksum}`,title:`Future Machine paired metrics at month ${e.month}`,modelVersion:e.modelVersion,seed:e.seed,
    license:{id:'NOASSERTION',description:'No dataset license has been declared by the source repository; no redistribution grant is implied.'},
    measuredSources:[],syntheticInputs:[{id:e.provenance.datasetVersion,recipe:e.recipe,provenance:e.provenance,license:'NOASSERTION'}],
    rulesRevision:receipt.rulesRevision,limitations:e.limitations,access:'Local files; no authentication required after export.',
    provenance:'provenance.json',dictionary:'data-dictionary.json',schema:'schema.json',rowCount:rows.length,
    files:Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name,content])=>[name,{sha256:await fileHash(content)}])))};
  return {rows,manifest,files};
}
