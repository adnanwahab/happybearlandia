import {test, expect} from 'bun:test';
import {buildUncertaintyExplorer} from '../world/uncertainty-explorer.js';
import {generateWorlds} from '../world/world-generator.js';
import {createExperimentRecord} from '../world/experiment-record.js';
const experiment = {id:'uncertainty', worldModel:{variables:[{id:'x', baseline:.5, range:{min:0,max:1}}]}, outcomes:{metricRegistry:[{id:'cost',unit:'USD'}, {id:'missing'}]}};
test('seeded distributions replay, rank each outcome, and survive snapshot serialization',()=>{
 const worlds=generateWorlds(experiment,{seed:42,runs:30});
 const batch={simulations:worlds.worlds.map(world=>({id:world.id,world,score:world.conditions.x*100,metrics:{cost:-world.conditions.x}}))};
 const report=buildUncertaintyExplorer(batch,experiment);
 expect(report).toEqual(buildUncertaintyExplorer(JSON.parse(JSON.stringify(batch)),experiment));
 expect(report.outcomes[0].sensitivities[0].correlation).toBe(1);
 expect(report.outcomes.find(r=>r.id==='cost').sensitivities[0].correlation).toBe(-1);
 expect(report.outcomes[0].bins.reduce((n,b)=>n+b.count,0)).toBe(30);
 expect(new Set(report.outcomes[0].samples.map(s=>s.seed)).size).toBe(30);
 expect(createExperimentRecord({experiment,simulationBatch:batch}).uncertainty).toEqual(report);
});
test('missing and nonfinite values never become zero, constant and empty batches are explicit',()=>{
 const result=buildUncertaintyExplorer({simulations:[{score:5,metrics:{cost:null}},{score:5,metrics:{cost:Infinity}},{score:null,metrics:{cost:0}}]},experiment);
 expect(result.outcomes[0]).toMatchObject({count:2,missing:1,min:5,max:5,median:5});
 expect(result.outcomes[0].bins).toHaveLength(1);
 expect(result.outcomes.find(r=>r.id==='cost')).toMatchObject({count:1,missing:2,median:0});
 expect(result.outcomes.find(r=>r.id==='missing')).toMatchObject({count:0,missing:3,median:null});
 expect(buildUncertaintyExplorer(null,experiment).outcomes[0].bins).toEqual([]);
});

test('normal civic adapter carries the same seeded run data into saved analysis and bundle', async () => {
 const {resolveCivicExperimentPayload} = await import('../world/experiment-contract.js');
 const {simulateExperiment, resolveSimulationAdapter} = await import('../world/simulation-adapter.js');
 const {buildExperimentBundle} = await import('../world/experiment-audit.js');
 const civic = resolveCivicExperimentPayload({packages:[{id:'housing',title:'Housing plan',items:[{proposal:{id:'p',title:'Permit more homes'}}]}]}, {runs:20,years:2,seed:42}).experiment;
 const worlds = generateWorlds(civic);
 const batch = await simulateExperiment(civic, worlds, await resolveSimulationAdapter(civic));
 const record = createExperimentRecord({experiment:civic,worldBatch:worlds,simulationBatch:batch});
 const bundle = buildExperimentBundle(record);
 expect(bundle.uncertainty).toEqual(record.uncertainty);
 expect(record.uncertainty.outcomes.length).toBeGreaterThan(1);
 for (const outcome of record.uncertainty.outcomes) {
   expect(outcome.samples.map(s=>s.seed)).toEqual(worlds.worlds.map(w=>w.seed));
   expect(outcome.count + outcome.missing).toBe(20);
 }
 expect(await simulateExperiment(civic, generateWorlds(civic), await resolveSimulationAdapter(civic))).toEqual(batch);
});

test('insufficient pairs and fixed inputs have no estimable sensitivity', () => {
 const report = buildUncertaintyExplorer({simulations:[0,1,2,3].map(score=>({score,world:{conditions:{x:1}}}))}, experiment);
 expect(report.outcomes[0].sensitivities[0].available).toBe(false);
 const small = buildUncertaintyExplorer({simulations:[0,1].map(score=>({score,world:{conditions:{x:score}}}))}, experiment);
 expect(small.outcomes[0].sensitivities[0].available).toBe(false);
});

test('research records preserve attribution, label unsourced assumptions, and reject unsafe source links', async () => {
 const {renderResearchLibrary} = await import('../world/uncertainty-explorer.js');
 const container = {innerHTML:''};
 renderResearchLibrary(container, [
  {id:'x',label:'<unsafe>',provenance:{type:'estimated',confidence:.7},evidence:[{sourceName:'Reference',url:'https://example.org/source',notes:'Research note'}]},
  {id:'y',evidence:[{sourceName:'Untrusted',url:'javascript:alert(1)'}]},
  {id:'z'},
 ]);
 expect(container.innerHTML).toContain('Confidence: 70%');
 expect(container.innerHTML).toContain('href="https://example.org/source"');
 expect(container.innerHTML).toContain('&lt;unsafe&gt;');
 expect(container.innerHTML).not.toContain('javascript:');
 expect(container.innerHTML).toContain('Unsourced model assumption');
});
