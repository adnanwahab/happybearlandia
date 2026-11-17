import {test,expect} from 'bun:test';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createEngine} from '../world/city/engine.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {initialForRecipe,normalizeReplay} from '../world/future-machine/data/index.js';
import {stateHash} from '../world/future-machine/data/core.js';
import {createRunReceipt} from '../world/future-machine/share/run-receipt.js';
import {createScientificExport,validateRows,fileHash} from '../shared/scientific-export/index.js';
import {exportScientificDataCLI} from '../scripts/export-scientific-data.js';
async function receipt(seed=4294967295) {
 const recipe={...DEFAULT_RECIPE,seed,households:1,intervention:null},initial=initialForRecipe(recipe),engine=createEngine(),baseline=normalizeReplay(initial,engine.run(initial,120));
 return createRunReceipt({recipe,seed,modelVersion:recipe.modelVersion,experimentId:null,initialHash:await stateHash(initial),baseline,plan:structuredClone(baseline),provenance:{...initial.provenance,modelManifest:engine.manifest,replay:'Local recipe recomputation; no independently recorded checkpoints.',authority:'monthly City only'}},{month:0});
}
test('deterministic typed exports preserve paired zero outcomes, seed, provenance and source limits',async()=>{
 const r=await receipt(),before=JSON.stringify(r),a=await createScientificExport(r),b=await createScientificExport(r);
 expect(a).toEqual(b);expect(JSON.stringify(r)).toBe(before);
 expect(JSON.parse(a.files['metrics.json'])).toEqual(a.rows);
 expect(a.rows.find(r=>r.metric==='capitalSpending').value).toBe(0);
 expect(a.rows.every(r=>r.seed===4294967295&&r.month===0)).toBe(true);
 expect(a.manifest.measuredSources).toEqual([]);expect(a.manifest.syntheticInputs[0].recipe).toEqual(r.evidence.recipe);
 expect(a.manifest.license.id).toBe('NOASSERTION');
 expect(JSON.parse(a.files['provenance.json'])).toEqual(r);
 for(const [name,content] of Object.entries(a.files)) expect(a.manifest.files[name].sha256).toBe(await fileHash(content));
 await expect(createScientificExport({...r,checksum:'0'.repeat(64)})).rejects.toThrow('checksum');
 for(const value of [Infinity,NaN,undefined,'1']) expect(()=>validateRows([{...a.rows[0],value}])).toThrow();
 expect(validateRows([{...a.rows[0],value:null}])[0].value).toBeNull();
 expect(()=>validateRows([a.rows[0],a.rows[0]])).toThrow('Duplicate');
});
test('CLI publishes complete local bundle and refuses overwrites or invalid input',async()=>{
 const root=await mkdtemp(join(tmpdir(),'scientific-'));let errors='';const options={stderr:text=>errors+=text};
 try {
  const source=join(root,'receipt.json'),out=join(root,'dataset');await writeFile(source,JSON.stringify(await receipt(0)));
  expect(await exportScientificDataCLI([source,out,'json-csv'],options)).toBe(0);
  expect(JSON.parse(await readFile(join(out,'manifest.json'),'utf8')).rowCount).toBeGreaterThan(0);
  expect(await exportScientificDataCLI([source,out,'json-csv'],options)).toBe(1);
  expect(errors).toContain('exist');
  const notebook=spawnSync('python3',['-c',`import csv,json,sys,hashlib,pathlib
p=pathlib.Path(sys.argv[1])
rows=json.loads((p/'metrics.json').read_text())
with (p/'metrics.csv').open(newline='') as f: csvrows=list(csv.DictReader(f))
assert len(rows)==len(csvrows)
for a,b in zip(rows,csvrows):
 assert a['metric']==b['metric'] and a['value']==float(b['value'])
m=json.loads((p/'manifest.json').read_text())
for name,entry in m['files'].items(): assert hashlib.sha256((p/name).read_bytes()).hexdigest()==entry['sha256']
`,out],{encoding:'utf8'});
  expect(notebook.stderr).toBe('');expect(notebook.status).toBe(0);
  await writeFile(source,'{}');expect(await exportScientificDataCLI([source,join(root,'invalid'),'json-csv'],options)).toBe(1);
 }finally{await rm(root,{recursive:true,force:true});}
});

const hasArrow=spawnSync('python3',['-c','import pyarrow']).status===0;
(hasArrow ? test : test.skip)('Parquet opens with PyArrow and matches JSON records',async()=>{
 const root=await mkdtemp(join(tmpdir(),'scientific-parquet-'));
 try {
  const source=join(root,'receipt.json'),out=join(root,'bundle');await writeFile(source,JSON.stringify(await receipt()));
  expect(await exportScientificDataCLI([source,out])).toBe(0);
  const check=spawnSync('python3',['-c',"import json,sys,pyarrow.parquet as pq; from pathlib import Path; p=Path(sys.argv[1]); assert pq.read_table(p/'metrics.parquet').to_pylist()==json.loads((p/'metrics.json').read_text())",out],{encoding:'utf8'});
  expect(check.stderr).toBe('');expect(check.status).toBe(0);
 }finally{await rm(root,{recursive:true,force:true});}
});
