import {expect,test} from 'bun:test';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {createCity} from '../world/city/seed.js';
import {createEngine,addIntervention} from '../world/city/engine.js';
import {encodeRecipe,decodeRecipe,createShareURL,parseShareURL,assertHistoryIdentity,createEvidenceReport,MAX_RECIPE_LENGTH} from '../world/future-machine/share/index.js';
const recipe = structuredClone(DEFAULT_RECIPE);
const raw = value => btoa(JSON.stringify(value)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const snapshot = month => ({month,metrics:{housingUnits:12},events:[],causalRecords:[],decisions:[]});
const history = () => ({recipe,experimentId:'city_test',initialHash:'sha256:fixture',modelVersion:recipe.modelVersion,seed:recipe.seed,baseline:Array.from({length:121},(_,i)=>snapshot(i)),plan:Array.from({length:121},(_,i)=>snapshot(i)),provenance:{type:'synthetic-assumption'}});

test('canonical bounded recipe roundtrips and does not mutate inputs',()=>{
  const before = JSON.stringify(recipe);
  expect(decodeRecipe(encodeRecipe(recipe))).toEqual(recipe);
  expect(encodeRecipe({...recipe,intervention:Object.fromEntries(Object.entries(recipe.intervention).reverse())})).toBe(encodeRecipe(recipe));
  expect(JSON.stringify(recipe)).toBe(before);
  for(const seed of [0,4294967295]) for(const households of [1,120]) expect(decodeRecipe(encodeRecipe({...recipe,seed,households,intervention:null}))).toEqual({...recipe,seed,households,intervention:null});
});
test('malformed, oversized, version mismatch and unsupported input links fail explicitly',()=>{
  for(const text of ['',null,'!','e30',raw([]),'a'.repeat(MAX_RECIPE_LENGTH+1)]) expect(()=>decodeRecipe(text)).toThrow();
  expect(()=>decodeRecipe(raw({...recipe,schemaVersion:'future-machine.v99'}))).toThrow('version');
  expect(()=>decodeRecipe(raw({...recipe,modelVersion:'old'}))).toThrow('model version');
  for(const update of [{seed:-1},{seed:4294967296},{seed:'42'},{households:121},{households:0},{months:119},{months:121},{unexpected:1},{intervention:undefined},{intervention:{...recipe.intervention,districtId:'d9'}},{intervention:{...recipe.intervention,amount:Infinity}},{intervention:{...recipe.intervention,delay:0.5}},{intervention:{...recipe.intervention,compliance:1.1}}]) expect(()=>encodeRecipe({...recipe,...update})).toThrow();
});
test('share URL retains route and exact context on refresh, with or without saved records',()=>{
  for(const month of [0,60,120]) for(const experimentId of [null,'city_fixture']) {
    const url=createShareURL({recipe,experimentId,month},'https://example.test/world/future-machine.html?view=split#city');
    expect(new URL(url).pathname).toBe('/world/future-machine.html');
    expect(new URL(url).searchParams.get('view')).toBe('split');
    expect(parseShareURL(url)).toEqual({recipe,experimentId,month});
  }
  expect(parseShareURL('https://example.test/world/future-machine.html')).toBeNull();
});
test('missing, duplicate, malformed or mismatched context cannot silently select defaults',()=>{
  const base='https://example.test/world/future-machine.html';
  const fm=encodeRecipe(recipe);
  for(const query of ['?month=0','?experiment=city_test',`?fm=${fm}`,`?fm=${fm}&month=121`,`?fm=${fm}&month=-1`,`?fm=${fm}&month=01`,`?fm=${fm}&month=1.5`,`?fm=${fm}&month=0&month=1`,`?fm=${fm}&month=0&experiment=`, `?fm=${fm}&month=0&experiment=../../secret`]) expect(()=>parseShareURL(base+query)).toThrow();
  expect(()=>createShareURL({recipe,month:0},'javascript:alert(1)')).toThrow();
  for(const update of [{seed:3},{modelVersion:'old'},{experimentId:'city_other'},{recipe:{...recipe,seed:9}}]) expect(()=>assertHistoryIdentity({...history(),...update},{recipe,experimentId:'city_test'})).toThrow();
  expect(()=>assertHistoryIdentity(history(),{recipe,initialHash:'other'})).toThrow();
});
test('decoded recipe regenerates identical Month 0 and Month 120 with the real monthly engine',()=>{
  const input={...recipe,households:3};
  const run = r => {
    const initial=createCity({seed:r.seed,households:r.households});
    const engine=createEngine();
    return {initial,baseline:engine.run(initial,120).state,plan:engine.run(addIntervention(initial,r.intervention),120).state};
  };
  const first=run(input),second=run(decodeRecipe(encodeRecipe(input)));
  expect(second).toEqual(first);
  expect(first.initial.month).toBe(0);
  expect(first.initial.policies).toEqual([]);
  expect(first.baseline.month).toBe(120);
  expect(first.plan.month).toBe(120);
});
test('evidence preserves provenance, month and interpretation boundaries without mutating run',()=>{
  const source=history(), before=JSON.stringify(source);
  const report=createEvidenceReport(source,{month:0,diff:{month:0,metrics:{}},story:{summary:'Modeled interpretation'}});
  expect(report.initialHash).toBe(source.initialHash);
  expect(report.observations.baseline.month).toBe(0);
  expect(report.provenance).toEqual(source.provenance);
  expect(report.evidenceKind).toBe('manifest-recomputation');
  expect(report.limitations.join(' ')).toContain('not empirical forecasts');
  report.provenance.type='changed';
  expect(JSON.stringify(source)).toBe(before);
  expect(()=>createEvidenceReport(source,{month:0,diff:{month:120}})).toThrow('selected month');
  expect(()=>createEvidenceReport({...source,initialHash:null})).toThrow('digest');
  expect(()=>createEvidenceReport({...source,baseline:source.baseline.slice(1)})).toThrow('Month 0');
  source.baseline[120].metrics.housingUnits=Infinity;
  expect(()=>createEvidenceReport(source)).toThrow('non-finite');
});
test('evidence export bounds and serialization failures are explicit',()=>{
  const source=history();
  expect(()=>createEvidenceReport(source,{story:{summary:'x'.repeat(4_000_001)}})).toThrow('export limit');
  const cyclic={};cyclic.self=cyclic;
  expect(()=>createEvidenceReport(source,{story:cyclic})).toThrow('JSON serializable');
  expect(()=>createEvidenceReport(source,{month:121})).toThrow('Selected month');
  source.plan[60].month=59;
  expect(()=>createEvidenceReport(source)).toThrow('Month 0');
});
