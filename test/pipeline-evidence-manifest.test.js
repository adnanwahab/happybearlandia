import {beforeAll,expect,test} from 'bun:test';
import {readFileSync,statSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {DEFAULT_RECIPE,MODEL_VERSION,METRIC_UNITS} from '../world/future-machine/contracts.js';
import {initialForRecipe,normalizeReplay,validateRecipe} from '../world/future-machine/data/index.js';
import {stateHash} from '../world/future-machine/data/core.js';
import {createEngine,addIntervention} from '../world/city/engine.js';
import {compareFrame} from '../world/future-machine/diff/index.js';

const manifest=JSON.parse(readFileSync(new URL('../docs/demo-evidence-manifest.json',import.meta.url),'utf8'));
let initial,history;
beforeAll(()=>{
 initial=initialForRecipe(manifest.recipe);const engine=createEngine();
 const run=intervention=>{
  let state=intervention?addIntervention(initial,intervention):structuredClone(initial);const steps=[];
  for(let month=1;month<=120;month++){const step=engine.step(state);steps.push(step);state=step.state;}
  return normalizeReplay(initial,{steps});
 };
 history={baseline:run(),plan:run(manifest.recipe.intervention)};
});

test('evidence manifest identifies the approved model, scenario and common initial state',async()=>{
 expect(manifest.schemaVersion).toBe('hbl-approved-demo-evidence.v1');
 expect(manifest.branch).toBe('sprint/one-city-two-futures-20261111');
 expect(manifest.implementationCommit).toMatch(/^[a-f0-9]{40}$/);
 expect(manifest.recipe).toEqual(DEFAULT_RECIPE);
 expect(validateRecipe(manifest.recipe)).toEqual(manifest.recipe);
 expect(manifest.modelVersion).toBe(MODEL_VERSION);
 expect(manifest.modelVersion).toBe(manifest.recipe.modelVersion);
 expect(manifest.recipe.seed).toBe(42);
 expect(manifest.recipe.months).toBe(120);
 expect(manifest.initialHash).toMatch(/^[a-f0-9]{64}$/);
 expect(await stateHash(initial)).toBe(manifest.initialHash);
 expect(history.baseline).toHaveLength(121);expect(history.plan).toHaveLength(121);
 expect(history.baseline[0].state).toEqual(history.plan[0].state);
});

test('first physical divergence and every recorded metric reproduce from the declared recipe with explicit units',()=>{
 const month=history.plan.findIndex((snapshot,index)=>snapshot.state.buildings.some(row=>!history.baseline[index].state.buildings.some(before=>before.id===row.id)));
 const added=history.plan[month].state.buildings.find(row=>!history.baseline[month].state.buildings.some(before=>before.id===row.id));
 expect(manifest.firstDivergence).toEqual({month,collection:'buildings',id:added.id});
 expect(month).toBe(16);
 expect(history.plan[0].state.buildings.some(row=>row.id===added.id)).toBe(false);
 const actual=compareFrame({month:120,baseline:history.baseline[120],plan:history.plan[120]});
 expect(manifest.finalMetrics).toEqual(actual.metrics);
 expect(Object.keys(manifest.finalMetrics).sort()).toEqual(Object.keys(METRIC_UNITS).sort());
 for(const [key,metric] of Object.entries(manifest.finalMetrics)){
  expect(metric.unit).toBe(METRIC_UNITS[key]);
  expect(metric.status).toBe('available');expect(metric.missing).toEqual([]);
  expect(Number.isFinite(metric.baseline)&&Number.isFinite(metric.plan)).toBe(true);
  expect(metric.delta).toBe(metric.plan-metric.baseline);
 }
 expect(manifest.finalMetrics.housingUnits).toMatchObject({baseline:36,plan:60,delta:24,unit:'homes'});
 expect(manifest.finalMetrics.capitalSpending).toMatchObject({delta:1000000,unit:'USD cumulative'});
});

test('progressive captures remain qualified rather than falsely asserting identical final-source captures',()=>{
 expect(manifest.note).toContain('captured progressively');
 expect(manifest.note).toContain('individual JSON records contain actual run identity and snapshots');
 expect(manifest.note).toContain('not a claim that every image was captured at its final commit');
 expect(manifest.note).toContain('No deployment or release merge');
 expect(manifest.recordingSeconds).toBeGreaterThanOrEqual(45);expect(manifest.recordingSeconds).toBeLessThanOrEqual(60);
 expect(manifest.releaseRisks.some(risk=>risk.includes('Safari')&&risk.includes('unverified'))).toBe(true);
 expect(manifest.artifacts.length).toBeGreaterThan(0);
 expect(new Set(manifest.artifacts.map(row=>row.path)).size).toBe(manifest.artifacts.length);
 for(const kind of ['cinematic','native390','construction15','construction16','delta320','why16','inspectorReverse0','recording','recordingAudit'])expect(manifest.artifacts.some(row=>row.kind===kind)).toBe(true);
 for(const artifact of manifest.artifacts){expect(isAbsolute(artifact.path)).toBe(true);expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/);}
});

// Local /tmp artifacts are deliberately not bundled with Git. Missing files are
// individual UNAVAILABLE skips, never successful hash validation. A present but
// changed/unreadable artifact fails. This does not replace browser interaction
// tests or visual inspection of the actual screenshot.
for(const artifact of manifest.artifacts){
 let available=true;
 try{statSync(artifact.path);}catch(error){if(error.code==='ENOENT')available=false;else throw error;}
 (available?test:test.skip)(`${available?'artifact integrity':'UNAVAILABLE local artifact'}: ${artifact.kind} — ${artifact.path}`,()=>{
  const bytes=readFileSync(artifact.path);
  expect(bytes.length).toBeGreaterThan(0);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(artifact.sha256);
  if(artifact.path.endsWith('.png')){expect(bytes.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');expect(bytes.readUInt32BE(16)).toBeGreaterThan(0);expect(bytes.readUInt32BE(20)).toBeGreaterThan(0);}
  if(artifact.kind==='recordingAudit'){
   const audit=JSON.parse(bytes.toString('utf8'));
   expect(audit.schemaVersion).toBe('hbl-demo-artifact-audit.v1');
   expect(new Set(audit.records.map(row=>row.month))).toEqual(new Set([0,120]));
   for(const row of audit.records){expect(row.seed).toBe(manifest.recipe.seed);expect(row.initialHash).toBe(manifest.initialHash);expect(row.modelVersion).toBe(manifest.modelVersion);expect(row.experimentId).toBeTruthy();}
   expect(audit.videos.length).toBeGreaterThan(0);
   for(const video of audit.videos)expect(video.durationSeconds).toBeGreaterThan(0);
   expect(audit.limitation).toContain('Structural artifact validation only');
  }
 });
}
