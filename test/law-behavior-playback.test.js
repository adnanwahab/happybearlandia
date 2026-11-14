import {test,expect} from 'bun:test';
import {getLaw} from '../world/laws/catalog.js';
import {compareLaw,lawMappingWithStrength} from '../world/laws/comparison.js';
import {pairedLawFrames,pairedLawActorChanges} from '../world/laws/behavior-playback.js';

test('edited transit lever interpolates its reviewed factor without changing the frozen baseline or seed',async()=>{
  const inputs={lawId:83,seed:42,population:24,minutes:120,worldContext:{districts:[
    {id:'west',x:0,z:0},{id:'east',x:2000,z:0}
  ]}};
  const before=JSON.stringify(inputs),original=await compareLaw(inputs);
  const edited=await compareLaw({...inputs,implementationStrength:0.5});
  const unchanged=await compareLaw({...inputs,implementationStrength:0});
  expect(original.manifest.selectedConfig.transitService).toBe(1.5);
  expect(edited.manifest.initialConfig.transitService).toBe(1);
  expect(edited.manifest.selectedConfig.transitService).toBe(1.25);
  expect(edited.manifest.implementationStrength).toBe(0.5);
  expect(edited.manifest.seed).toBe(original.manifest.seed);
  expect(edited.baseline.timeline).toEqual(original.baseline.timeline);
  expect(unchanged.baseline.timeline).toEqual(unchanged.selected.timeline);
  expect(JSON.stringify(inputs)).toBe(before);
},20000);

test('sampled population behavior has stable actual actor identities and exact paired frame times',async()=>{
  const inputs={lawId:83,seed:11,population:18,minutes:90,worldContext:{districts:[
    {id:'west',x:0,z:0},{id:'east',x:1500,z:0}
  ]}};
  const result=await compareLaw(inputs);
  const frames=pairedLawFrames(result);
  expect(frames.length).toBeGreaterThan(1);
  expect(frames[0].time).toBe(0);
  expect(frames.at(-1).time).toBe(90);
  expect(frames.every(row=>row.engine==='population'&&row.unit==='minute')).toBe(true);
  expect(frames.every(row=>row.baselineActors.length===12&&row.treatmentActors.length===12)).toBe(true);
  expect(frames.every(row=>row.baselineActors.map(a=>a.id).join()===row.treatmentActors.map(a=>a.id).join())).toBe(true);
  expect(frames[0].baselineActors[0].id).toBe(frames.at(-1).baselineActors[0].id);
  expect(frames.at(-1).baselineActors[0]).toMatchObject({
    id:result.baseline.snapshot.visibleAgents.find(a=>a.index===0).id
  });
  expect(result.manifest.seed).toBe(11);
},20000);

test('city law frame samples show real modeled households and unchanged policy base across revisions',async()=>{
  const inputs={lawId:22,seed:42,population:12,months:4};
  const full=await compareLaw(inputs),revised=await compareLaw({...inputs,implementationStrength:0.5});
  const frames=pairedLawFrames(revised);
  expect(revised.manifest.selectedParameters.constructionCost)
    .toBeCloseTo(revised.manifest.initialParameters.constructionCost*0.95,8);
  expect(revised.baseline.timeline).toEqual(full.baseline.timeline);
  expect(frames.map(frame=>frame.time)).toEqual([0,1,2,3,4]);
  expect(frames[0].baselineActors.length).toBeGreaterThan(0);
  expect(frames[0].baselineActors[0]).toHaveProperty('monthlyIncome');
  expect(frames[0].baselineActors[0]).toHaveProperty('monthlyRent');
  expect(frames[0].treatmentActors[0].id).toBe(frames[0].baselineActors[0].id);
  expect(frames.at(-1).treatment.housingUnits).toBe(revised.selected.timeline.at(-1).metrics.housingUnits);
},20000);

test('partial sensitivity rejects unreviewed mechanisms, illegal percentages and fabricated parameter names',async()=>{
  expect(lawMappingWithStrength(getLaw(83),0.5).parameterFactors.transitService).toBe(1.25);
  expect(lawMappingWithStrength(getLaw(23),0).parameterFactors.permits).toBe(1);
  for(const value of [-0.1,1.1,NaN,Infinity,'0.5'])
    expect(()=>lawMappingWithStrength(getLaw(83),value)).toThrow();
  expect(()=>lawMappingWithStrength(getLaw(21),0.5)).toThrow('fixed or discrete');
  expect(()=>lawMappingWithStrength(getLaw(31),1)).toThrow('No reviewed');
  await expect(compareLaw({lawId:83,population:12,minutes:60,implementationStrength:-1})).rejects.toThrow();
});

test('playback refuses incompatible, unsupported, unpaired or non-recorded results',()=>{
  const result={status:'completed',supported:true,engine:'population',manifest:{pairedInitialState:true},
    baseline:{timeline:[{minute:0,metrics:{trips:0},actors:[{id:'p1'}]},{minute:15,metrics:{trips:1}}]},
    selected:{timeline:[{minute:0,metrics:{trips:0},actors:[{id:'p1'}]},{minute:30,metrics:{trips:10}}]}};
  expect(pairedLawFrames(result).map(row=>row.time)).toEqual([0]);
  expect(pairedLawFrames({...result,status:'mechanism-unavailable'})).toEqual([]);
  expect(pairedLawFrames({...result,manifest:{pairedInitialState:false}})).toEqual([]);
  expect(pairedLawFrames({...result,analysis:{comparison:{comparable:false}}})).toEqual([]);
  expect(pairedLawActorChanges({
    engine:'population',
    baselineActors:[{id:'p1',mode:'bus',activity:'work',x:3},{id:'unmatched',mode:'walk'}],
    treatmentActors:[{id:'p1',mode:'walk',activity:'work',x:4}]
  })).toEqual([expect.objectContaining({id:'p1',fields:['mode','x']})]);
});

test('repeated revisions with the same explicit inputs replay identically',async()=>{
  const inputs={lawId:83,seed:919,population:16,minutes:90,implementationStrength:0.75,
    worldContext:{districts:[{id:'a',x:0,z:0},{id:'b',x:1000,z:0}]}};
  const one=await compareLaw(inputs),two=await compareLaw(inputs);
  expect(one.baseline.timeline).toEqual(two.baseline.timeline);
  expect(one.selected.timeline).toEqual(two.selected.timeline);
  expect(pairedLawFrames(one)).toEqual(pairedLawFrames(two));
},20000);
